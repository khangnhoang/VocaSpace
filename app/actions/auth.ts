"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { consumePasswordRecovery, getPasswordSetupEligibility } from "@/lib/auth/password-setup";
import { SAME_PASSWORD_MESSAGE, WEAK_PASSWORD_MESSAGE } from "@/lib/auth/password-update-messages";
import {
  AVATAR_FILE_EXTENSIONS,
  AVATAR_INVALID_MESSAGE,
  avatarFileSchema,
  loginSchema,
  passwordRecoveryRequestSchema,
  registerSchema,
  resendSignupConfirmationSchema,
  setPasswordSchema,
} from "@/lib/schemas/auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import {
  LAST_SIGN_IN_METHOD_COOKIE,
  RETURN_PATH_COOKIE,
  expiredReturnPathCookieOptions,
  isHttpsRequest,
  lastSignInMethodCookieOptions,
  resolveReturnPath,
} from "@/lib/auth/return-path";

const SIGNUP_UNAVAILABLE_MESSAGE = "Đăng ký tạm thời chưa khả dụng";
const SIGNUP_RETRY_MESSAGE = "Đăng ký chưa thành công, vui lòng thử lại.";
const USERNAME_TAKEN_MESSAGE = "Username đã được dùng, hãy thử username khác.";
const RESEND_MESSAGE = "Mail xác minh mới sẽ tới trong vài phút, bạn kiểm tra cả mục Spam nhé!";
const RECOVERY_MESSAGE =
  "Đã gửi yêu cầu! Bạn kiểm tra hộp thư (cả mục Spam) trong vài phút nhé.";
const SIGN_IN_FAILED_MESSAGE = "Sai email hoặc mật khẩu!";
const SET_PASSWORD_NOT_ALLOWED_MESSAGE =
  "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại.";
const SET_PASSWORD_FAILED_MESSAGE = "Chưa đặt được mật khẩu, vui lòng thử lại.";
const SET_PASSWORD_SESSION_EXPIRED_MESSAGE =
  "Phiên xác minh đã quá 24 giờ. Bạn yêu cầu link mới ở trang Quên mật khẩu nhé.";

// G4: admin API bỏ qua công tắc "Allow new users to sign up" của Supabase, nên đọc công tắc đó
// trước khi tạo user. Không cache để tắt đăng ký trên dashboard có hiệu lực ngay; đọc lỗi hoặc
// thiếu trường thì coi như đang đóng.
async function isSignupOpen(): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { disable_signup?: unknown };
    return settings.disable_signup === false;
  } catch {
    return false;
  }
}

// G8: mật khẩu không ai biết, chỉ để tạo user. Hậu tố cố định để luôn có đủ 4 loại ký tự cho mọi
// chính sách mật khẩu của Supabase; độ an toàn nằm ở 256 bit ngẫu nhiên phía trước.
function createUnknownPassword() {
  return `${randomBytes(32).toString("base64url")}aA1!`;
}

// Hàm này sẽ nhận FormData từ giao diện bắn lên
export async function signUpUser(formData: FormData) {
  const supabase = await createClient();

  // 1. Lấy dữ liệu thô từ Form
  const rawData = {
    username: formData.get("username"),
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),

    // QUAN TRỌNG NHẤT LÀ DÒNG NÀY:
    // Ép chuỗi String từ FormData ngược về Date object để Zod nó chịu nhận
    dob: new Date(formData.get("dob") as string),

    gender: formData.get("gender"),
  };

  // 2. Chốt kiểm tra Zod trên Server (Bảo vệ Database)
  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    // Sửa chữ .errors thành .issues là TypeScript xanh mượt ngay
    return { error: validated.error.issues[0].message };
  }

  // Ảnh là tuỳ chọn: không gửi hoặc gửi tệp rỗng thì bỏ qua; có thì phải hợp lệ trước mọi truy vấn và upload.
  const rawAvatar = formData.get("avatar");
  const hasAvatar = rawAvatar instanceof File ? rawAvatar.size > 0 : rawAvatar !== null;
  const parsedAvatar = hasAvatar ? avatarFileSchema.safeParse(rawAvatar) : null;
  if (parsedAvatar && !parsedAvatar.success) return { error: AVATAR_INVALID_MESSAGE };

  // 3. Destructuring dữ liệu sạch
  const { email, username, full_name, phone, dob, gender } = validated.data;

  if (!(await isSignupOpen())) return { error: SIGNUP_UNAVAILABLE_MESSAGE };

  // G5: lỗi username chỉ đến từ bước kiểm tra trước này, nên giống nhau với mọi trạng thái email.
  const service = createServiceRoleClient();
  const { data: existingProfile, error: usernameError } = await service
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (usernameError) return { error: SIGNUP_RETRY_MESSAGE };
  if (existingProfile) return { error: USERNAME_TAKEN_MESSAGE };

  let avatar_url = null;

  if (parsedAvatar?.success) {
    // Tên tệp ngẫu nhiên (vd: 1711234567-abc12.webp); đuôi và content-type lấy từ loại đã kiểm, không từ tên tệp client.
    const { file, type } = parsedAvatar.data;
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${AVATAR_FILE_EXTENSIONS[type]}`;

    // Đẩy ảnh lên bucket tên là 'avatars' trong Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { contentType: type });

    // Nếu đẩy thành công, lấy đường link public của tấm ảnh đó
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      avatar_url = publicUrlData.publicUrl;
    } else {
      console.error("Lỗi upload ảnh:", uploadError);
    }
  }

  // 4. Server tạo user chưa xác minh (không cấp session); trigger hốt metadata nhét vào Profiles.
  // Marker `d7_server_created` là thứ duy nhất hook "Before User Created" chấp nhận cho user email.
  const { error: createError } = await service.auth.admin.createUser({
    email,
    password: createUnknownPassword(),
    email_confirm: false,
    user_metadata: {
      username,
      full_name,
      phone,
      dob: dob.toISOString(),
      gender,
      avatar_url,
    },
    app_metadata: { d7_server_created: true },
  });
  if (createError) console.error("signUpUser createUser failed:", createError.code ?? createError.status);

  // G5: email đã tồn tại (đang chờ hoặc đã xác minh) vẫn đi qua resend và nhận cùng kết quả,
  // để màn hình không cho biết email nào đã có tài khoản.
  const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
  if (resendError) console.error("signUpUser resend failed:", resendError.code ?? resendError.status);

  return { success: true, needsEmailConfirmation: true };
}

export async function resendSignupConfirmation(email: string) {
  const validated = resendSignupConfirmationSchema.safeParse({ email });
  if (validated.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email: validated.data.email });
    if (error) console.error("resendSignupConfirmation failed:", error.code ?? error.status);
  }

  // G5: mọi kết quả đều trả cùng một thông điệp.
  return { success: true, message: RESEND_MESSAGE };
}

export async function requestPasswordRecovery(email: string) {
  const validated = passwordRecoveryRequestSchema.safeParse({ email });
  if (validated.success) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(validated.data.email);
      if (error) console.error("requestPasswordRecovery failed:", error.code ?? error.status);
    } catch {
      console.error("requestPasswordRecovery failed:", "unexpected_failure");
    }
  }
  return { success: true, message: RECOVERY_MESSAGE };
}

// Hàm Đăng nhập
export async function signInUser(formData: FormData) {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!validated.success) return { error: SIGN_IN_FAILED_MESSAGE };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword(validated.data);
  if (error) return { error: SIGN_IN_FAILED_MESSAGE };

  // U3 G1/G2: trang đích chỉ lấy từ cookie proxy ghi và được kiểm tra lại ở đây; trường form nào (next,
  // redirectTo…) cũng không được đọc. Cookie bị xoá sau lần đăng nhập thành công này.
  const cookieStore = await cookies();
  const secure = isHttpsRequest(await headers());
  const redirectTo = resolveReturnPath(cookieStore.get(RETURN_PATH_COOKIE)?.value);
  cookieStore.set(RETURN_PATH_COOKIE, "", expiredReturnPathCookieOptions(secure));
  cookieStore.set(LAST_SIGN_IN_METHOD_COOKIE, "email", lastSignInMethodCookieOptions(secure));

  return { success: true, redirectTo };
}

export async function setPasswordAfterConfirmation(formData: FormData) {
  const validated = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!validated.success) return { error: validated.error.issues[0].message };

  const supabase = await createClient();
  const eligibility = await getPasswordSetupEligibility(supabase);
  if (eligibility.status !== "eligible") return { error: SET_PASSWORD_NOT_ALLOWED_MESSAGE };

  // Đổi bằng chính session vừa xác minh (không dùng admin), để Auth server kiểm session đó.
  const { error: updateError } = await supabase.auth.updateUser({ password: validated.data.password });
  if (updateError) {
    console.error("setPasswordAfterConfirmation updateUser failed:", updateError.code ?? updateError.status);
    if (updateError.code === "same_password") return { error: SAME_PASSWORD_MESSAGE };
    if (updateError.code === "weak_password") return { error: WEAK_PASSWORD_MESSAGE };
    // "Secure password change" đòi nonce khi session quá 24 giờ; app không có UI nonce nên gửi link mới.
    if (updateError.code === "reauthentication_needed") return { error: SET_PASSWORD_SESSION_EXPIRED_MESSAGE };
    return { error: SET_PASSWORD_FAILED_MESSAGE };
  }

  const service = createServiceRoleClient();
  const { error: markerError } = await service
    .from("user_password_setups")
    .insert({ user_id: eligibility.userId });
  // Hai request có thể cùng qua eligibility; trùng khóa nghĩa là marker đã được lưu.
  if (markerError && markerError.code !== "23505") {
    console.error("setPasswordAfterConfirmation marker insert failed:", markerError.code);
  }

  if (eligibility.sessionId) await consumePasswordRecovery(eligibility.userId, eligibility.sessionId);

  redirect("/");
}

// Hàm Đăng xuất
export async function signOutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login"); // Đăng xuất xong đá về trang Login
}

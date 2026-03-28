"use server";

import { createClient } from "@/utils/supabase/server";
import { registerSchema } from "@/lib/schemas/auth";
import { redirect } from "next/navigation";

// Hàm này sẽ nhận FormData từ giao diện bắn lên
export async function signUpUser(formData: FormData) {
  const supabase = await createClient();

  // 1. Lấy dữ liệu thô từ Form
  const rawData = {
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
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

  // 3. Destructuring dữ liệu sạch
  const { email, password, username, full_name, phone, dob, gender } = validated.data;

  let avatar_url = null;
  const avatarFile = formData.get("avatar") as File | null;

  // Nếu có file được gửi lên
  if (avatarFile && avatarFile.size > 0) {
    // Tạo tên file ngẫu nhiên để không bị trùng (vd: 1711234567-abc12.jpg)
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Đẩy ảnh lên bucket tên là 'avatars' trong Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars') 
      .upload(fileName, avatarFile);

    // Nếu đẩy thành công, lấy đường link public của tấm ảnh đó
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      avatar_url = publicUrlData.publicUrl;
    } else {
      console.error("Lỗi upload ảnh:", uploadError);
    }
  }

  // 4. Bắn vào Supabase Auth (Trigger của Khang sẽ hốt metadata này nhét vào Profiles)
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        full_name,
        phone,
        dob: dob.toISOString(), 
        gender,
        avatar_url,
      },
    },
  });

  if (error) return { error: error.message };
  return { success: true, message: "Đăng ký thành công!" };
}

// Hàm Đăng nhập
export async function signInUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Sai email hoặc mật khẩu!" };
  
  return { success: true };
}

// Hàm Đăng xuất
export async function signOutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login"); // Đăng xuất xong đá về trang Login
}
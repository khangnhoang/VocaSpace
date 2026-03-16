"use server";

import { createClient } from "@/utils/supabase/server";
import { registerSchema } from "@/lib/schemas/auth";

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
      },
    },
  });

  if (error) return { error: error.message };
  return { success: true, message: "Đăng ký thành công!" };
}
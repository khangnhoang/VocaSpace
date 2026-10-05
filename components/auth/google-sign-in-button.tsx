"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

const UNAVAILABLE_MESSAGE = "Đăng nhập Google hiện chưa khả dụng";
const FAILED_MESSAGE = "Đăng nhập Google không thành công";

// G3: SDK chỉ dựng URL /authorize và trả `error: null` kể cả khi provider đang tắt, nên người dùng sẽ rời app
// sang trang lỗi của Supabase. Đọc công tắc trước khi redirect; mọi lỗi của bước đọc đều coi như chưa khả dụng.
async function isGoogleEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: { google?: unknown } } | null;
    return settings?.external?.google === true;
  } catch {
    return false;
  }
}

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);

    if (!(await isGoogleEnabled())) {
      toast.error(UNAVAILABLE_MESSAGE);
      setPending(false);
      return;
    }

    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (!error) return; // Giữ nút khóa trong lúc trình duyệt chuyển sang Google.
    } catch {
      // Rơi xuống thông báo lỗi chung bên dưới.
    }
    toast.error(FAILED_MESSAGE);
    setPending(false);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={handleClick}
      className="w-full h-11 cursor-pointer font-medium"
    >
      <FcGoogle className="mr-2 h-5 w-5" /> Đăng nhập bằng Google
    </Button>
  );
}

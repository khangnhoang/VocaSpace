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

// U3 AC6: `lastUsed` gắn nhãn "Lần trước" khi lần đăng nhập gần nhất trên trình duyệt này dùng Google.
export function GoogleSignInButton({ lastUsed = false }: { lastUsed?: boolean }) {
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
      size="lg"
      disabled={pending}
      onClick={handleClick}
      className="h-11 w-full cursor-pointer rounded-[8px] border-slate-500 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-100"
    >
      <FcGoogle aria-hidden="true" className="size-5" />
      Tiếp tục với Google
      {lastUsed ? <LastUsedTag /> : null}
    </Button>
  );
}

export function LastUsedTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-recall-line bg-recall-quiet px-2 py-0.5 font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-semibold text-recall">
      Lần trước
    </span>
  );
}

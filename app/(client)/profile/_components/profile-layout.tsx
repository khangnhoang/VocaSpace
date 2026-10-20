// app/(client)/profile/_components/profile-layout.tsx
"use client";

import { useSyncExternalStore } from "react";
import PaymentHistory, { PaymentHistorySkeleton } from "./payment-history";
import ProfileSidebar, { type ProfileTab } from "./profile-sidebar";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktop(callback: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// Khác `useMediaQuery` của /learn: trả null (chưa biết) lúc SSR và hydration thay vì false, để lịch sử không mount nhầm chỗ
// rồi mount lại ở chỗ đúng, gây đọc hai lần (FEAT6 G4).
function useIsDesktop() {
  return useSyncExternalStore<boolean | null>(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null,
  );
}

/**
 * FEAT6 AC1-AC2: từ lg hai cột 40/60 (thẻ hồ sơ | lịch sử thanh toán); dưới lg lịch sử là tab "Thanh toán" trong thẻ hồ sơ.
 * Chỉ một bản PaymentHistory được mount tại một thời điểm, và chỉ sau khi biết chiều rộng màn hình.
 */
export default function ProfileLayout({ initialTab }: { initialTab: ProfileTab }) {
  const isDesktop = useIsDesktop();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <ProfileSidebar
        initialTab={initialTab}
        isDesktop={isDesktop}
        paymentsPanel={
          isDesktop === null ? (
            <PaymentHistorySkeleton />
          ) : isDesktop ? null : (
            <PaymentHistory />
          )
        }
      />
      {isDesktop !== false && (
        <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:block">
          {isDesktop ? <PaymentHistory /> : <PaymentHistorySkeleton />}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { domMax, LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";
import type { LastSignInMethod } from "@/lib/schemas/auth";
import { AuthShellContext, type AuthPanelState } from "./auth-shell-context";
import { MemoryCurvePanel } from "./memory-curve-panel";
import { WordDeck } from "./word-deck";
import { AutoHeight, SlideIn } from "./auth-motion";

// Thứ tự để chọn hướng trượt khi đổi trang: quên mật khẩu ← đăng nhập → đăng ký.
const ROUTE_ORDER: Record<string, number> = { "/forgot-password": -1, "/login": 0, "/register": 1 };

const LOGIN_PANEL: AuthPanelState = {
  variant: { kind: "login" },
  copy: {
    title: "Ôn đúng lúc sắp quên.",
    text: "VocaSpace dùng FSRS để tính lúc bạn sắp quên từng thẻ và xếp lịch ôn ngay trước đó. Ôn ít lần hơn mà nhớ lâu hơn.",
  },
  showFlashcard: true,
};

const FORGOT_PANEL: AuthPanelState = {
  variant: { kind: "forgot", sent: false },
  copy: {
    title: "Quên là chuyện bình thường.",
    text: "Lâu không ôn thì trí nhớ nào cũng tụt dần. Một lần ôn lại là kéo nó lên.",
  },
};

const REGISTER_PANEL: AuthPanelState = {
  variant: { kind: "register", stage: 1 },
  copy: {
    stage: "CHẶNG 1/5",
    title: "Mỗi bước, một lần ghi nhớ.",
    text: "Đường cong của bạn bắt đầu từ hôm nay. Xong mỗi chặng, nó lại vững thêm một nấc.",
  },
};

function defaultPanelFor(pathname: string): AuthPanelState {
  if (pathname.startsWith("/forgot-password")) return FORGOT_PANEL;
  if (pathname.startsWith("/register")) return REGISTER_PANEL;
  return LOGIN_PANEL;
}

const TABS = [
  { href: "/login", label: "Đăng nhập", Icon: LogIn },
  { href: "/register", label: "Đăng ký", Icon: UserPlus },
] as const;

type AuthShellProps = {
  children: ReactNode;
  lastSignInMethod: LastSignInMethod | null;
  // /auth/set-password nằm ngoài route group nên truyền panel cố định thay vì suy ra từ pathname.
  fixedPanel?: AuthPanelState;
};

export function AuthShell({ children, lastSignInMethod, fixedPanel }: AuthShellProps) {
  const pathname = usePathname() ?? "/login";
  const [panelOverride, setPanelOverride] = useState<AuthPanelState | null>(null);
  const [tabsOverride, setTabsOverride] = useState<boolean | null>(null);
  const [passwordFocused, setPasswordFocusedState] = useState(false);
  const [route, setRoute] = useState({ current: pathname, direction: 1 });
  if (route.current !== pathname) {
    setRoute({ current: pathname, direction: Math.sign((ROUTE_ORDER[pathname] ?? 0) - (ROUTE_ORDER[route.current] ?? 0)) || 1 });
  }

  const setPanel = useCallback((panel: AuthPanelState | null) => setPanelOverride(panel), []);
  const setShowTabs = useCallback((show: boolean | null) => setTabsOverride(show), []);
  const setPasswordFocused = useCallback((focused: boolean) => setPasswordFocusedState(focused), []);

  const panel = panelOverride ?? fixedPanel ?? defaultPanelFor(pathname);
  const onTabRoute = TABS.some((tab) => pathname === tab.href);
  const showTabs = !fixedPanel && (tabsOverride ?? onTabRoute);

  const context = useMemo(
    () => ({ lastSignInMethod, setPanel, setShowTabs, setPasswordFocused }),
    [lastSignInMethod, setPanel, setShowTabs, setPasswordFocused],
  );

  return (
    <AuthShellContext.Provider value={context}>
      <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
      {/* Còn thừa chiều cao (ví dụ tablet dọc) thì card nằm giữa theo chiều dọc, không dồn lên trên (U3 quyết định 16, 17).
          65px là header site h-16 cộng viền dưới; /auth/set-password (fixedPanel) không có header. */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1200px] flex-col justify-center px-4 pt-4 pb-10 sm:px-6 sm:pt-8 sm:pb-16",
          fixedPanel ? "min-h-dvh" : "min-h-[calc(100dvh-65px)]",
        )}
      >
        <div className="mx-auto grid w-full max-w-[480px] gap-1 rounded-[20px] border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.06)] min-[960px]:max-w-none min-[960px]:min-h-[660px] min-[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] min-[960px]:gap-3 min-[960px]:rounded-[24px] min-[960px]:p-3">
          <section className="flex justify-center px-3 pt-5 pb-4 min-[960px]:px-9 min-[960px]:pt-7">
            <div className="flex w-full max-w-[408px] flex-col">
              {showTabs ? (
                <nav aria-label="Đăng nhập hoặc đăng ký" className="mb-7 flex border-b border-slate-200">
                  {TABS.map(({ href, label, Icon }) => {
                    const current = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "relative flex min-h-12 flex-1 items-center justify-center gap-2 rounded-t-[8px] text-sm leading-5 font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route",
                          current ? "text-route" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        )}
                      >
                        <Icon aria-hidden="true" className="size-5" />
                        {label}
                        {current ? (
                          // Panel và thanh tab sống trong layout chung, nên vạch chỉ báo trượt sang tab mới (AC2).
                          <m.span
                            layoutId="auth-tab-indicator"
                            aria-hidden="true"
                            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-route"
                          />
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}
              <AutoHeight>
                <SlideIn motionKey={route.current} direction={route.direction}>
                  {children}
                </SlideIn>
              </AutoHeight>
            </div>
          </section>
          <WordDeck variant={panel.variant} flipped={passwordFocused} />
          <MemoryCurvePanel
            variant={panel.variant}
            copy={panel.copy}
            showFlashcard={Boolean(panel.showFlashcard)}
            flashcardFlipped={passwordFocused}
          />
        </div>
      </div>
      </MotionConfig>
      </LazyMotion>
    </AuthShellContext.Provider>
  );
}

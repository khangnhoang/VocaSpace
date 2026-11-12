"use client";

import { createContext, useContext, useEffect } from "react";
import type { CurveVariant } from "@/lib/auth/memory-curve";
import type { LastSignInMethod } from "@/lib/schemas/auth";

export type AuthPanelCopy = { stage?: string; title: string; text: string };
export type AuthPanelState = { variant: CurveVariant; copy: AuthPanelCopy; showFlashcard?: boolean };

type AuthShellContextValue = {
  lastSignInMethod: LastSignInMethod | null;
  setPanel: (panel: AuthPanelState | null) => void;
  setShowTabs: (show: boolean | null) => void;
  setPasswordFocused: (focused: boolean) => void;
};

export const AuthShellContext = createContext<AuthShellContextValue | null>(null);

export function useAuthShell() {
  const context = useContext(AuthShellContext);
  if (!context) throw new Error("useAuthShell must be used inside AuthShell");
  return context;
}

// Trang con báo cho panel biến thể đang hiển thị; khi trang rời đi thì trả lại mặc định theo pathname.
export function useAuthPanel(panel: AuthPanelState | null) {
  const { setPanel } = useAuthShell();
  const key = panel ? JSON.stringify(panel) : null;
  useEffect(() => {
    setPanel(key ? (JSON.parse(key) as AuthPanelState) : null);
    return () => setPanel(null);
  }, [key, setPanel]);
}

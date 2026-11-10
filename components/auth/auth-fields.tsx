"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, TriangleAlert } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { suggestEmailCorrection } from "@/lib/auth/email-help";
import { cn } from "@/lib/utils";

// U3 G7/AC14: viền slate-500 (#64748B, 4.76:1 trên nền trắng) và focus Route Blue 2px tách khỏi ô, đặt tại chỗ dùng;
// primitive Input dùng chung giữ nguyên.
export const AUTH_INPUT_CLASS =
  "h-11 rounded-[12px] border-slate-500 bg-white px-3.5 text-base leading-6 text-slate-900 placeholder:text-slate-500 hover:border-slate-900 focus-visible:border-route focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route focus-visible:ring-0 aria-invalid:border-correction aria-invalid:ring-0 aria-invalid:shadow-[inset_0_0_0_1px_var(--correction)] md:text-base";

const LABEL_CLASS = "text-sm leading-5 font-semibold text-slate-900";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-[13px] leading-[18px] font-medium text-correction">
      <AlertCircle aria-hidden="true" className="mt-px size-4 shrink-0" />
      {message}
    </p>
  );
}

function describedBy(...ids: Array<string | false | null | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

type EmailFieldProps = {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
  hint?: string;
  labelAside?: ReactNode;
  onApplySuggestion: (value: string) => void;
};

export function EmailField({ id, registration, error, hint, labelAside, onApplySuggestion }: EmailFieldProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const suggestionId = `${id}-suggestion`;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={LABEL_CLASS}>
          Email
        </label>
        {labelAside}
      </div>
      <Input
        id={id}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="ban@example.com"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && hintId, error && errorId, suggestion && suggestionId)}
        className={AUTH_INPUT_CLASS}
        {...registration}
        onChange={(event) => {
          setSuggestion(null);
          void registration.onChange(event);
        }}
        onBlur={(event) => {
          setSuggestion(suggestEmailCorrection(event.target.value));
          void registration.onBlur(event);
        }}
      />
      {hint ? (
        <p id={hintId} className="font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-medium text-slate-500">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
      <div aria-live="polite">
        {suggestion ? (
          <p id={suggestionId} className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[18px] text-slate-600">
            <span>
              Có phải ý bạn là <b className="font-semibold text-slate-900">{suggestion}</b>?
            </span>
            <button
              type="button"
              className="min-h-7 rounded-[6px] px-0.5 font-semibold text-route underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route"
              onClick={() => {
                onApplySuggestion(suggestion);
                setSuggestion(null);
                document.getElementById(id)?.focus();
              }}
            >
              Dùng địa chỉ này
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  autoComplete: "current-password" | "new-password";
  error?: string;
  // Phần mô tả thêm dưới ô (thanh đo độ mạnh, dòng khớp mật khẩu) kèm id để nối aria-describedby.
  details?: { id: string; node: ReactNode };
  onFocusChange?: (focused: boolean) => void;
};

export function PasswordField({ id, label, registration, autoComplete, error, details, onFocusChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const errorId = `${id}-error`;
  const capsId = `${id}-caps`;
  const checkCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"));

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(details?.id, capsLock && capsId, error && errorId)}
          className={cn(AUTH_INPUT_CLASS, "pr-13")}
          {...registration}
          onKeyDown={checkCapsLock}
          onKeyUp={checkCapsLock}
          onFocus={() => onFocusChange?.(true)}
          onBlur={(event) => {
            setCapsLock(false);
            onFocusChange?.(false);
            void registration.onBlur(event);
          }}
        />
        <button
          type="button"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute top-0.5 right-0.5 grid size-10 place-items-center rounded-[10px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-route"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </div>
      {details ? <div id={details.id}>{details.node}</div> : null}
      {capsLock ? (
        <p id={capsId} className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold text-attention">
          <TriangleAlert aria-hidden="true" className="size-4" />
          Caps Lock đang bật
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function AuthNotice({
  tone,
  role,
  children,
  icon,
}: {
  tone: "info" | "error" | "recall";
  role: "status" | "alert";
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <p
      role={role}
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-[12px] border px-3 py-2.5 text-sm leading-[22px]",
        tone === "info" && "border-route-line bg-route-quiet text-route",
        tone === "error" && "border-correction-line bg-correction-quiet text-correction",
        tone === "recall" && "border-recall-line bg-recall-quiet text-slate-900",
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-[18px]", tone === "recall" && "text-recall")}>{icon}</span>
      <span>{children}</span>
    </p>
  );
}

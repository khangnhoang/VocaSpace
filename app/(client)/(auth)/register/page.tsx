"use client";
"use no memo";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { AlertCircle, CalendarIcon, Camera, ChevronRight, Loader2 } from "lucide-react";
import { signUpUserLocalized } from "@/app/actions/auth-localized";
import { AVATAR_INVALID_KEY, registerSchema, type RegisterInput } from "@/lib/schemas/auth";
import { asTranslate, translateIssueMessage } from "@/lib/i18n/translate";
import { heldKey, heldText, resolveHeldMessage, type HeldMessage } from "@/lib/i18n/held-message";
import { registerPanel } from "@/components/auth/auth-panels";
import { prepareAvatar } from "@/lib/auth/avatar-image";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LegalConsentNotice } from "@/components/auth/legal-consent-notice";
import {
  AUTH_LEAD_CLASS,
  AUTH_TEXT_ACTION_CLASS,
  AUTH_TITLE_CLASS,
  AuthDivider,
  AuthNotice,
  EmailField,
  FieldError,
  TextField,
} from "@/components/auth/auth-fields";
import { useAuthPanel, useAuthShell } from "@/components/auth/auth-shell-context";
import { ProgressionRail } from "@/components/auth/progression-rail";
import { cn } from "@/lib/utils";
import { CheckEmailPanel } from "./_components/CheckEmailPanel";
import { SlideIn } from "@/components/auth/auth-motion";

const REGISTER_STAGE_KEYS = ["register.stage1", "register.stage2", "register.stage3", "register.stage4", "register.stage5"] as const;

const DATE_FNS_LOCALES = { vi, en: enUS } as const;

const STEP_FIELDS: Record<1 | 2, (keyof RegisterInput)[]> = {
  1: ["username", "email"],
  2: ["full_name", "phone", "dob", "gender"],
};

const GENDER_OPTIONS = [
  { value: "male", labelKey: "register.genderMale" },
  { value: "female", labelKey: "register.genderFemale" },
  { value: "other", labelKey: "register.genderOther" },
] as const;

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale() === "en" ? "en" : "vi";
  const { setShowTabs } = useAuthShell();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  // Thông báo giữ qua lần đổi ngôn ngữ: khóa hoặc chuỗi gắn ngôn ngữ của request, dịch/lọc lúc render (xem held-message.ts).
  const [serverMessage, setServerError] = useState<HeldMessage | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // Lỗi ảnh lưu dưới dạng cờ và dịch lúc render bằng `validation`, để đổi ngôn ngữ giữa chừng đổi cả chữ lỗi.
  const [hasAvatarError, setHasAvatarError] = useState(false);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const avatarRequest = useRef(0);
  // Email vừa gửi đăng ký; có giá trị thì hiện chặng "kiểm tra email" thay cho form.
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const movedStep = useRef(false);
  const submitting = useRef(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    reValidateMode: "onChange",
    defaultValues: { username: "", email: "", phone: "", full_name: "" },
  });
  const { errors } = form.formState;
  // English localization U1: message của registerSchema là khóa trong namespace `validation`, dịch theo ngôn ngữ đang dùng.
  const tRoot = asTranslate(useTranslations());
  const tValidation = asTranslate(useTranslations("validation"));
  const fieldError = (message: string | undefined) => (message ? translateIssueMessage(tValidation, message) : undefined);
  const serverError = resolveHeldMessage(serverMessage, locale, asTranslate(t), tRoot);
  const avatarError = hasAvatarError ? translateIssueMessage(tValidation, AVATAR_INVALID_KEY) : null;
  const stage = submittedEmail ? 4 : step;
  const [stageMove, setStageMove] = useState({ stage, direction: 1 });
  if (stageMove.stage !== stage) setStageMove({ stage, direction: stage > stageMove.stage ? 1 : -1 });

  useAuthPanel(registerPanel(asTranslate(t), stage));

  useEffect(() => {
    setShowTabs(stage === 1);
    return () => setShowTabs(null);
  }, [stage, setShowTabs]);

  // Đổi bước thì đưa focus về tiêu đề bước mới để trình đọc màn hình đọc đúng ngữ cảnh (AC8); lần mở trang thì không.
  // Sang chặng kiểm tra email, nút vừa bấm biến mất nên focus phải chuyển sang tiêu đề của chặng đó.
  useEffect(() => {
    if (submittedEmail) {
      document.getElementById("check-email-title")?.focus();
      return;
    }
    if (movedStep.current) titleRef.current?.focus();
  }, [step, submittedEmail]);

  const goTo = (next: 1 | 2 | 3) => {
    movedStep.current = true;
    setServerError(null);
    setStep(next);
  };

  const nextStep = async (current: 1 | 2) => {
    const valid = await form.trigger(STEP_FIELDS[current], { shouldFocus: true });
    if (valid) goTo(current === 1 ? 2 : 3);
  };

  // Ảnh gốc có thể vượt 1 MB, giới hạn body của Server Action, nên luôn thu nhỏ trước khi xem trước và gửi. Ảnh không
  // đọc được thì giữ ảnh đang chọn (nếu có) và báo lỗi cạnh ô ảnh; lần chọn mới hơn thắng lần chọn cũ còn đang xử lý.
  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const request = ++avatarRequest.current;
    setHasAvatarError(false);
    setAvatarProcessing(true);
    try {
      const prepared = await prepareAvatar(file);
      if (request !== avatarRequest.current) return;
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(prepared);
      setAvatarPreview(URL.createObjectURL(prepared));
    } catch {
      if (request !== avatarRequest.current) return;
      setHasAvatarError(true);
    } finally {
      if (request === avatarRequest.current) {
        setAvatarProcessing(false);
        // Cho phép chọn lại đúng tệp đó và vẫn kích hoạt onChange.
        input.value = "";
      }
    }
  };

  // Xoá cả giá trị của ô chọn tệp để chọn lại đúng tệp đó vẫn kích hoạt onChange, và trả focus về ô chọn ảnh vì nút
  // "Bỏ ảnh" sắp biến mất.
  const clearAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    avatarRequest.current += 1;
    setAvatarProcessing(false);
    setHasAvatarError(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    const input = document.getElementById("avatar-upload") as HTMLInputElement | null;
    if (input) {
      input.value = "";
      input.focus();
    }
  };

  const onSubmit = async (data: RegisterInput) => {
    if (submitting.current) return;
    submitting.current = true;
    setIsLoading(true);
    setServerError(null);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value instanceof Date ? value.toISOString() : String(value));
    });
    if (avatarFile) formData.append("avatar", avatarFile);

    try {
      const { result: res, ...reply } = await signUpUserLocalized(formData);
      if (res?.error) setServerError(heldText(res.error, reply, "actions.signUpRetry"));
      // Chưa có session: người dùng phải bấm link trong email để xác minh và đặt mật khẩu.
      else setSubmittedEmail(data.email);
    } catch {
      setServerError(heldKey("actions.signUpRetry"));
    } finally {
      setIsLoading(false);
      submitting.current = false;
    }
  };

  const rail = (
    <ProgressionRail
      label={t("register.railLabel")}
      steps={REGISTER_STAGE_KEYS.map((key) => t(key))}
      current={stage}
    />
  );

  if (submittedEmail) {
    return (
      <>
        {rail}
        <SlideIn motionKey={`stage-${stage}`} direction={stageMove.direction}>
          <CheckEmailPanel
            email={submittedEmail}
            // Giữ nguyên giá trị form và file ảnh để gửi lại đúng dữ liệu cũ.
            onEditForm={() => {
              setSubmittedEmail(null);
              goTo(1);
            }}
          />
        </SlideIn>
      </>
    );
  }

  return (
    <>
      {rail}

      <SlideIn motionKey={`stage-${stage}`} direction={stageMove.direction}>
      {step === 1 ? (
        <section aria-labelledby="register-title">
          <h1 id="register-title" ref={titleRef} tabIndex={-1} className={AUTH_TITLE_CLASS}>
            {t("register.title1")}
          </h1>
          <p className={AUTH_LEAD_CLASS}>{t("register.lead1")}</p>
          {/* U3 G10: method="post" để một lần submit trước khi hydrate không đưa dữ liệu lên URL. */}
          <form method="post" noValidate onSubmit={(event) => { event.preventDefault(); void nextStep(1); }} className="grid gap-[18px]">
            <TextField
              id="username"
              label={t("register.username")}
              autoComplete="username"
              hint={t("register.usernameHint")}
              registration={form.register("username")}
              error={fieldError(errors.username?.message)}
            />
            <EmailField
              id="email"
              hint={t("register.emailHint")}
              registration={form.register("email")}
              error={fieldError(errors.email?.message)}
              onApplySuggestion={(value) => form.setValue("email", value, { shouldValidate: Boolean(errors.email) })}
            />
            <Button type="submit" size="lg" className="h-11 w-full rounded-[8px] text-sm font-semibold">
              {t("register.next")}
              <ChevronRight aria-hidden="true" />
            </Button>
          </form>
          <AuthDivider label={t("register.divider")} className="mt-5 mb-4" />
          <GoogleSignInButton />
          <div className="mt-5">
            <LegalConsentNotice />
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="register-title">
          <h1 id="register-title" ref={titleRef} tabIndex={-1} className={AUTH_TITLE_CLASS}>
            {t("register.title2")}
          </h1>
          <p className={AUTH_LEAD_CLASS}>{t("register.lead2")}</p>
          <form method="post" noValidate onSubmit={(event) => { event.preventDefault(); void nextStep(2); }} className="grid gap-[18px]">
            <TextField
              id="full_name"
              label={t("register.fullName")}
              autoComplete="name"
              registration={form.register("full_name")}
              error={fieldError(errors.full_name?.message)}
            />
            <TextField
              id="phone"
              label={t("register.phone")}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={t("register.phonePlaceholder")}
              registration={form.register("phone")}
              error={fieldError(errors.phone?.message)}
            />
            <div className="grid gap-1.5">
              <label id="dob-label" htmlFor="dob" className="text-sm leading-5 font-semibold text-slate-900">
                {t("register.dob")}
              </label>
              <Controller
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="dob"
                        ref={field.ref}
                        type="button"
                        variant="outline"
                        // Tên gồm nhãn và giá trị đang hiển thị để trình đọc màn hình đọc cả ngày đã chọn.
                        aria-labelledby="dob-label dob-value"
                        aria-invalid={errors.dob ? true : undefined}
                        aria-describedby={errors.dob ? "dob-error" : undefined}
                        className={cn(
                          "h-11 w-full justify-between rounded-[12px] border-slate-500 bg-white px-3.5 text-base font-normal hover:border-slate-900 hover:bg-white focus-visible:border-route aria-invalid:border-correction aria-invalid:ring-route",
                          field.value ? "text-slate-900" : "text-slate-500",
                        )}
                      >
                        <span id="dob-value">{field.value ? format(field.value, t("register.dobFormat")) : t("register.dobPlaceholder")}</span>
                        <CalendarIcon aria-hidden="true" className="size-5 text-slate-600" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-50 w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => field.onChange(date)}
                        locale={DATE_FNS_LOCALES[locale]}
                        disabled={(date) => date > new Date() || date < new Date("1900-1-1")}
                        captionLayout="dropdown"
                        fromYear={1950}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              <FieldError id="dob-error" message={fieldError(errors.dob?.message)} />
            </div>
            <fieldset
              className="grid gap-1.5"
              aria-invalid={errors.gender ? true : undefined}
              aria-describedby={errors.gender ? "gender-error" : undefined}
            >
              <legend className="mb-1.5 text-sm leading-5 font-semibold text-slate-900">{t("register.gender")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <label key={option.value} className="relative">
                    <input
                      type="radio"
                      value={option.value}
                      className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
                      {...form.register("gender")}
                    />
                    <span
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] border border-slate-500 text-sm font-semibold text-slate-600 transition-colors peer-hover:bg-slate-100 peer-hover:text-slate-900 peer-checked:border-route peer-checked:bg-route-quiet peer-checked:text-route peer-checked:shadow-[inset_0_0_0_1px_var(--route)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-route",
                        errors.gender && "border-correction",
                      )}
                    >
                      {t(option.labelKey)}
                    </span>
                  </label>
                ))}
              </div>
              <FieldError id="gender-error" message={fieldError(errors.gender?.message)} />
            </fieldset>
            <div className="grid gap-1">
              <Button type="submit" size="lg" className="h-11 w-full rounded-[8px] text-sm font-semibold">
                {t("register.next")}
                <ChevronRight aria-hidden="true" />
              </Button>
              <button type="button" onClick={() => goTo(1)} className={AUTH_TEXT_ACTION_CLASS}>
                {t("register.back")}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 3 ? (
        <section aria-labelledby="register-title">
          <h1 id="register-title" ref={titleRef} tabIndex={-1} className={AUTH_TITLE_CLASS}>
            {t("register.title3")}
          </h1>
          <p className={AUTH_LEAD_CLASS}>{t("register.lead3")}</p>
          <form method="post" noValidate onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} className="grid gap-[18px]">
            <div className="flex flex-col items-center gap-3.5 pt-2 pb-1">
              <div
                className={cn(
                  "grid size-28 place-items-center overflow-hidden rounded-full border-2 bg-slate-100 text-slate-500",
                  avatarPreview ? "border-solid border-route" : "border-dashed border-slate-500",
                )}
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước là blob URL cục bộ, không qua next/image.
                  <img src={avatarPreview} alt={t("register.avatarSelected")} className="size-full object-cover" />
                ) : (
                  <Camera aria-hidden="true" className="size-9" />
                )}
              </div>
              <div className="flex gap-2">
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="peer sr-only"
                  aria-invalid={avatarError ? true : undefined}
                  aria-describedby={avatarError ? "avatar-error" : undefined}
                  onChange={(event) => void handleImageChange(event)}
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-[8px] border border-slate-500 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-route"
                >
                  {avatarPreview ? t("register.avatarChange") : t("register.avatarChoose")}
                </label>
                {avatarPreview ? (
                  <Button type="button" variant="outline" size="lg" onClick={clearAvatar} className="h-11 rounded-[8px] border-slate-500 text-sm font-semibold">
                    {t("register.avatarRemove")}
                  </Button>
                ) : null}
              </div>
              {avatarProcessing ? (
                <p role="status" className="text-[13px] leading-[18px] text-slate-600">
                  {t("register.avatarProcessing")}
                </p>
              ) : null}
              <FieldError id="avatar-error" message={avatarError ?? undefined} />
            </div>
            {serverError ? (
              <AuthNotice tone="error" role="alert" icon={<AlertCircle />}>
                {serverError}
              </AuthNotice>
            ) : null}
            <div className="grid gap-1">
              <Button
                type="submit"
                size="lg"
                disabled={isLoading || avatarProcessing}
                aria-busy={isLoading}
                className="h-11 w-full rounded-[8px] text-sm font-semibold disabled:opacity-100"
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
                    {t("register.creating")}
                  </>
                ) : (
                  t("register.create")
                )}
              </Button>
              <button type="button" onClick={() => goTo(2)} className={AUTH_TEXT_ACTION_CLASS}>
                {t("register.back")}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      </SlideIn>
    </>
  );
}

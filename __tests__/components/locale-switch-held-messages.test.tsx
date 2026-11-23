// @vitest-environment jsdom

import { act, cleanup, fireEvent, renderSwitchable, screen, waitFor } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { MESSAGES } from "@/lib/i18n/messages";
import { recordedTranslations } from "@/lib/i18n/message-ref";
import LoginPage from "@/app/(client)/(auth)/login/page";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailPanel } from "@/app/(client)/(auth)/register/_components/CheckEmailPanel";
import { SetPasswordForm } from "@/app/auth/set-password/_components/SetPasswordForm";
import { PublicCoursePreviewExperience } from "@/app/(client)/courses/[course-slug]/preview/[topic-slug]/_components/PublicCoursePreviewExperience";
import EditProfileForm from "@/app/(client)/profile/_components/edit-profile-form";
import ChangePasswordForm from "@/app/(client)/profile/_components/change-pwd-form";
import ProfileSidebar from "@/app/(client)/profile/_components/profile-sidebar";
import type { PublicCoursePreview } from "@/lib/schemas/public-course-preview";
import type { UserProfileDTO } from "@/lib/schemas/profile";

// Test plan:
// - Mục tiêu: English localization U2, vòng sửa Codex 2 và 3 - thông báo đã hiện hoặc đang chờ phát không còn ở lại bằng ngôn ngữ cũ
//   khi người dùng đổi VI <-> EN, và dữ liệu đang nhập vẫn còn. `router.refresh()` của bộ chọn ngôn ngữ giữ state của component đang
//   mount, nên test đổi locale của provider mà không remount cây (`renderSwitchable`).
// - Loại test: component interaction trong jsdom; Server Action thay tại ranh giới và trả chuỗi như thật. Ngôn ngữ mà SERVER dùng cho
//   request (cookie dùng chung giữa các tab) tách khỏi ngôn ngữ của provider qua `setServerTestLocale`, vì hai giá trị này có thể lệch.
// - Case chính: thông báo do client sở hữu đổi chữ theo ngôn ngữ mới; chuỗi action chỉ hiện khi server dùng đúng ngôn ngữ đang hiển
//   thị, không thì hiện bản chung của client bằng ngôn ngữ của trang; toast phát sau request chờ dùng ngôn ngữ lúc toast bật.
// - Case biên: tab hiện VI nhưng server trả EN (cookie đã đổi ở tab khác); phản hồi về muộn sau khi đổi ngôn ngữ; focus của đăng nhập
//   chỉ chuyển cùng một lỗi đang hiện; email, mật khẩu, đáp án và hồ sơ vẫn được lưu; khi lệch ngôn ngữ vẫn giữ đúng cách khắc phục của
//   lỗi gốc (phiên đặt mật khẩu hết hạn, cần đăng nhập, mật khẩu trùng); hai khóa validation trùng chữ tiếng Anh vẫn ra đúng khóa và lỗi
//   sai kiểu mang tham số `{received}`; toast của form đã unmount vì đổi tab vẫn theo ngôn ngữ lúc bật. Mock của action dịch qua
//   `recordedTranslations` như action thật, vì khóa do action ghi lại chứ không suy từ chuỗi.
//   Ngôn ngữ server được đặt TRƯỚC khi gửi và giữ nguyên tới lúc phản hồi về, vì cookie do tab khác ghi chỉ ảnh hưởng request kế tiếp.
// - Giới hạn: lỗi ảnh và lỗi server của /register, toast mở chủ đề đầu ở thẻ đăng ký, lỗi tải hồ sơ/ảnh ở sidebar dùng cùng helper
//   nhưng chỉ được phủ bằng review mã; vòng đời cookie/refresh thật xem bằng build.

const mocks = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  signInUser: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  setPasswordAfterConfirmation: vi.fn(),
  answer: vi.fn(),
  getFirstTopic: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  pathname: "/login",
}));

vi.mock("@/app/actions/auth", () => ({
  signUpUser: vi.fn(),
  signInUser: mocks.signInUser,
  requestPasswordRecovery: vi.fn(),
  resendSignupConfirmation: mocks.resendSignupConfirmation,
  setPasswordAfterConfirmation: mocks.setPasswordAfterConfirmation,
}));
vi.mock("@/app/actions/profile", () => ({
  getUserProfile: mocks.getUserProfile,
  uploadAvatar: vi.fn(),
  updateUserProfile: mocks.updateUserProfile,
  updateUserPassword: mocks.updateUserPassword,
}));
vi.mock("@/app/actions/public-course-preview", () => ({
  answerPublicCoursePreviewQuestion: mocks.answer,
  getPublicCoursePreview: vi.fn(),
}));
vi.mock("@/app/actions/course-navigation", () => ({ getFirstTopicSlugByCourseSlug: mocks.getFirstTopic }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mocks.pathname,
  unstable_rethrow: vi.fn(),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

type Locale = "vi" | "en";

// Tra chuỗi trong catalog theo namespace và khóa chấm, để test không chép tay chữ của catalog.
function copy(locale: Locale, namespace: "auth" | "profile" | "validation", path: string): string {
  let node: unknown = (MESSAGES[locale] as Record<string, unknown>)[namespace];
  for (const part of path.split(".")) node = (node as Record<string, unknown>)[part];
  if (typeof node !== "string") throw new Error(`Missing catalog string ${namespace}.${path} (${locale})`);
  return node;
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  setServerTestLocale("vi");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setServerTestLocale("vi");
});

type ActionNamespace = "auth.actions" | "profile.actions" | "courses" | "validation";

// Giả lập thông báo mà action thật trả: dịch qua đúng translator ghi khóa mà các action dùng, nên wrapper `*Localized` nhận khóa do
// action chọn (không đoán từ chuỗi). Gọi bên trong mock của action để nằm trong phạm vi của wrapper; chuỗi ra theo ngôn ngữ SERVER.
async function said(namespace: ActionNamespace, key: string, params?: Record<string, string | number>) {
  return (await recordedTranslations(namespace))(key, params);
}

// Request chờ: mock của action giữ lại tới khi test thả, rồi dựng kết quả trong phạm vi của wrapper, nên thông báo được dịch theo ngôn
// ngữ server đã đặt trước khi gửi, còn test chỉ đổi ngôn ngữ của provider trong lúc request đang chờ.
function deferredAction() {
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  let build: () => unknown = () => undefined;
  return {
    run: async () => {
      await gate;
      return build();
    },
    resolveWith(make: () => unknown) {
      build = make;
      release();
    },
  };
}

function fillById(container: HTMLElement, id: string, value: string) {
  fireEvent.change(container.querySelector<HTMLInputElement>(`#${id}`)!, { target: { value } });
}

async function submitLogin(container: HTMLElement) {
  fillById(container, "login-email", "learner@example.com");
  fillById(container, "login-password", "abc123");
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
  });
}

describe("/login keeps no stale-language message after a language switch", () => {
  const renderLogin = () =>
    renderSwitchable(
      <AuthShell lastSignInMethod={null}>
        <LoginPage />
      </AuthShell>,
      "vi",
    );
  const passwordField = (container: HTMLElement) => container.querySelector<HTMLInputElement>("#login-password")!;

  it("re-translates the client-owned network error and keeps the typed values", async () => {
    mocks.signInUser.mockRejectedValue(new Error("offline"));
    const { container, switchLocale } = renderLogin();

    await submitLogin(container);
    expect(await screen.findByText(copy("vi", "auth", "login.networkFailed"))).toBeTruthy();

    await switchLocale("en");

    expect(screen.getByText(copy("en", "auth", "login.networkFailed"))).toBeTruthy();
    expect(screen.queryByText(copy("vi", "auth", "login.networkFailed"))).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#login-email")!.value).toBe("learner@example.com");
    expect(passwordField(container).value).toBe("abc123");
  });

  it("shows the server's message while it matches the page's language, then the client's generic message after a switch", async () => {
    mocks.signInUser.mockImplementation(async () => ({ error: await said("auth.actions", "signInFailed") }));
    const { container, switchLocale } = renderLogin();

    await submitLogin(container);
    expect(await screen.findByText("Sai email hoặc mật khẩu!")).toBeTruthy();
    // Lỗi thường: focus về ô mật khẩu như trước.
    expect(document.activeElement).toBe(passwordField(container));

    await switchLocale("en");
    expect(screen.getByRole("alert").textContent).toBe(copy("en", "auth", "actions.signInFailed"));
    expect(screen.queryByText("Sai email hoặc mật khẩu!")).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#login-email")!.value).toBe("learner@example.com");

    await switchLocale("vi");
    expect(screen.getByRole("alert").textContent).toBe("Sai email hoặc mật khẩu!");
  });

  it("shows the page's language when the server handled the request in the other one (cookie changed in another tab)", async () => {
    // Tab này hiện VI, tab khác đã đổi cookie sang EN, nên server dịch câu trả lời sang EN.
    setServerTestLocale("en");
    mocks.signInUser.mockImplementation(async () => ({ error: await said("auth.actions", "signInFailed") }));
    const { container } = renderLogin();

    await submitLogin(container);

    expect((await screen.findByRole("alert")).textContent).toBe(copy("vi", "auth", "actions.signInFailed"));
    expect(screen.queryByText("Wrong email or password!")).toBeNull();
    expect(document.activeElement).toBe(passwordField(container));
  });

  it("presents a late response in the page's language and moves focus together with it", async () => {
    const pending = deferredAction();
    mocks.signInUser.mockImplementation(pending.run);
    // Cookie đã là EN (do tab khác ghi) trước khi gửi, nên server dịch sang EN; trang đổi sang EN khi request còn chạy.
    setServerTestLocale("en");
    const { container, switchLocale } = renderLogin();

    await submitLogin(container);
    expect(screen.queryByRole("alert")).toBeNull();
    await switchLocale("en");
    container.querySelector<HTMLInputElement>("#login-email")!.focus();
    await act(async () => {
      pending.resolveWith(async () => ({ error: await said("auth.actions", "signInFailed") }));
    });

    expect((await screen.findByRole("alert")).textContent).toBe("Wrong email or password!");
    expect(document.activeElement).toBe(passwordField(container));
    expect(container.querySelector<HTMLInputElement>("#login-email")!.value).toBe("learner@example.com");
  });
});

describe("the check-email panel", () => {
  it("re-translates a failed resend after a switch", async () => {
    mocks.resendSignupConfirmation.mockRejectedValueOnce(new Error("offline"));
    const { switchLocale } = renderSwitchable(<CheckEmailPanel email="learner@example.com" onEditForm={() => {}} />, "vi");

    fireEvent.click(screen.getByRole("button", { name: copy("vi", "auth", "checkEmail.resend") }));
    expect(await screen.findByText(copy("vi", "auth", "checkEmail.resendFailed"))).toBeTruthy();
    await switchLocale("en");
    expect(screen.getByText(copy("en", "auth", "checkEmail.resendFailed"))).toBeTruthy();
    expect(screen.queryByText(copy("vi", "auth", "checkEmail.resendFailed"))).toBeNull();
  });

  it("shows the confirmation in the page's language even when the server answered in the other one", async () => {
    setServerTestLocale("en");
    mocks.resendSignupConfirmation.mockImplementation(async () => ({ message: await said("auth.actions", "resend") }));
    renderSwitchable(<CheckEmailPanel email="learner@example.com" onEditForm={() => {}} />, "vi");

    fireEvent.click(screen.getByRole("button", { name: copy("vi", "auth", "checkEmail.resend") }));

    expect((await screen.findByRole("status")).textContent).toBe(copy("vi", "auth", "actions.resend"));
  });
});

describe("/auth/set-password", () => {
  it("re-translates the server's message after a switch and keeps both password fields", async () => {
    mocks.setPasswordAfterConfirmation.mockImplementation(async () => ({ error: await said("auth.actions", "samePassword") }));
    const { container, switchLocale } = renderSwitchable(<SetPasswordForm />, "vi");

    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText(copy("vi", "auth", "actions.samePassword"))).toBeTruthy();

    await switchLocale("en");

    expect(screen.getByRole("alert").textContent).toBe(copy("en", "auth", "actions.samePassword"));
    expect(container.querySelector<HTMLInputElement>("#new-password")!.value).toBe("abc12345");
    expect(container.querySelector<HTMLInputElement>("#confirm-new-password")!.value).toBe("abc12345");
  });
});

describe("an error the action did not attribute to a catalog key", () => {
  it("falls back to the client's generic message after a switch", async () => {
    // Kết quả không đi qua translator ghi khóa (ví dụ lỗi Zod mặc định không có trong catalog): chỉ còn thông báo chung của client.
    mocks.setPasswordAfterConfirmation.mockResolvedValue({ error: "Invalid input: some unexpected failure" });
    const { container, switchLocale } = renderSwitchable(<SetPasswordForm />, "vi");

    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText("Invalid input: some unexpected failure")).toBeTruthy();

    await switchLocale("en");

    expect(screen.getByRole("alert").textContent).toBe(copy("en", "auth", "actions.setPasswordFailed"));
  });
});

describe("the public course preview", () => {
  const questionId = "55555555-5555-4555-8555-555555555555";
  const optionId = "66666666-6666-4666-8666-666666666666";

  function preview(): PublicCoursePreview {
    return {
      course: { slug: "toeic-foundations", title: "TOEIC foundations" },
      topic: { id: "11111111-1111-4111-8111-111111111111", slug: "opening-topic", title: "Opening topic", description: "A short preview." },
      flashcards: [],
      exercises: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "Practice set",
          activity_stage: "exercise",
          part_type: "part5",
          order_index: 0,
          questions: [],
          groups: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              passage_text: null,
              audio_url: null,
              image_url: null,
              order_index: 0,
              questions: [
                {
                  id: questionId,
                  content: "Choose the correct answer.",
                  order_index: 0,
                  options: [
                    { id: optionId, content: "Option A", label: "A", order_index: 0 },
                    { id: "99999999-9999-4999-8999-999999999999", content: "Option B", label: "B", order_index: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const renderPreview = (isEnrolled = false, data: PublicCoursePreview = preview()) =>
    renderSwitchable(
      <PublicCoursePreviewExperience data={data} isEnrolled={isEnrolled} returnToCourseHref="/courses/toeic-foundations" />,
      "vi",
    );

  it("re-translates the client-owned answer error and keeps the chosen option", async () => {
    mocks.answer.mockRejectedValue(new Error("offline"));
    const { switchLocale } = renderPreview();

    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Không thể kiểm tra câu trả lời"));

    await switchLocale("en");

    expect(screen.getByRole("alert").textContent).toContain("Couldn't check your answer right now");
    expect(screen.getByRole("alert").textContent).not.toContain("Không thể kiểm tra");
    expect(screen.getByRole("radio", { name: "Option A" }).getAttribute("aria-checked")).toBe("true");
  });

  it("re-translates the server's answer error after a switch and keeps the chosen option", async () => {
    mocks.answer.mockImplementation(async () => ({ status: "error", error: await said("courses", "actions.answerError") }));
    const { switchLocale } = renderPreview();

    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Không thể kiểm tra câu trả lời"));

    await switchLocale("en");

    expect(screen.getByRole("alert").textContent).toContain("Couldn't check your answer right now");
    expect(screen.queryByText(/Không thể kiểm tra/)).toBeNull();
    expect(screen.getByRole("radio", { name: "Option A" }).getAttribute("aria-checked")).toBe("true");
  });

  it("shows a late answer error that the server produced in the other language in the page's language", async () => {
    const pending = deferredAction();
    mocks.answer.mockImplementation(pending.run);
    const { switchLocale } = renderPreview();

    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await switchLocale("en");
    // Server vẫn dịch theo cookie cũ (VI), trang đã EN: chuỗi VI không được hiện.
    await act(async () => {
      pending.resolveWith(async () => ({ status: "error", error: await said("courses", "actions.answerError") }));
    });

    expect(screen.queryByText(/Không thể kiểm tra/)).toBeNull();
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't check your answer right now");
  });

  it("re-translates the continue-learning error for an enrolled learner", async () => {
    mocks.getFirstTopic.mockResolvedValue({ error: null, topicSlug: null });
    const card = {
      id: "77777777-7777-4777-8777-777777777777",
      front_content: { word: "alpha" },
      back_content: { translation: "meaning" },
      audio_url: null,
      image_url: null,
      order_index: 0,
    };
    const { switchLocale } = renderPreview(true, { ...preview(), flashcards: [card], exercises: [] });

    // Hết thẻ duy nhất thì phiên xem thử kết thúc và nút "Tiếp tục học" xuất hiện.
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Dễ" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục học" }));
    expect(await screen.findByText("Không tìm thấy chủ đề học đầu tiên.")).toBeTruthy();

    await switchLocale("en");

    expect(screen.getByText("Couldn't find the first topic.")).toBeTruthy();
    expect(screen.queryByText(/Không tìm thấy chủ đề/)).toBeNull();
  });
});

describe("profile toasts fired after a request that outlives a language switch", () => {
  const profile: UserProfileDTO = {
    id: "u1",
    email: "learner@example.com",
    phone: "",
    full_name: "An Nguyen",
    avatar_url: null,
    role: "student",
    username: null,
    dob: null,
    gender: null,
  };

  it("announces the saved profile in the language shown when the request resolves, and still refreshes the data", async () => {
    const pending = deferredAction();
    mocks.updateUserProfile.mockImplementation(pending.run);
    const onRefreshData = vi.fn();
    const { container, switchLocale } = renderSwitchable(<EditProfileForm initialData={profile} onRefreshData={onRefreshData} />, "vi");

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    await switchLocale("en");
    await act(async () => {
      pending.resolveWith(async () => ({ success: true }));
    });

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy("en", "profile", "editForm.saved")));
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(copy("vi", "profile", "editForm.saved"));
    expect(onRefreshData).toHaveBeenCalledTimes(1);
  });

  it("shows the page's language for a failed save when the server answered in the other one", async () => {
    const pending = deferredAction();
    mocks.updateUserProfile.mockImplementation(pending.run);
    const { container, switchLocale } = renderSwitchable(<EditProfileForm initialData={profile} onRefreshData={vi.fn()} />, "vi");

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    await switchLocale("en");
    // Server đã dịch theo cookie cũ (VI) nhưng trang đã EN: toast phải dịch lại đúng thông báo đó sang EN.
    await act(async () => {
      pending.resolveWith(async () => ({ error: await said("profile.actions", "updateFailed") }));
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("en", "profile", "actions.updateFailed")));
    expect(mocks.toastError).not.toHaveBeenCalledWith(copy("vi", "profile", "actions.updateFailed"));
  });

  it("passes the server's message through while it matches the page's language", async () => {
    mocks.updateUserProfile.mockImplementation(async () => ({ error: await said("profile.actions", "updateFailed") }));
    const { container } = renderSwitchable(<EditProfileForm initialData={profile} onRefreshData={vi.fn()} />, "vi");

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("vi", "profile", "actions.updateFailed")));
  });

  it("announces a changed password in the language shown when the request resolves", async () => {
    const pending = deferredAction();
    mocks.updateUserPassword.mockImplementation(pending.run);
    const { container, switchLocale } = renderSwitchable(<ChangePasswordForm />, "vi");
    const [current, next, confirm] = [...container.querySelectorAll<HTMLInputElement>("input[type='password']")];
    fireEvent.change(current, { target: { value: "old-pass-1" } });
    fireEvent.change(next, { target: { value: "new-pass-1" } });
    fireEvent.change(confirm, { target: { value: "new-pass-1" } });

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserPassword).toHaveBeenCalledTimes(1));
    await switchLocale("en");
    await act(async () => {
      pending.resolveWith(async () => ({ success: true }));
    });

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy("en", "profile", "passwordForm.changed")));
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(copy("vi", "profile", "passwordForm.changed"));
  });

  it("shows the page's language for a failed password change when the server answered in the other one", async () => {
    const pending = deferredAction();
    mocks.updateUserPassword.mockImplementation(pending.run);
    const { container, switchLocale } = renderSwitchable(<ChangePasswordForm />, "vi");
    const [current, next, confirm] = [...container.querySelectorAll<HTMLInputElement>("input[type='password']")];
    fireEvent.change(current, { target: { value: "old-pass-1" } });
    fireEvent.change(next, { target: { value: "new-pass-1" } });
    fireEvent.change(confirm, { target: { value: "new-pass-1" } });

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserPassword).toHaveBeenCalledTimes(1));
    await switchLocale("en");
    await act(async () => {
      pending.resolveWith(async () => ({ error: await said("profile.actions", "currentPasswordWrong") }));
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("en", "profile", "actions.currentPasswordWrong")));
    expect(mocks.toastError).not.toHaveBeenCalledWith(copy("vi", "profile", "actions.currentPasswordWrong"));
  });
});

describe("a locale mismatch keeps the remedy of the original error", () => {
  it("shows the expired-session message of /auth/set-password in the page's language, not the generic retry", async () => {
    // Tab hiện VI, cookie đã là EN khi gửi: server trả câu EN của `setPasswordSessionExpired`.
    setServerTestLocale("en");
    mocks.setPasswordAfterConfirmation.mockImplementation(async () => ({ error: await said("auth.actions", "setPasswordSessionExpired") }));
    const { container } = renderSwitchable(<SetPasswordForm />, "vi");

    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    expect((await screen.findByRole("alert")).textContent).toBe(copy("vi", "auth", "actions.setPasswordSessionExpired"));
    expect(screen.queryByText(copy("vi", "auth", "actions.setPasswordFailed"))).toBeNull();
  });

  it("keeps the expired-session message after a switch too", async () => {
    mocks.setPasswordAfterConfirmation.mockImplementation(async () => ({ error: await said("auth.actions", "setPasswordSessionExpired") }));
    const { container, switchLocale } = renderSwitchable(<SetPasswordForm />, "vi");

    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect((await screen.findByRole("alert")).textContent).toBe(copy("vi", "auth", "actions.setPasswordSessionExpired"));
    await switchLocale("en");

    expect(screen.getByRole("alert").textContent).toBe(copy("en", "auth", "actions.setPasswordSessionExpired"));
  });

  it("tells a signed-out profile visitor to sign in, not that the profile was not found", async () => {
    setServerTestLocale("en");
    mocks.getUserProfile.mockImplementation(async () => ({ error: await said("profile.actions", "signInRequired") }));

    renderSwitchable(<ProfileSidebar isDesktop={false} paymentsPanel={null} />, "vi");

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("vi", "profile", "actions.signInRequired")));
    expect(mocks.toastError).not.toHaveBeenCalledWith(copy("vi", "profile", "actions.profileNotFound"));
  });

  it("keeps the same-password advice of the change-password form (an auth message) in the page's language", async () => {
    setServerTestLocale("en");
    mocks.updateUserPassword.mockImplementation(async () => ({ error: await said("auth.actions", "samePassword") }));
    const { container } = renderSwitchable(<ChangePasswordForm />, "vi");
    const [current, next, confirm] = [...container.querySelectorAll<HTMLInputElement>("input[type='password']")];
    fireEvent.change(current, { target: { value: "old-pass-1" } });
    fireEvent.change(next, { target: { value: "new-pass-1" } });
    fireEvent.change(confirm, { target: { value: "new-pass-1" } });

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("vi", "auth", "actions.samePassword")));
    expect(mocks.toastError).not.toHaveBeenCalledWith(copy("vi", "profile", "actions.passwordUpdateFailed"));
  });
});

describe("a locale mismatch keeps the exact validation message the action chose", () => {
  const profile: UserProfileDTO = {
    id: "u1",
    email: "learner@example.com",
    phone: "",
    full_name: "An Nguyen",
    avatar_url: null,
    role: "student",
    username: null,
    dob: null,
    gender: null,
  };

  async function submitProfile() {
    const { container } = renderSwitchable(<EditProfileForm initialData={profile} onRefreshData={vi.fn()} />, "vi");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
  }

  it("shows the profile username message, not the generic failure, when two validation keys share one English text", async () => {
    // Điều kiện của ca: `register.usernameMin` và `profile.usernameMin` trùng chữ tiếng Anh nhưng khác chữ tiếng Việt.
    expect(copy("en", "validation", "register.usernameMin")).toBe(copy("en", "validation", "profile.usernameMin"));
    expect(copy("vi", "validation", "register.usernameMin")).not.toBe(copy("vi", "validation", "profile.usernameMin"));
    setServerTestLocale("en");
    mocks.updateUserProfile.mockImplementation(async () => ({ error: await said("validation", "profile.usernameMin") }));

    await submitProfile();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("vi", "validation", "profile.usernameMin")));
    expect(mocks.toastError).not.toHaveBeenCalledWith(copy("vi", "profile", "actions.updateFailed"));
    expect(mocks.toastError).not.toHaveBeenCalledWith(copy("vi", "validation", "register.usernameMin"));
  });

  it("re-translates a wrong-type message with its {received} parameter", async () => {
    setServerTestLocale("en");
    mocks.updateUserProfile.mockImplementation(async () => ({ error: await said("validation", "zodType.string", { received: "File" }) }));

    await submitProfile();

    const expected = copy("vi", "validation", "zodType.string").replace("{received}", "File");
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expected));
    expect(mocks.toastError).not.toHaveBeenCalledWith(copy("vi", "profile", "actions.updateFailed"));
  });
});

describe("profile toasts of a form that unmounted before the request resolved", () => {
  const profile: UserProfileDTO = {
    id: "u1",
    email: "learner@example.com",
    phone: "",
    full_name: "An Nguyen",
    avatar_url: null,
    role: "student",
    username: null,
    dob: null,
    gender: null,
  };

  async function renderSidebar() {
    mocks.getUserProfile.mockResolvedValue({ data: profile });
    const view = renderSwitchable(<ProfileSidebar isDesktop={false} paymentsPanel={null} />, "vi");
    await waitFor(() => expect(view.container.querySelector("form")).not.toBeNull());
    return view;
  }

  it("announces the saved profile in the language shown when the request resolves, after the form was unmounted by a tab change", async () => {
    const pending = deferredAction();
    mocks.updateUserProfile.mockImplementation(pending.run);
    const { container, switchLocale } = await renderSidebar();

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    // Sang tab Bảo mật: form hồ sơ bị unmount trong lúc request còn chạy, rồi mới đổi ngôn ngữ.
    fireEvent.click(screen.getByRole("button", { name: copy("vi", "profile", "sidebar.tabSecurity") }));
    expect(container.querySelectorAll("input[type='password']").length).toBeGreaterThan(0);
    await switchLocale("en");
    await act(async () => {
      pending.resolveWith(async () => ({ success: true }));
    });

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy("en", "profile", "editForm.saved")));
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(copy("vi", "profile", "editForm.saved"));
    // Dữ liệu vẫn được kéo lại cho thẻ hồ sơ: lần tải đầu và lần làm mới sau khi lưu.
    await waitFor(() => expect(mocks.getUserProfile).toHaveBeenCalledTimes(2));
  });

  it("announces a changed password in the language shown when the request resolves, after the form was unmounted by a tab change", async () => {
    const pending = deferredAction();
    mocks.updateUserPassword.mockImplementation(pending.run);
    const { container, switchLocale } = await renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: copy("vi", "profile", "sidebar.tabSecurity") }));
    const [current, next, confirm] = [...container.querySelectorAll<HTMLInputElement>("input[type='password']")];
    fireEvent.change(current, { target: { value: "old-pass-1" } });
    fireEvent.change(next, { target: { value: "new-pass-1" } });
    fireEvent.change(confirm, { target: { value: "new-pass-1" } });

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserPassword).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: copy("vi", "profile", "sidebar.tabProfile") }));
    expect(container.querySelectorAll("input[type='password']").length).toBe(0);
    await switchLocale("en");
    await act(async () => {
      pending.resolveWith(async () => ({ success: true }));
    });

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy("en", "profile", "passwordForm.changed")));
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(copy("vi", "profile", "passwordForm.changed"));
  });
});

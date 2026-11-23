// @vitest-environment jsdom

import { act, cleanup, fireEvent, renderSwitchable, screen, waitFor } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { MESSAGES } from "@/lib/i18n/messages";
import LoginPage from "@/app/(client)/(auth)/login/page";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailPanel } from "@/app/(client)/(auth)/register/_components/CheckEmailPanel";
import { SetPasswordForm } from "@/app/auth/set-password/_components/SetPasswordForm";
import { PublicCoursePreviewExperience } from "@/app/(client)/courses/[course-slug]/preview/[topic-slug]/_components/PublicCoursePreviewExperience";
import EditProfileForm from "@/app/(client)/profile/_components/edit-profile-form";
import ChangePasswordForm from "@/app/(client)/profile/_components/change-pwd-form";
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
//   chỉ chuyển cùng một lỗi đang hiện; email, mật khẩu, đáp án và hồ sơ vẫn được lưu.
// - Giới hạn: lỗi ảnh và lỗi server của /register, toast mở chủ đề đầu ở thẻ đăng ký, lỗi tải hồ sơ/ảnh ở sidebar dùng cùng helper
//   nhưng chỉ được phủ bằng review mã; vòng đời cookie/refresh thật xem bằng build.

const mocks = vi.hoisted(() => ({
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
  getUserProfile: vi.fn(),
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
function copy(locale: Locale, namespace: "auth" | "profile", path: string): string {
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
    mocks.signInUser.mockResolvedValue({ error: "Sai email hoặc mật khẩu!" });
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
    mocks.signInUser.mockResolvedValue({ error: "Wrong email or password!" });
    const { container } = renderLogin();

    await submitLogin(container);

    expect((await screen.findByRole("alert")).textContent).toBe(copy("vi", "auth", "actions.signInFailed"));
    expect(screen.queryByText("Wrong email or password!")).toBeNull();
    expect(document.activeElement).toBe(passwordField(container));
  });

  it("presents a late response in the page's language and moves focus together with it", async () => {
    const pending = deferred<{ error: string }>();
    mocks.signInUser.mockReturnValue(pending.promise);
    const { container, switchLocale } = renderLogin();

    await submitLogin(container);
    expect(screen.queryByRole("alert")).toBeNull();
    await switchLocale("en");
    // Cookie đã là EN khi phản hồi về: server trả câu EN, trang cũng đã EN.
    setServerTestLocale("en");
    container.querySelector<HTMLInputElement>("#login-email")!.focus();
    await act(async () => {
      pending.resolve({ error: "Wrong email or password!" });
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
    mocks.resendSignupConfirmation.mockResolvedValue({ message: copy("en", "auth", "actions.resend") });
    renderSwitchable(<CheckEmailPanel email="learner@example.com" onEditForm={() => {}} />, "vi");

    fireEvent.click(screen.getByRole("button", { name: copy("vi", "auth", "checkEmail.resend") }));

    expect((await screen.findByRole("status")).textContent).toBe(copy("vi", "auth", "actions.resend"));
  });
});

describe("/auth/set-password", () => {
  it("falls back to the client's generic message after a switch and keeps both password fields", async () => {
    mocks.setPasswordAfterConfirmation.mockResolvedValue({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    const { container, switchLocale } = renderSwitchable(<SetPasswordForm />, "vi");

    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText("Mật khẩu mới phải khác mật khẩu hiện tại.")).toBeTruthy();

    await switchLocale("en");

    expect(screen.getByRole("alert").textContent).toBe(copy("en", "auth", "actions.setPasswordFailed"));
    expect(container.querySelector<HTMLInputElement>("#new-password")!.value).toBe("abc12345");
    expect(container.querySelector<HTMLInputElement>("#confirm-new-password")!.value).toBe("abc12345");
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

  it("falls back to the client's generic answer error after a switch and keeps the chosen option", async () => {
    mocks.answer.mockResolvedValue({ status: "error", error: "Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại." });
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
    const pending = deferred<{ status: "error"; error: string }>();
    mocks.answer.mockReturnValue(pending.promise);
    const { switchLocale } = renderPreview();

    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await switchLocale("en");
    // Server vẫn dịch theo cookie cũ (VI), trang đã EN: chuỗi VI không được hiện.
    await act(async () => {
      pending.resolve({ status: "error", error: "Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại." });
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
    const pending = deferred<{ success: true }>();
    mocks.updateUserProfile.mockReturnValue(pending.promise);
    const onRefreshData = vi.fn();
    const { container, switchLocale } = renderSwitchable(<EditProfileForm initialData={profile} onRefreshData={onRefreshData} />, "vi");

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    await switchLocale("en");
    setServerTestLocale("en");
    await act(async () => {
      pending.resolve({ success: true });
    });

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy("en", "profile", "editForm.saved")));
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(copy("vi", "profile", "editForm.saved"));
    expect(onRefreshData).toHaveBeenCalledTimes(1);
  });

  it("shows the page's language for a failed save when the server answered in the other one", async () => {
    const pending = deferred<{ error: string }>();
    mocks.updateUserProfile.mockReturnValue(pending.promise);
    const { container, switchLocale } = renderSwitchable(<EditProfileForm initialData={profile} onRefreshData={vi.fn()} />, "vi");

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    await switchLocale("en");
    // Server đã dịch theo cookie cũ (VI) nhưng trang đã EN: toast phải dùng thông báo chung bằng EN.
    await act(async () => {
      pending.resolve({ error: "Có lỗi khi cập nhật hồ sơ." });
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("en", "profile", "actions.updateFailed")));
    expect(mocks.toastError).not.toHaveBeenCalledWith("Có lỗi khi cập nhật hồ sơ.");
  });

  it("passes the server's message through while it matches the page's language", async () => {
    mocks.updateUserProfile.mockResolvedValue({ error: "Có lỗi khi cập nhật hồ sơ." });
    const { container } = renderSwitchable(<EditProfileForm initialData={profile} onRefreshData={vi.fn()} />, "vi");

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Có lỗi khi cập nhật hồ sơ."));
  });

  it("announces a changed password in the language shown when the request resolves", async () => {
    const pending = deferred<{ success: true }>();
    mocks.updateUserPassword.mockReturnValue(pending.promise);
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
    setServerTestLocale("en");
    await act(async () => {
      pending.resolve({ success: true });
    });

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy("en", "profile", "passwordForm.changed")));
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(copy("vi", "profile", "passwordForm.changed"));
  });

  it("shows the page's language for a failed password change when the server answered in the other one", async () => {
    const pending = deferred<{ error: string }>();
    mocks.updateUserPassword.mockReturnValue(pending.promise);
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
      pending.resolve({ error: "Mật khẩu hiện tại không đúng." });
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(copy("en", "profile", "actions.passwordUpdateFailed")));
    expect(mocks.toastError).not.toHaveBeenCalledWith("Mật khẩu hiện tại không đúng.");
  });
});

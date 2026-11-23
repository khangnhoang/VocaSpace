// @vitest-environment jsdom

import { act, cleanup, fireEvent, renderSwitchable, screen, waitFor } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(client)/(auth)/login/page";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailPanel } from "@/app/(client)/(auth)/register/_components/CheckEmailPanel";
import { SetPasswordForm } from "@/app/auth/set-password/_components/SetPasswordForm";
import { PublicCoursePreviewExperience } from "@/app/(client)/courses/[course-slug]/preview/[topic-slug]/_components/PublicCoursePreviewExperience";
import type { PublicCoursePreview } from "@/lib/schemas/public-course-preview";

// Test plan:
// - Mục tiêu: English localization U2, vòng sửa Codex 2 - thông báo đã hiện rồi người dùng đổi VI <-> EN không còn ở lại bằng ngôn
//   ngữ cũ, và dữ liệu đang nhập vẫn còn. `router.refresh()` của bộ chọn ngôn ngữ giữ state của component đang mount, nên test đổi
//   locale của provider mà không remount cây (`renderSwitchable`).
// - Loại test: component interaction trong jsdom; Server Action thay tại ranh giới, trả chuỗi đúng ngôn ngữ của request như thật.
// - Case chính: thông báo do client sở hữu (lỗi mạng, gửi lại thất bại, không tìm thấy chủ đề) đổi chữ theo ngôn ngữ mới; chuỗi
//   action trả về (đăng nhập sai, đặt mật khẩu, kiểm tra đáp án, gửi lại email) không còn hiện bằng ngôn ngữ cũ.
// - Case biên: phản hồi action về muộn sau khi đã đổi ngôn ngữ không hiện chữ sai ngôn ngữ; email, mật khẩu và đáp án đã chọn giữ nguyên.
// - Giới hạn: lỗi ảnh của /register dùng cùng helper nhưng chỉ được phủ bằng review mã; vòng đời cookie/refresh thật xem bằng build.

const mocks = vi.hoisted(() => ({
  signInUser: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  setPasswordAfterConfirmation: vi.fn(),
  answer: vi.fn(),
  getFirstTopic: vi.fn(),
  pathname: "/login",
}));

vi.mock("@/app/actions/auth", () => ({
  signUpUser: vi.fn(),
  signInUser: mocks.signInUser,
  requestPasswordRecovery: vi.fn(),
  resendSignupConfirmation: mocks.resendSignupConfirmation,
  setPasswordAfterConfirmation: mocks.setPasswordAfterConfirmation,
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
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
  const renderLogin = () => renderSwitchable(<AuthShell lastSignInMethod={null}><LoginPage /></AuthShell>, "vi");

  it("re-translates the client-owned network error and keeps the typed values", async () => {
    mocks.signInUser.mockRejectedValue(new Error("offline"));
    const { container, switchLocale } = renderLogin();

    await submitLogin(container);
    expect(await screen.findByText("Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.")).toBeTruthy();

    await switchLocale("en");

    expect(screen.getByText("Can't reach the server. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText(/Không thể kết nối/)).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#login-email")!.value).toBe("learner@example.com");
    expect(container.querySelector<HTMLInputElement>("#login-password")!.value).toBe("abc123");
  });

  it("hides the action's message once the language no longer matches the request's, and shows it again on switching back", async () => {
    mocks.signInUser.mockResolvedValue({ error: "Sai email hoặc mật khẩu!" });
    const { container, switchLocale } = renderLogin();

    await submitLogin(container);
    expect(await screen.findByText("Sai email hoặc mật khẩu!")).toBeTruthy();

    await switchLocale("en");
    expect(screen.queryByText("Sai email hoặc mật khẩu!")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#login-email")!.value).toBe("learner@example.com");

    await switchLocale("vi");
    expect(screen.getByText("Sai email hoặc mật khẩu!")).toBeTruthy();
  });

  it("never shows a late response in the language it was not requested in", async () => {
    const pending = deferred<{ error: string }>();
    mocks.signInUser.mockReturnValue(pending.promise);
    const { container, switchLocale } = renderLogin();

    await submitLogin(container);
    await switchLocale("en");
    await act(async () => {
      pending.resolve({ error: "Sai email hoặc mật khẩu!" });
    });

    expect(screen.queryByText("Sai email hoặc mật khẩu!")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // Chữ nhập vẫn còn để người dùng gửi lại bằng ngôn ngữ mới.
    expect(container.querySelector<HTMLInputElement>("#login-email")!.value).toBe("learner@example.com");
  });
});

describe("the check-email panel", () => {
  it("re-translates a failed resend and hides the action's confirmation after a switch", async () => {
    mocks.resendSignupConfirmation.mockRejectedValueOnce(new Error("offline"));
    const { switchLocale } = renderSwitchable(<CheckEmailPanel email="learner@example.com" onEditForm={() => {}} />, "vi");

    fireEvent.click(screen.getByRole("button", { name: "Gửi lại email" }));
    expect(await screen.findByText("Chưa gửi lại được email, vui lòng thử lại sau.")).toBeTruthy();
    await switchLocale("en");
    expect(screen.getByText("Couldn't resend the email. Please try again later.")).toBeTruthy();
    expect(screen.queryByText(/Chưa gửi lại/)).toBeNull();
  });

  it("does not leave the Vietnamese confirmation under English", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.resendSignupConfirmation.mockResolvedValue({ message: "Nếu email đã đăng ký, chúng tôi đã gửi lại thư xác nhận." });
      const { switchLocale } = renderSwitchable(<CheckEmailPanel email="learner@example.com" onEditForm={() => {}} />, "vi");

      fireEvent.click(screen.getByRole("button", { name: "Gửi lại email" }));
      expect(await screen.findByText(/chúng tôi đã gửi lại thư xác nhận/)).toBeTruthy();
      await switchLocale("en");
      expect(screen.queryByText(/chúng tôi đã gửi lại/)).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("/auth/set-password", () => {
  it("hides the action's error after a switch and keeps both password fields", async () => {
    mocks.setPasswordAfterConfirmation.mockResolvedValue({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    const { container, switchLocale } = renderSwitchable(<SetPasswordForm />, "vi");

    fillById(container, "new-password", "abc12345");
    fillById(container, "confirm-new-password", "abc12345");
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(await screen.findByText("Mật khẩu mới phải khác mật khẩu hiện tại.")).toBeTruthy();

    await switchLocale("en");

    expect(screen.queryByText(/Mật khẩu mới phải khác/)).toBeNull();
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

  it("hides the action's answer error after a switch and keeps the chosen option", async () => {
    mocks.answer.mockResolvedValue({ status: "error", error: "Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại." });
    const { switchLocale } = renderPreview();

    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Không thể kiểm tra câu trả lời"));

    await switchLocale("en");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Không thể kiểm tra/)).toBeNull();
    expect(screen.getByRole("radio", { name: "Option A" }).getAttribute("aria-checked")).toBe("true");
  });

  it("ignores a late answer error that was produced for the previous language", async () => {
    const pending = deferred<{ status: "error"; error: string }>();
    mocks.answer.mockReturnValue(pending.promise);
    const { switchLocale } = renderPreview();

    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await switchLocale("en");
    await act(async () => {
      pending.resolve({ status: "error", error: "Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại." });
    });

    expect(screen.queryByText(/Không thể kiểm tra/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
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

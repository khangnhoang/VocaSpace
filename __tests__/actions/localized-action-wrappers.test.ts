import { afterEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { MESSAGES } from "@/lib/i18n/messages";

// Test plan:
// - Mục tiêu: English localization U2, vòng sửa Codex 3 - các wrapper `*Localized` giữ nguyên kết quả của action gốc và kèm ngôn ngữ
//   mà server dùng cho request cùng khóa catalog của thông báo, để client không hiện chuỗi sai ngôn ngữ và vẫn dịch lại đúng thông báo
//   (cách khắc phục khác nhau) khi cookie bị đổi ở tab khác. Ngôn ngữ server được đặt trước khi gửi, không đổi giữa chừng.
// - Loại test: unit ở ranh giới Server Action; action gốc được thay bằng mock vì wrapper không thêm quyền hay logic nào.
// - Case chính: kết quả được trả nguyên vẹn trong `result`; `locale` theo cookie của request (vi, en).
// - Case biên: lỗi hoặc redirect do action gốc ném ra vẫn đi qua wrapper, không bị nuốt hay đổi thành kết quả.
// - Giới hạn: không kiểm tra auth hay nghiệp vụ của action gốc; các test của chúng nằm ở nơi khác.

const mocks = vi.hoisted(() => ({
  signInUser: vi.fn(),
  setPasswordAfterConfirmation: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn(),
  answer: vi.fn(),
  getFirstTopic: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  signInUser: mocks.signInUser,
  signUpUser: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  setPasswordAfterConfirmation: mocks.setPasswordAfterConfirmation,
}));
vi.mock("@/app/actions/profile", () => ({
  getUserProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  updateUserProfile: mocks.updateUserProfile,
  updateUserPassword: mocks.updateUserPassword,
}));
vi.mock("@/app/actions/public-course-preview", () => ({ answerPublicCoursePreviewQuestion: mocks.answer }));
vi.mock("@/app/actions/course-navigation", () => ({ getFirstTopicSlugByCourseSlug: mocks.getFirstTopic }));

import { setPasswordAfterConfirmationLocalized, signInUserLocalized } from "@/app/actions/auth-localized";
import { updateUserPasswordLocalized, updateUserProfileLocalized } from "@/app/actions/profile-localized";
import { answerPublicCoursePreviewQuestionLocalized } from "@/app/actions/public-course-preview-localized";
import { getFirstTopicSlugByCourseSlugLocalized } from "@/app/actions/course-navigation-localized";

const EN_SESSION_EXPIRED = MESSAGES.en.auth.actions.setPasswordSessionExpired;

afterEach(() => {
  vi.clearAllMocks();
  setServerTestLocale("vi");
});

describe("localized Server Action wrappers", () => {
  it("returns the original result untouched together with the request's locale", async () => {
    const formData = new FormData();
    mocks.signInUser.mockResolvedValue({ error: "Sai email hoặc mật khẩu!" });

    await expect(signInUserLocalized(formData)).resolves.toEqual({
      result: { error: "Sai email hoặc mật khẩu!" },
      locale: "vi",
      messageKey: "auth.actions.signInFailed",
    });
    expect(mocks.signInUser).toHaveBeenCalledWith(formData);
  });

  it("reports the locale the server used, not a fixed one", async () => {
    setServerTestLocale("en");
    mocks.updateUserProfile.mockResolvedValue({ success: true });

    await expect(updateUserProfileLocalized({ full_name: "An" } as never)).resolves.toEqual({ result: { success: true }, locale: "en", messageKey: null });
  });

  it("reports the locale in effect for the request and the catalog key of the message", async () => {
    // Cookie của request đã là EN khi gửi (tab khác ghi trước đó); giữ nguyên tới lúc action trả về.
    setServerTestLocale("en");
    mocks.setPasswordAfterConfirmation.mockResolvedValue({ error: EN_SESSION_EXPIRED });

    const response = await setPasswordAfterConfirmationLocalized(new FormData());

    expect(response).toEqual({
      result: { error: EN_SESSION_EXPIRED },
      locale: "en",
      messageKey: "auth.actions.setPasswordSessionExpired",
    });
  });

  it("finds keys in the extra namespaces of the profile wrapper", async () => {
    mocks.updateUserPassword.mockResolvedValue({ error: MESSAGES.vi.auth.actions.samePassword });

    const response = await updateUserPasswordLocalized({} as never);

    expect(response.messageKey).toBe("auth.actions.samePassword");
  });

  it("returns no key for a message that is not in the catalog or matches two keys", async () => {
    mocks.signInUser.mockResolvedValue({ error: "an unknown message" });
    await expect(signInUserLocalized(new FormData())).resolves.toMatchObject({ messageKey: null });

    // `courses.preview.answerFailed` và `courses.actions.answerError` có cùng chữ nên không biết khóa nào đúng ý.
    mocks.answer.mockResolvedValue({ status: "error", error: MESSAGES.vi.courses.actions.answerError });
    await expect(answerPublicCoursePreviewQuestionLocalized({} as never)).resolves.toMatchObject({ messageKey: null });
  });

  it("passes the first-topic lookup through", async () => {
    mocks.getFirstTopic.mockResolvedValue({ error: null, topicSlug: "opening-topic" });

    await expect(getFirstTopicSlugByCourseSlugLocalized("toeic-foundations")).resolves.toEqual({
      result: { error: null, topicSlug: "opening-topic" },
      locale: "vi",
      messageKey: null,
    });
  });

  it("lets a failure or redirect thrown by the original action propagate", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
    mocks.setPasswordAfterConfirmation.mockRejectedValue(redirect);

    await expect(setPasswordAfterConfirmationLocalized(new FormData())).rejects.toBe(redirect);
  });
});

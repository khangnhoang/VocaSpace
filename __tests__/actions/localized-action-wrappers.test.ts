import { afterEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";

// Test plan:
// - Mục tiêu: English localization U2, vòng sửa Codex 3 - các wrapper `*Localized` giữ nguyên kết quả của action gốc và kèm ngôn ngữ
//   mà server dùng cho request, để client không hiện chuỗi sai ngôn ngữ khi cookie bị đổi ở tab khác.
// - Loại test: unit ở ranh giới Server Action; action gốc được thay bằng mock vì wrapper không thêm quyền hay logic nào.
// - Case chính: kết quả được trả nguyên vẹn trong `result`; `locale` theo cookie của request (vi, en).
// - Case biên: lỗi hoặc redirect do action gốc ném ra vẫn đi qua wrapper, không bị nuốt hay đổi thành kết quả.
// - Giới hạn: không kiểm tra auth hay nghiệp vụ của action gốc; các test của chúng nằm ở nơi khác.

const mocks = vi.hoisted(() => ({
  signInUser: vi.fn(),
  setPasswordAfterConfirmation: vi.fn(),
  updateUserProfile: vi.fn(),
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
  updateUserPassword: vi.fn(),
}));
vi.mock("@/app/actions/public-course-preview", () => ({ answerPublicCoursePreviewQuestion: mocks.answer }));
vi.mock("@/app/actions/course-navigation", () => ({ getFirstTopicSlugByCourseSlug: mocks.getFirstTopic }));

import { setPasswordAfterConfirmationLocalized, signInUserLocalized } from "@/app/actions/auth-localized";
import { updateUserProfileLocalized } from "@/app/actions/profile-localized";
import { answerPublicCoursePreviewQuestionLocalized } from "@/app/actions/public-course-preview-localized";
import { getFirstTopicSlugByCourseSlugLocalized } from "@/app/actions/course-navigation-localized";

afterEach(() => {
  vi.clearAllMocks();
  setServerTestLocale("vi");
});

describe("localized Server Action wrappers", () => {
  it("returns the original result untouched together with the request's locale", async () => {
    const formData = new FormData();
    mocks.signInUser.mockResolvedValue({ error: "Sai email hoặc mật khẩu!" });

    await expect(signInUserLocalized(formData)).resolves.toEqual({ result: { error: "Sai email hoặc mật khẩu!" }, locale: "vi" });
    expect(mocks.signInUser).toHaveBeenCalledWith(formData);
  });

  it("reports the locale the server used, not a fixed one", async () => {
    setServerTestLocale("en");
    mocks.updateUserProfile.mockResolvedValue({ success: true });

    await expect(updateUserProfileLocalized({ full_name: "An" } as never)).resolves.toEqual({ result: { success: true }, locale: "en" });
  });

  it("reads the locale after the action resolved, so a cookie change during the request is reflected", async () => {
    mocks.answer.mockImplementation(async () => {
      setServerTestLocale("en");
      return { status: "error", error: "Couldn't check your answer right now. Please try again." };
    });

    const response = await answerPublicCoursePreviewQuestionLocalized({} as never);

    expect(response.locale).toBe("en");
    expect(response.result).toEqual({ status: "error", error: "Couldn't check your answer right now. Please try again." });
  });

  it("passes the first-topic lookup through", async () => {
    mocks.getFirstTopic.mockResolvedValue({ error: null, topicSlug: "opening-topic" });

    await expect(getFirstTopicSlugByCourseSlugLocalized("toeic-foundations")).resolves.toEqual({
      result: { error: null, topicSlug: "opening-topic" },
      locale: "vi",
    });
  });

  it("lets a failure or redirect thrown by the original action propagate", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
    mocks.setPasswordAfterConfirmation.mockRejectedValue(redirect);

    await expect(setPasswordAfterConfirmationLocalized(new FormData())).rejects.toBe(redirect);
  });
});

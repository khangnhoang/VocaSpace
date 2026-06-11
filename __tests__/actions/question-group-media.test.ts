import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadQuestionGroupImage } from "@/app/actions/exercise";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

const mocks = vi.hoisted(() => {
  let profileRole = "teacher";

  const storageBucket = {
    upload: vi.fn(async () => ({ error: null })),
    getPublicUrl: vi.fn((path: string) => ({
      data: {
        publicUrl: `https://project.supabase.co/storage/v1/object/public/question_group_images/${path}`,
      },
    })),
    remove: vi.fn(async () => ({ error: null })),
  };

  const supabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: { role: profileRole },
        error: null,
      })),
    })),
    storage: {
      from: vi.fn(() => storageBucket),
    },
  };

  return {
    supabase,
    storageBucket,
    setProfileRole: (role: string) => {
      profileRole = role;
    },
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mocks.supabase)),
}));

function imageUploadFormData() {
  const formData = new FormData();
  formData.append("file", new File([pngBytes], "question.png", { type: "image/png" }));
  return formData;
}

describe("question group media upload actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setProfileRole("teacher");
    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "teacher-1" } },
      error: null,
    });
  });

  it("rejects unauthenticated users before uploading", async () => {
    mocks.supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("No user"),
    });

    const result = await uploadQuestionGroupImage(imageUploadFormData());

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("Phiên đăng nhập đã hết hạn");
    expect(mocks.storageBucket.upload).not.toHaveBeenCalled();
  });

  it("rejects non-teacher and non-admin users before uploading", async () => {
    mocks.setProfileRole("student");

    const result = await uploadQuestionGroupImage(imageUploadFormData());

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("không có quyền tải lên media");
    expect(mocks.storageBucket.upload).not.toHaveBeenCalled();
  });

  it("uploads valid teacher media with a generated safe path", async () => {
    const result = await uploadQuestionGroupImage(imageUploadFormData());

    expect("success" in result).toBe(true);
    if (!("success" in result)) return;
    expect(result.data.bucket).toBe("question_group_images");
    expect(result.data.path).toMatch(/^teacher-1\/.+\.png$/);
    expect(result.data.publicUrl).toContain("question_group_images");
    expect(mocks.storageBucket.upload).toHaveBeenCalledWith(
      result.data.path,
      expect.any(File),
      { contentType: "image/png", upsert: false },
    );
  });
});

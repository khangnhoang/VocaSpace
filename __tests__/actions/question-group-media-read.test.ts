// Test plan:
// - Mục tiêu: GET media chỉ phân phối managed object gắn với group đã được RLS cho đọc.
// - Loại test: Route Handler với Supabase boundary mock.
// - Đối tượng: GET /api/question-group-media/[groupId]/[type].
// - Case thành công: image được trả no-store; audio Range trả 206 đúng byte.
// - Case thất bại: group bị RLS ẩn, external URL, hoặc path sai parent đều trả 404.
// - Bảo mật/phân quyền: không nhận path/URL từ request và không tải object khi group bị deny.
// - Ổn định/resilience: Range không hợp lệ trả 416.
// - Invariant cần giữ: Storage download chỉ xảy ra sau group + parent + managed-reference checks.
// - Kết quả verify gần nhất: passed bằng `npm.cmd test -- --run __tests__/actions/question-group-media-read.test.ts __tests__/components/question-group-media-field.test.tsx __tests__/schemas/exercise-media.test.ts __tests__/actions/question-group-media.test.ts`.
// - Ghi chú: real RLS/Storage evidence thuộc integration tests.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/question-group-media/[groupId]/[type]/route";

const groupId = "11111111-1111-4111-8111-111111111111";
const path = "22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444/55555555-5555-4555-8555-555555555555.mp3";

const mocks = vi.hoisted(() => {
  let group: { exercise_id: string; audio_url: string | null; image_url: string | null } | null = null;
  let exercise: { course_id: string; topic_id: string } | null = null;
  const download = vi.fn();
  const client = {
    auth: { getUser: vi.fn() },
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            single: async () => ({
              data: table === "question_groups" ? group : exercise,
              error: null,
            }),
          }),
        }),
      }),
    })),
    storage: { from: vi.fn(() => ({ download })) },
  };
  return {
    client,
    download,
    setGroup: (value: typeof group) => { group = value; },
    setExercise: (value: typeof exercise) => { exercise = value; },
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => mocks.client),
}));

function request(type: "image" | "audio", range?: string) {
  return GET(
    new Request(`http://localhost/api/question-group-media/${groupId}/${type}`, {
      headers: range ? { Range: range } : {},
    }),
    { params: Promise.resolve({ groupId, type }) },
  );
}

describe("question-group managed media GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null });
    mocks.setGroup({
      exercise_id: "exercise",
      audio_url: `storage://question_group_audios/${path}`,
      image_url: null,
    });
    mocks.setExercise({
      course_id: "22222222-2222-4222-8222-222222222222",
      topic_id: "33333333-3333-4333-8333-333333333333",
    });
    mocks.download.mockResolvedValue({ data: new Blob(["abcdef"], { type: "audio/mpeg" }), error: null });
  });

  it("serves an authorized managed object without public caching", async () => {
    const response = await request("audio");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toBe("abcdef");
    expect(mocks.client.storage.from).toHaveBeenCalledWith("question_group_audios");
    expect(mocks.download).toHaveBeenCalledWith(path);
  });

  it("resolves a persisted legacy public URL from the configured Storage origin", async () => {
    const oldOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:45321";
    try {
      mocks.setGroup({
        exercise_id: "exercise",
        audio_url: `http://127.0.0.1:45321/storage/v1/object/public/question_group_audios/${path}`,
        image_url: null,
      });
      expect((await request("audio")).status).toBe(200);
      expect(mocks.download).toHaveBeenCalledWith(path);
    } finally {
      if (oldOrigin === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = oldOrigin;
    }
  });

  it("returns the requested byte range and rejects invalid ranges", async () => {
    const response = await request("audio", "bytes=1-3");
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 1-3/6");
    expect(await response.text()).toBe("bcd");

    const invalid = await request("audio", "bytes=8-10");
    expect(invalid.status).toBe(416);
  });

  it("does not download when RLS hides the group or the reference is external", async () => {
    mocks.setGroup(null);
    expect((await request("audio")).status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();

    mocks.setGroup({ exercise_id: "exercise", audio_url: "https://cdn.example.com/audio.mp3", image_url: null });
    expect((await request("audio")).status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("rejects a managed object belonging to another course or topic", async () => {
    mocks.setExercise({ course_id: "other-course", topic_id: "other-topic" });
    expect((await request("audio")).status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});

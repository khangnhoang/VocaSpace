import { describe, expect, it } from "vitest";
import { arrangeMaterial } from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/exercise-arrangement";
import type { QuestionGroupDTO } from "@/lib/schemas/learn";

// Test plan:
// - Mục tiêu: bảo vệ cách sắp xếp ngữ liệu theo TOEIC Part 1-7 trong learning workspace D8-LUI.
// - Loại test: unit test cho hàm thuần `arrangeMaterial`.
// - Đối tượng: thứ tự ngữ liệu, layout `none/band/split`, ngữ liệu bắt buộc bị thiếu.
// - Case thành công: Part 1 ảnh trước audio và ảnh chiếm phần lớn; Part 2-4 audio dạng band; Part 6-7 đoạn văn cạnh câu hỏi; standalone không có ngữ liệu.
// - Case thất bại: nhóm thiếu ngữ liệu bắt buộc được báo là `missing`, không bị che bằng placeholder.
// - Invariant cần giữ: chỉ sắp xếp ngữ liệu mà nhóm thật sự có; không bịa trường mới; part lạ vẫn hiển thị mọi ngữ liệu có sẵn.

const group = (overrides: Partial<QuestionGroupDTO> = {}): QuestionGroupDTO => ({
  id: "b0000000-0000-4000-8000-000000000001",
  order_index: 1,
  questions: [],
  passage_text: null,
  audio_url: null,
  image_url: null,
  ...overrides,
});

describe("arrangeMaterial", () => {
  it("makes the picture the dominant material for Part 1 and keeps audio after it", () => {
    const result = arrangeMaterial(
      "part1",
      group({ image_url: "/api/question-group-media/g/image", audio_url: "/api/question-group-media/g/audio" }),
      false,
    );
    expect(result).toEqual({ kinds: ["image", "audio"], layout: "split", dominant: "image", missing: [] });
  });

  it.each(["part2", "part3", "part4"])("uses a compact audio band for %s without an illustration", (part) => {
    const result = arrangeMaterial(part, group({ audio_url: "/api/question-group-media/g/audio" }), false);
    expect(result.kinds).toEqual(["audio"]);
    expect(result.layout).toBe("band");
    expect(result.missing).toEqual([]);
  });

  it("keeps an optional illustration with dialogue audio and reads audio first", () => {
    const result = arrangeMaterial(
      "part3",
      group({ audio_url: "/a", image_url: "/i" }),
      false,
    );
    expect(result.kinds).toEqual(["audio", "image"]);
    expect(result.layout).toBe("split");
    expect(result.dominant).toBe("text");
  });

  it.each(["part6", "part7"])("places the passage beside the question for %s", (part) => {
    const result = arrangeMaterial(part, group({ passage_text: "Đoạn\nvăn" }), false);
    expect(result).toEqual({ kinds: ["passage"], layout: "split", dominant: "text", missing: [] });
  });

  it("reads the passage before an optional document image in Part 7", () => {
    const result = arrangeMaterial("part7", group({ passage_text: "Text", image_url: "/i" }), false);
    expect(result.kinds).toEqual(["passage", "image"]);
  });

  it("gives standalone questions no material region", () => {
    expect(arrangeMaterial("part5", group(), true)).toEqual({
      kinds: [],
      layout: "none",
      dominant: "text",
      missing: [],
    });
  });

  it("reports required material the group does not carry", () => {
    expect(arrangeMaterial("part1", group({ audio_url: "/a" }), false).missing).toEqual(["image"]);
    expect(arrangeMaterial("part2", group(), false).missing).toEqual(["audio"]);
    expect(arrangeMaterial("part6", group({ passage_text: "   " }), false).missing).toEqual(["passage"]);
  });

  it("still shows every available material for an unknown part", () => {
    const result = arrangeMaterial("part_x", group({ audio_url: "/a", passage_text: "T" }), false);
    expect(result.kinds).toEqual(["audio", "passage"]);
    expect(result.missing).toEqual([]);
  });
});

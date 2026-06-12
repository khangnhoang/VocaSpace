import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import QuestionGroupMediaField, {
  QuestionGroupMediaPreview,
} from "@/app/(teacher)/courses/[id]/topics/[topicId]/_components/QuestionGroupMediaField";

vi.mock("@/app/actions/exercise", () => ({
  deleteQuestionGroupMedia: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("QuestionGroupMediaField UI", () => {
  it("uses a hidden file input with a custom upload button", () => {
    const html = renderToStaticMarkup(
      <QuestionGroupMediaField
        type="audio"
        label="Audio"
        value=""
        onChange={() => {}}
        initialMode="upload"
      />,
    );

    expect(html).toContain('type="file"');
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("Chọn tệp âm thanh");
    expect(html).not.toContain("No file chosen");
  });

  it("renders a playable audio preview affordance for valid audio URLs", () => {
    const html = renderToStaticMarkup(
      <QuestionGroupMediaPreview
        type="audio"
        value="https://github.com/rafaelreis-hotmart/Audio-Sample-files/raw/master/sample.mp3"
      />,
    );

    expect(html).toContain("Âm thanh nhóm câu hỏi");
    expect(html).toContain("Phát");
    expect(html).toContain("<audio");
  });

  it("renders an inline expandable image preview affordance for valid image URLs", () => {
    const html = renderToStaticMarkup(
      <QuestionGroupMediaPreview
        type="image"
        value="https://placehold.co/600x400.png"
      />,
    );

    expect(html).toContain("Hình ảnh nhóm câu hỏi");
    expect(html).toContain("Xem");
    expect(html).not.toContain("<img");
  });

  it("does not render preview affordances for invalid URLs", () => {
    const html = renderToStaticMarkup(
      <QuestionGroupMediaPreview type="image" value="asdasd" />,
    );

    expect(html).toBe("");
  });

  it("renders inline invalid URL error state", () => {
    const html = renderToStaticMarkup(
      <QuestionGroupMediaField
        type="image"
        label="Hình ảnh"
        value="asdasd"
        onChange={() => {}}
        error="Link hình ảnh không hợp lệ hoặc không đúng định dạng"
      />,
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Link hình ảnh không hợp lệ");
    expect(html).not.toContain("<img");
  });
});

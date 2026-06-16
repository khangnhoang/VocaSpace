import { describe, expect, it } from "vitest";
import {
  QUESTION_GROUP_AUDIO_MAX_SIZE_BYTES,
  QUESTION_GROUP_IMAGE_MAX_SIZE_BYTES,
  isValidQuestionGroupMediaUrl,
  questionGroupAudioUrlSchema,
  questionGroupImageUrlSchema,
  validateQuestionGroupMediaFile,
} from "@/lib/schemas/exercise";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);

describe("question group media validation", () => {
  it("accepts valid HTTPS image and audio URLs", () => {
    expect(
      isValidQuestionGroupMediaUrl(
        "image",
        "https://cdn.example.com/media/photo.webp?cache=1",
      ),
    ).toBe(true);
    expect(
      isValidQuestionGroupMediaUrl(
        "audio",
        "https://cdn.example.com/media/listening.mp3?cache=1",
      ),
    ).toBe(true);
  });

  it("accepts manual QA image and audio URLs", () => {
    expect(
      isValidQuestionGroupMediaUrl("image", "https://placehold.co/600x400.png"),
    ).toBe(true);
    expect(
      isValidQuestionGroupMediaUrl(
        "audio",
        "https://github.com/rafaelreis-hotmart/Audio-Sample-files/raw/master/sample.mp3",
      ),
    ).toBe(true);
  });

  it("ignores query strings when checking media URL extensions", () => {
    expect(
      isValidQuestionGroupMediaUrl(
        "image",
        "https://cdn.example.com/media/photo.png?download=audio.mp3",
      ),
    ).toBe(true);
    expect(
      isValidQuestionGroupMediaUrl(
        "audio",
        "https://cdn.example.com/media/listening.webm?download=photo.png",
      ),
    ).toBe(true);
  });

  it("accepts local Supabase dev URLs", () => {
    expect(
      isValidQuestionGroupMediaUrl(
        "image",
        "http://127.0.0.1:45321/storage/v1/object/public/question_group_images/user-id/file",
      ),
    ).toBe(true);
    expect(
      isValidQuestionGroupMediaUrl(
        "audio",
        "http://localhost:45321/storage/v1/object/public/question_group_audios/user-id/file",
      ),
    ).toBe(true);
  });

  it("allows empty media fields", () => {
    expect(questionGroupImageUrlSchema.parse("")).toBeUndefined();
    expect(questionGroupAudioUrlSchema.parse("   ")).toBeUndefined();
    expect(questionGroupImageUrlSchema.parse(null)).toBeUndefined();
  });

  it("rejects unsafe protocols and arbitrary external http URLs", () => {
    expect(isValidQuestionGroupMediaUrl("image", "javascript:alert(1)")).toBe(false);
    expect(isValidQuestionGroupMediaUrl("image", "data:image/png;base64,abc")).toBe(false);
    expect(isValidQuestionGroupMediaUrl("audio", "file:///tmp/audio.mp3")).toBe(false);
    expect(isValidQuestionGroupMediaUrl("audio", "blob:https://example.com/id")).toBe(false);
    expect(isValidQuestionGroupMediaUrl("image", "ftp://example.com/photo.jpg")).toBe(false);
    expect(isValidQuestionGroupMediaUrl("image", "http://example.com/photo.jpg")).toBe(false);
  });

  it("rejects wrong media extensions when the URL is not a matching Storage public URL", () => {
    expect(isValidQuestionGroupMediaUrl("image", "https://example.com/audio.mp3")).toBe(false);
    expect(isValidQuestionGroupMediaUrl("audio", "https://example.com/photo.png")).toBe(false);
  });

  it("rejects SVG media URLs", () => {
    expect(isValidQuestionGroupMediaUrl("image", "https://example.com/vector.svg")).toBe(false);
  });

  it("accepts allowed file MIME, extension, size, and magic bytes", async () => {
    const image = new File([pngBytes], "question.png", { type: "image/png" });
    const audio = new File([mp3Bytes], "listening.mp3", { type: "audio/mpeg" });

    await expect(validateQuestionGroupMediaFile("image", image)).resolves.toMatchObject({
      success: true,
      extension: "png",
      contentType: "image/png",
    });
    await expect(validateQuestionGroupMediaFile("audio", audio)).resolves.toMatchObject({
      success: true,
      extension: "mp3",
      contentType: "audio/mpeg",
    });
  });

  it("rejects empty, too large, wrong MIME, and wrong extension files", async () => {
    await expect(
      validateQuestionGroupMediaFile(
        "image",
        new File([], "empty.png", { type: "image/png" }),
      ),
    ).resolves.toMatchObject({ success: false });

    await expect(
      validateQuestionGroupMediaFile(
        "image",
        new File([new Uint8Array(QUESTION_GROUP_IMAGE_MAX_SIZE_BYTES + 1)], "big.png", {
          type: "image/png",
        }),
      ),
    ).resolves.toMatchObject({ success: false });

    await expect(
      validateQuestionGroupMediaFile(
        "audio",
        new File([new Uint8Array(QUESTION_GROUP_AUDIO_MAX_SIZE_BYTES + 1)], "big.mp3", {
          type: "audio/mpeg",
        }),
      ),
    ).resolves.toMatchObject({ success: false });

    await expect(
      validateQuestionGroupMediaFile(
        "image",
        new File([pngBytes], "question.png", { type: "text/plain" }),
      ),
    ).resolves.toMatchObject({ success: false });

    await expect(
      validateQuestionGroupMediaFile(
        "image",
        new File([pngBytes], "question.gif", { type: "image/png" }),
      ),
    ).resolves.toMatchObject({ success: false });

    await expect(
      validateQuestionGroupMediaFile(
        "image",
        new File([new TextEncoder().encode("<svg></svg>")], "question.svg", {
          type: "image/svg+xml",
        }),
      ),
    ).resolves.toMatchObject({ success: false });
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarImageError, prepareAvatar } from "@/lib/auth/avatar-image";

// Test plan:
// - Mục tiêu: ảnh đại diện được cắt vuông giữa ảnh như khung xem trước, thu về tối đa 512×512 và nén dưới 900 KB trước khi
//   gửi lên Server Action (giới hạn body 1 MB), để ảnh chụp màn hình lớn không làm đăng ký thất bại.
// - Loại test: unit trong jsdom; createImageBitmap và canvas được thay vì jsdom không giải mã ảnh hay vẽ canvas.
// - Case: ảnh ngang lớn cắt giữa về 512; ảnh nhỏ không phóng to; trình duyệt không xuất WebP thì dùng JPEG; ảnh quá nặng
//   thử chất lượng thấp hơn; tệp không phải ảnh hoặc không giải mã được báo AvatarImageError.
// - Giới hạn: độ nén thật và định dạng trình duyệt hỗ trợ được kiểm trên trình duyệt thật.

const drawImage = vi.fn();
let blobFor: (type: string, quality: number) => Blob | null;

beforeEach(() => {
  blobFor = (type) => new Blob([new Uint8Array(40_000)], { type });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback, type, quality) {
    callback(blobFor(type ?? "image/png", quality ?? 1));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  drawImage.mockClear();
});

function stubBitmap(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width, height, close }));
  return close;
}

const photo = (type = "image/png") => new File(["raw"], "screenshot.png", { type });

describe("prepareAvatar", () => {
  it("crops the centre square of a large landscape image down to 512×512 WebP", async () => {
    const close = stubBitmap(2400, 1080);

    const avatar = await prepareAvatar(photo());

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 660, 0, 1080, 1080, 0, 0, 512, 512);
    expect(avatar).toBeInstanceOf(File);
    expect(avatar.type).toBe("image/webp");
    expect(avatar.name).toBe("avatar.webp");
    expect(avatar.size).toBe(40_000);
    expect(close).toHaveBeenCalled();
  });

  it("does not upscale a small image", async () => {
    stubBitmap(300, 200);

    await prepareAvatar(photo());

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 50, 0, 200, 200, 0, 0, 200, 200);
  });

  it("falls back to JPEG when the browser cannot encode WebP", async () => {
    stubBitmap(1000, 1000);
    // Trình duyệt không hỗ trợ loại được yêu cầu thì toBlob trả PNG.
    blobFor = (type) => new Blob([new Uint8Array(40_000)], { type: type === "image/webp" ? "image/png" : type });

    const avatar = await prepareAvatar(photo());

    expect(avatar.type).toBe("image/jpeg");
    expect(avatar.name).toBe("avatar.jpg");
  });

  it("retries at a lower quality when the first encoding is over the limit", async () => {
    stubBitmap(1000, 1000);
    blobFor = (type, quality) => new Blob([new Uint8Array(quality > 0.8 ? 950 * 1024 : 300 * 1024)], { type });

    const avatar = await prepareAvatar(photo());

    expect(avatar.size).toBe(300 * 1024);
  });

  it("rejects a file that is not an image without decoding it", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);

    await expect(prepareAvatar(photo("application/pdf"))).rejects.toBeInstanceOf(AvatarImageError);
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects an image the browser cannot decode", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new DOMException("decode failed")));

    await expect(prepareAvatar(photo("image/heic"))).rejects.toBeInstanceOf(AvatarImageError);
  });
});

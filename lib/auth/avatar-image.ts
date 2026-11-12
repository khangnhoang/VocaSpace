// Thu ảnh đại diện trên trình duyệt trước khi gửi lên Server Action (giới hạn body mặc định 1 MB của Next.js).
// Cắt vuông ở giữa đúng như khung tròn xem trước, đưa về tối đa 512×512 rồi nén WebP; trình duyệt không xuất được WebP
// (canvas trả PNG) thì dùng JPEG. Chỉ chạy trên client vì cần createImageBitmap và canvas.
import { AVATAR_FILE_EXTENSIONS, AVATAR_MAX_BYTES, AVATAR_MAX_DIMENSION } from "@/lib/schemas/auth";

export class AvatarImageError extends Error {}

const OUTPUT_TYPES = ["image/webp", "image/jpeg"] as const;
const QUALITIES = [0.85, 0.7] as const;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareAvatar(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new AvatarImageError("not an image");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Định dạng trình duyệt không giải mã được (ví dụ HEIC trên Chrome) hoặc tệp hỏng.
    throw new AvatarImageError("undecodable image");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, AVATAR_MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context || side === 0) {
    bitmap.close();
    throw new AvatarImageError("no canvas");
  }
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  for (const type of OUTPUT_TYPES) {
    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, type, quality);
      // toBlob trả PNG khi trình duyệt không hỗ trợ loại được yêu cầu; khi đó thử loại kế tiếp.
      if (!blob || blob.type !== type) break;
      if (blob.size <= AVATAR_MAX_BYTES) {
        return new File([blob], `avatar.${AVATAR_FILE_EXTENSIONS[type]}`, { type });
      }
    }
  }
  throw new AvatarImageError("could not compress");
}

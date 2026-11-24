// Tên header nội bộ mà proxy ghi đè bằng đường dẫn request, để `getRequestLocale` biết request thuộc khu vực bị khóa tiếng Việt.
export const PATHNAME_HEADER = "x-vocaspace-pathname";

// Chỉ liệt kê route API mà riêng khu giáo viên gọi; các route media `GET` học viên cũng dùng nên không được khóa.
const LOCKED_API_SEGMENTS: readonly string[] = ["api", "question-group-media", "upload"];

// Matcher của proxy cũng khớp đường dẫn đã giải mã phần trăm, nên `/%61dmin/...` vẫn tới proxy và render not-found gốc dưới tiền tố
// bị khóa (Next không route nó vào trang admin); not-found đó phải ở lại tiếng Việt. Giải mã từng segment (không giải mã cả chuỗi)
// để `%2F` không tạo ra ranh giới segment mới; segment hỏng (`%E0%A4%A`, `%`) giữ nguyên dạng thô thay vì ném lỗi.
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Khớp theo nguyên segment đã giải mã, nên `/teachers` và `/administrator` không bị khóa còn `/%61dmin` bị khóa. */
export function isLockedAreaPath(pathname: string | null | undefined): boolean {
  if (!pathname || !pathname.startsWith("/")) return false;
  const segments = pathname.slice(1).split("/").map(decodeSegment);
  const [first] = segments;
  if (first === "teacher" || first === "admin") return true;
  return (
    segments.length === LOCKED_API_SEGMENTS.length && segments.every((segment, index) => segment === LOCKED_API_SEGMENTS[index])
  );
}

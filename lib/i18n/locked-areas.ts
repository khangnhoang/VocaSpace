// Tên header nội bộ mà proxy ghi đè bằng đường dẫn request, để `getRequestLocale` biết request thuộc khu vực bị khóa tiếng Việt.
export const PATHNAME_HEADER = "x-vocaspace-pathname";

// Chỉ liệt kê route API mà riêng khu giáo viên gọi; các route media `GET` học viên cũng dùng nên không được khóa.
const LOCKED_API_PATHS: readonly string[] = ["/api/question-group-media/upload"];

function isUnderSegment(pathname: string, segment: string) {
  return pathname === segment || pathname.startsWith(`${segment}/`);
}

/** Khớp theo nguyên segment, nên `/teachers` và `/administrator` không bị khóa. */
export function isLockedAreaPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    isUnderSegment(pathname, "/teacher") ||
    isUnderSegment(pathname, "/admin") ||
    LOCKED_API_PATHS.includes(pathname)
  );
}

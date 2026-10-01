// Nút viền (variant `outline`) trên màn hình cảm ứng để dễ nhận ra là nút bấm được;
// trên chuột/trackpad trở về dạng chữ yên lặng. Chiều cao do nơi dùng quyết định.
export const touchStrongFineQuiet =
  "[@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:bg-transparent [@media(hover:hover)_and_(pointer:fine)]:hover:border-transparent";

// Dùng với variant `destructive-quiet`: viền đỏ nhạt, không nền đỏ trên cảm ứng để không
// tranh với nút chính; trên chuột/trackpad giữ dạng chữ đỏ yên lặng.
export const touchDestructiveFineQuiet =
  "border-correction/40 bg-background [@media(hover:hover)_and_(pointer:fine)]:border-transparent [@media(hover:hover)_and_(pointer:fine)]:bg-transparent";

// Bề rộng điện thoại theo mốc Tailwind `sm`; khác với việc nhận biết màn hình cảm ứng.
export function isPhoneLayout() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches;
}

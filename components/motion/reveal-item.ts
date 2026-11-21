/**
 * Thuộc tính cho một phần tử hiện dần khi cuộn bên trong `ScrollRevealGroup`. Tách khỏi file client để server component
 * gắn được trực tiếp. Mặc định phần tử hiển thị bình thường; chỉ `ScrollRevealGroup` sau khi hydrate mới đặt
 * `data-reveal="pending"` cho phần tử nằm dưới màn hình, nên nội dung server-rendered không bao giờ bị ẩn.
 */
export const REVEAL_ITEM_ATTRIBUTE = "data-reveal-item";

export const revealItemClassName =
  "transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none data-[reveal=pending]:[transform:translateY(16px)] data-[reveal=pending]:opacity-0";

export const revealItemProps = {
  [REVEAL_ITEM_ATTRIBUTE]: "",
  className: revealItemClassName,
} as const;

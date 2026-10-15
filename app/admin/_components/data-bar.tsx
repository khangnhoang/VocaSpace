import { revealStyle } from "./reveal";
import styles from "./dashboard-motion.module.css";

type DataBarProps = {
  // Độ dài theo phần trăm của đường kẻ (0-100), tính từ 0 nên tỷ lệ luôn đúng với giá trị.
  percent: number;
  value: number;
  max: number;
  index: number;
  count: number;
};

// Thanh ngang mã hóa một giá trị: gradient Action Blue → Route Blue, không chữ đè lên thanh (Admin design mục 4.3, 14).
// Thanh khác 0 giữ chiều dài tối thiểu 4px để vẫn thấy được; thanh 0 không vẽ.
export function HorizontalDataBar({ percent, value, max, index, count }: DataBarProps) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1E293B]" aria-hidden="true">
      {percent > 0 ? (
        <div
          data-testid="data-bar"
          className={`h-full rounded-full bg-gradient-to-r from-[#2B6CED] to-[#60A5FA] ${styles.revealRight}`}
          style={{ width: `${percent}%`, minWidth: 4, ...revealStyle(value, max, index, count) }}
        />
      ) : null}
    </div>
  );
}

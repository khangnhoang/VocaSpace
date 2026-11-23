import Image from "next/image";
import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Ảnh bìa khóa học (hoặc chỗ giữ chỗ khi chưa có ảnh). Dùng ở thẻ đăng ký của khách/người chưa ghi danh và ở phần đầu trang của
 * học viên đã ghi danh (FEAT3 AC6a); mỗi trạng thái chỉ hiện một nơi, nên `priority` không bị trùng.
 */
export function PublicCourseCover({
  title,
  thumbnailUrl,
  sizes,
  className = "",
}: {
  title: string;
  thumbnailUrl: string | null;
  sizes: string;
  className?: string;
}) {
  const t = useTranslations("courses");
  return (
    <div className={`relative aspect-video bg-linear-to-br from-blue-50 to-cyan-50 ${className}`}>
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt={t("catalog.card.coverAlt", { title })}
          fill
          priority
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={t("catalog.card.noCover", { title })}
          className="flex h-full items-center justify-center text-blue-400"
        >
          <BookOpen aria-hidden="true" className="size-14" />
        </div>
      )}
    </div>
  );
}

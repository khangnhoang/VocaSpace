import { PublicCourseDetailRoute } from "@/app/(client)/courses/_components/PublicCourseDetailRoute";

type PageProps = {
  params: Promise<{ "course-slug": string }>;
};

export default async function LegacyPublicCourseDetailPage({ params }: PageProps) {
  const courseSlug = (await params)["course-slug"];

  // Legacy URL giữ noindex nhưng dùng cùng renderer để không tạo public-detail contract thứ hai.
  return PublicCourseDetailRoute({ courseSlug });
}

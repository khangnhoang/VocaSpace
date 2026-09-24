import { unstable_noStore } from "next/cache";
import { getPublicCourseDetail } from "@/app/actions/public-course";
import { getPublicCoursePreview } from "@/app/actions/public-course-preview";
import { getPublicCourseCatalogPath, getPublicCourseDetailPath } from "@/lib/public-courses/routes";
import { publicCourseSlugSchema } from "@/lib/schemas/public-course";
import { PublicCoursePreviewExperience } from "./_components/PublicCoursePreviewExperience";
import { PublicCoursePreviewUnavailable } from "./_components/PublicCoursePreviewUnavailable";

type PublicCoursePreviewPageProps = {
  params: Promise<{ "course-slug": string; "topic-slug": string }>;
};

export default async function PublicCoursePreviewPage({
  params,
}: PublicCoursePreviewPageProps) {
  unstable_noStore();
  const routeParams = await params;
  const courseSlug = publicCourseSlugSchema.safeParse(routeParams["course-slug"]);
  const returnToCourseHref = courseSlug.success
    ? getPublicCourseDetailPath(courseSlug.data)
    : getPublicCourseCatalogPath();

  const [previewResult, courseResult] = await Promise.all([
    getPublicCoursePreview({
      courseSlug: routeParams["course-slug"],
      topicSlug: routeParams["topic-slug"],
    }),
    courseSlug.success
      ? getPublicCourseDetail(courseSlug.data)
      : Promise.resolve(null),
  ]);

  if (previewResult.status !== "success") {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <PublicCoursePreviewUnavailable
            kind={previewResult.status}
            returnToCourseHref={returnToCourseHref}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-slate-50 px-4 py-6 sm:px-6 md:py-10">
      <PublicCoursePreviewExperience
        data={previewResult.data}
        isEnrolled={courseResult?.status === "success" && courseResult.data.is_enrolled}
        returnToCourseHref={returnToCourseHref}
      />
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnrolledCourseOverviewData } from "@/lib/schemas/enrolled-course-overview";

function getCourseInitials(title: string) {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toLocaleUpperCase("vi-VN");
}

function getProgressPresentation(data: EnrolledCourseOverviewData) {
  if (data.status === "completed") {
    return {
      eyebrow: "ĐÃ HOÀN THÀNH",
      title: "Bạn đã đi hết lộ trình",
      description: "Ôn lại bài học cuối để giữ nhịp ghi nhớ.",
      destinationTopic: data.lastTopic,
      cta: "Xem lại bài học cuối",
    };
  }
  if (data.status === "not-started") {
    return {
      eyebrow: "SẴN SÀNG BẮT ĐẦU",
      title: "Bài đầu tiên đang chờ bạn",
      description: "Bắt đầu theo đúng thứ tự của lộ trình khóa học.",
      destinationTopic: data.nextTopic,
      cta: "Bắt đầu học",
    };
  }

  return {
    eyebrow: "BÀI TIẾP THEO",
    title: "Tiếp tục từ phần còn dang dở",
    description: "Quay lại chủ đề chưa hoàn thành sớm nhất trong lộ trình.",
    destinationTopic: data.nextTopic,
    cta: "Tiếp tục học",
  };
}

function CourseIdentity({ data }: { data: EnrolledCourseOverviewData }) {
  return (
    <header className="grid min-w-0 gap-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:grid-cols-[144px_minmax(0,1fr)] sm:items-center sm:p-6">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-linear-to-br from-blue-50 to-cyan-100 sm:aspect-square">
        {data.courseThumbnailUrl ? (
          <Image
            src={data.courseThumbnailUrl}
            alt={`Ảnh bìa khóa học ${data.courseTitle}`}
            fill
            sizes="(max-width: 639px) calc(100vw - 72px), 144px"
            className="object-cover"
            priority
          />
        ) : (
          <div
            role="img"
            aria-label={`Chưa có ảnh bìa cho khóa học ${data.courseTitle}`}
            className="flex size-full items-center justify-center text-blue-700"
          >
            <span className="text-4xl font-extrabold tracking-tight">
              {getCourseInitials(data.courseTitle) || (
                <BookOpen aria-hidden="true" className="size-10" />
              )}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-extrabold tracking-[0.16em] text-blue-700">
          KHÔNG GIAN KHÓA HỌC
        </p>
        <h1 className="mt-2 wrap-break-word text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
          {data.courseTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Theo dõi các chủ đề đã hoàn thành và tiếp tục từ đúng điểm trong lộ
          trình của bạn.
        </p>
      </div>
    </header>
  );
}

function NoContentState() {
  return (
    <section
      role="status"
      aria-labelledby="course-no-content-title"
      className="rounded-[24px] border border-dashed border-slate-300 bg-white p-6 text-center"
    >
      <BookOpen aria-hidden="true" className="mx-auto size-10 text-blue-300" />
      <h2
        id="course-no-content-title"
        className="mt-4 text-xl font-extrabold text-slate-950"
      >
        Khóa học chưa có nội dung để bắt đầu
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Các chủ đề học tập đang được cập nhật. Bạn có thể quay lại không gian
        học tập và thử lại sau.
      </p>
      <Button
        asChild
        variant="outline"
        className="mt-5 min-h-11 w-full rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
      >
        <Link href="/learn">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Về không gian học tập
        </Link>
      </Button>
    </section>
  );
}

function ProgressCard({ data }: { data: EnrolledCourseOverviewData }) {
  if (data.status === "no-content") return <NoContentState />;

  const presentation = getProgressPresentation(data);
  const progress = data.progressPercentage ?? 0;
  const destination = presentation.destinationTopic
    ? `/learn/${data.courseSlug}/${presentation.destinationTopic.slug}`
    : null;

  return (
    <aside
      aria-labelledby="course-progress-title"
      className="rounded-[24px] border border-blue-100 bg-white p-6 shadow-[0_12px_36px_rgba(37,99,235,0.08)] lg:sticky lg:top-6"
    >
      <p className="text-xs font-extrabold tracking-[0.16em] text-blue-700">
        {presentation.eyebrow}
      </p>
      <h2
        id="course-progress-title"
        className="mt-2 text-2xl font-extrabold leading-8 text-slate-950"
      >
        {presentation.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {presentation.description}
      </p>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-extrabold tracking-tight text-slate-950">
            {progress}%
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {data.completedTopicCount}/{data.totalTopicCount} chủ đề đã hoàn
            thành
          </p>
        </div>
        {data.status === "completed" && (
          <CheckCircle2 aria-hidden="true" className="size-10 text-cyan-600" />
        )}
      </div>
      <div
        role="progressbar"
        aria-label={`Tiến độ khóa học ${data.courseTitle}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${data.completedTopicCount} trên ${data.totalTopicCount} chủ đề đã hoàn thành`}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-cyan-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {presentation.destinationTopic && (
        <div className="mt-6 rounded-2xl bg-blue-50 p-4">
          <p className="text-[11px] font-extrabold tracking-[0.13em] text-blue-700">
            {data.status === "completed" ? "BÀI ÔN LẠI" : "CHỦ ĐỀ TIẾP THEO"}
          </p>
          <p className="mt-1 wrap-break-word text-sm font-bold leading-6 text-slate-900">
            {presentation.destinationTopic.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {presentation.destinationTopic.chapterTitle}
          </p>
        </div>
      )}

      {destination && (
        <Button
          asChild
          className="mt-5 min-h-11 w-full rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700"
        >
          <Link href={destination}>
            {presentation.cta}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      )}
    </aside>
  );
}

function LearningPath({ data }: { data: EnrolledCourseOverviewData }) {
  if (data.status === "no-content") return null;

  return (
    <section aria-labelledby="learning-path-title" className="min-w-0">
      <div>
        <p className="text-xs font-extrabold tracking-[0.16em] text-blue-700">
          LỘ TRÌNH HỌC
        </p>
        <h2
          id="learning-path-title"
          className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl"
        >
          Các chủ đề trong khóa học
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Chủ đề được sắp theo đúng thứ tự học; bạn vẫn có thể mở lại phần đã
          hoàn thành.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {data.chapters.map((chapter, chapterIndex) => (
          <section
            key={chapter.id}
            aria-labelledby={`chapter-${chapter.id}`}
            className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-600">
                {chapterIndex + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold tracking-[0.12em] text-slate-500">
                  CHƯƠNG {chapterIndex + 1}
                </p>
                <h3
                  id={`chapter-${chapter.id}`}
                  className="mt-0.5 wrap-break-word text-lg font-extrabold text-slate-950"
                >
                  {chapter.title}
                </h3>
              </div>
            </div>

            <ol className="mt-4 space-y-2">
              {chapter.topics.map((topic) => {
                const isCurrent = data.nextTopic?.slug === topic.slug;
                const stateLabel = topic.isCompleted
                  ? "Đã hoàn thành"
                  : isCurrent
                    ? "Học tiếp"
                    : "Sắp tới";
                const StateIcon = topic.isCompleted
                  ? CheckCircle2
                  : isCurrent
                    ? PlayCircle
                    : Circle;

                return (
                  <li key={topic.id}>
                    <Link
                      href={`/learn/${data.courseSlug}/${topic.slug}`}
                      className={`group flex min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-4 ${
                        isCurrent
                          ? "border-blue-200 bg-blue-50"
                          : topic.isCompleted
                            ? "border-cyan-100 bg-cyan-50/50 hover:border-cyan-200"
                            : "border-transparent bg-slate-50 hover:border-slate-200"
                      }`}
                    >
                      <StateIcon
                        aria-hidden="true"
                        className={`size-5 shrink-0 ${
                          isCurrent
                            ? "text-blue-600"
                            : topic.isCompleted
                              ? "text-cyan-700"
                              : "text-slate-400"
                        }`}
                      />
                      <span className="min-w-0 flex-1 wrap-break-word text-sm font-bold leading-6 text-slate-900">
                        {topic.title}
                      </span>
                      <span
                        className={`shrink-0 text-[11px] font-extrabold ${
                          isCurrent
                            ? "text-blue-700"
                            : topic.isCompleted
                              ? "text-cyan-800"
                              : "text-slate-500"
                        }`}
                      >
                        {stateLabel}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function EnrolledCourseOverview({
  data,
}: {
  data: EnrolledCourseOverviewData;
}) {
  return (
    <div className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 md:py-10 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1180px]">
        <Button
          asChild
          variant="ghost"
          className="mb-4 min-h-10 rounded-xl px-2 text-slate-600 hover:bg-white hover:text-blue-700"
        >
          <Link href="/learn">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Không gian học tập
          </Link>
        </Button>

        <CourseIdentity data={data} />

        <div
          className={`mt-6 min-w-0 ${
            data.status === "no-content"
              ? "mx-auto max-w-2xl"
              : "grid grid-cols-1 items-start gap-8 lg:grid-cols-12"
          }`}
        >
          <div
            className={
              data.status === "no-content"
                ? "min-w-0"
                : "min-w-0 lg:col-span-4 lg:col-start-9 lg:row-start-1"
            }
          >
            <ProgressCard data={data} />
          </div>
          {data.status !== "no-content" && (
            <div className="min-w-0 lg:col-span-8 lg:col-start-1 lg:row-start-1">
              <LearningPath data={data} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

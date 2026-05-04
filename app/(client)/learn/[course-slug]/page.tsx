// app/(client)/learn/[course-slug]/page.tsx
// import { redirect } from "next/navigation";
// import { getFirstTopicSlug } from "@/services/topic-service"; 

export default async function CourseDetailPage(props: { params: Promise<{ "course-slug": string }> }) {
  const params = await props.params;
  const courseSlug = params["course-slug"];

  // 1. Validate courseSlug với Zod nếu cần
  // 2. Fetch logic để lấy topic đầu tiên của course này
  // const firstTopic = await getFirstTopicSlug(courseSlug);
  
  // if (!firstTopic) return notFound();

  // 3. Tạm thời redirect thẳng vào bài học đầu tiên vì trang overview chưa có
  // redirect(`/learn/${courseSlug}/${firstTopic.slug}`);
  
  return (
    <div>Tổng quan khóa học: {courseSlug} (Đang phát triển)</div>
  );
}
// app/(client)/_components/PublicCourseList.tsx
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublishedCourses } from "@/app/actions/course";

export default async function PublicCourseList() {
  // Nối API thật vào đây
  const courses = await getPublishedCourses();

  return (
    <div className="p-4 mt-4 lg:mt-8 grid grid-cols-1 gap-4 lg:gap-2 container mx-auto">
      <h1 className="text-xl font-bold">Các Khóa Học Hiện Có</h1>
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-4 md:grid-cols-2 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="border p-3 rounded-2xl bg-white flex flex-col gap-3 w-full hover:shadow-lg transition-all duration-300"
            >
              <div className="aspect-4/3 relative rounded-xl overflow-hidden bg-gray-100">
                <Image
                  fill
                  className="object-cover p-2 rounded-xl"
                  src={
                    course.thumbnail_url ||
                    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80"
                  }
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  alt={course.title}
                  priority
                />
              </div>

              <div className="flex flex-col gap-2 flex-1 mt-1">
                <h3 className="font-bold text-gray-900 line-clamp-2 leading-snug">
                  {course.title}
                </h3>

                <div className="mt-auto">
                  {course.price === 0 ? (
                    <p className="font-extrabold text-blue-400">Miễn phí</p>
                  ) : (
                    <p className="font-bold text-blue-400">
                      {course.price.toLocaleString("vi-VN")}đ
                    </p>
                  )}
                </div>

                {/* Sửa lại Link để nhảy thẳng vào đường dẫn như ông yêu cầu */}
                <Link href={`/learn/${course.slug}/overview`}>
                  <Button className="bg-[#5FE8EF] hover:bg-[#42d2da] text-white rounded-xl w-full mt-2 cursor-pointer">
                    Xem chi tiết
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

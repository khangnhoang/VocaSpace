import { requireAdminPage } from "@/lib/auth/admin-access";
import { listAdminCourses } from "@/lib/admin/course-list";
import { adminCourseFilterSchema } from "@/lib/schemas/admin-course";
import { createClient } from "@/utils/supabase/server";
import AdminCoursesClient from "./_components/admin-courses-client";

type SearchParams = Record<string, string | string[] | undefined>;

// Tham số lặp (?q=a&q=b) lấy giá trị đầu; schema tự đưa mọi giá trị sai về mặc định nên parse không ném (AD3 AC3).
function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCoursesRoute({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Cổng admin phải chạy trước mọi truy vấn: layout có thể được giữ nguyên khi điều hướng client (AD1 AC3, AD3 G1).
  await requireAdminPage();

  const params = await searchParams;
  const filter = adminCourseFilterSchema.parse({
    status: firstValue(params.status),
    q: firstValue(params.q),
    page: firstValue(params.page),
  });

  const result = await listAdminCourses(await createClient(), filter);

  return <AdminCoursesClient filter={filter} data={result.data} error={result.error} />;
}

"use server";

import { createClient } from "@/utils/supabase/server";
import {
  PAYMENT_HISTORY_FILTER_STATUSES,
  PAYMENT_HISTORY_PAGE_SIZE,
  paymentHistoryDataSchema,
  paymentHistoryInputSchema,
  type PaymentHistoryFilter,
  type PaymentHistoryResult,
} from "@/lib/schemas/payment-history";

// Cột tường minh: không bao giờ chọn gateway_metadata, discount_id hay user_id (FEAT6 G2).
const HISTORY_COLUMNS = `
  id,
  status,
  amount_original,
  amount_discount,
  amount_final,
  currency,
  gateway_order_id,
  created_at,
  expires_at,
  course_id,
  course:courses (slug, title)
`;

// PostgREST trả 416 / PGRST103 khi offset vượt quá số dòng.
const RANGE_NOT_SATISFIABLE = "PGRST103";

interface PaymentHistoryRow {
  id: string;
  status: string;
  amount_original: number;
  amount_discount: number;
  amount_final: number;
  currency: string;
  gateway_order_id: string;
  created_at: string;
  expires_at: string | null;
  course_id: string;
  course: { slug: string; title: string } | null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const failure = (
  errorCode: Extract<PaymentHistoryResult, { success: false }>["errorCode"],
  error: string,
): PaymentHistoryResult => ({ success: false, errorCode, error });

const queryFailedResult = () =>
  failure("QUERY_FAILED", "Không thể tải lịch sử thanh toán lúc này.");

function baseQuery(
  supabase: SupabaseServerClient,
  userId: string,
  filter: PaymentHistoryFilter,
) {
  // RLS đã giới hạn theo chủ dòng; user_id vẫn được lọc tường minh (G1). Thanh toán miễn phí (gateway = 'free') không hiển thị.
  const query = supabase
    .from("payments")
    .select(HISTORY_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .neq("gateway", "free");
  return filter === "all"
    ? query
    : query.in("status", [...PAYMENT_HISTORY_FILTER_STATUSES[filter]]);
}

function readPage(
  supabase: SupabaseServerClient,
  userId: string,
  filter: PaymentHistoryFilter,
  page: number,
) {
  const from = (page - 1) * PAYMENT_HISTORY_PAGE_SIZE;
  return baseQuery(supabase, userId, filter)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PAYMENT_HISTORY_PAGE_SIZE - 1);
}

/**
 * AC10 / G7: tên thật của khóa học mà phép join không đọc được. Chỉ gọi khi trang có dòng course rỗng và chỉ với id của các
 * dòng đó; hàm trong DB tự giới hạn theo chủ payment. Lỗi ở đây không làm hỏng cả trang: dòng giữ chữ dự phòng.
 */
async function readHiddenCourseTitles(
  supabase: SupabaseServerClient,
  rows: PaymentHistoryRow[],
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const hiddenIds = rows.filter((row) => row.course === null).map((row) => row.id);
  if (hiddenIds.length === 0) return titles;

  const { data, error } = await supabase.rpc("get_own_payment_course_titles", {
    p_payment_ids: hiddenIds,
  });
  if (error) {
    console.error("Payment history hidden course titles failed", error);
    return titles;
  }
  for (const entry of (data ?? []) as Array<{ payment_id: string; course_title: string }>) {
    if (entry.course_title) titles.set(entry.payment_id, entry.course_title);
  }
  return titles;
}

/**
 * Owner QA round 2: khóa học nào trên trang mà học viên đã ghi danh. Đọc bằng session client (RLS chỉ cho đọc ghi danh của chính mình)
 * kèm user_id tường minh, chỉ với id khóa học của trang này. Lỗi đọc không làm hỏng trang nhưng cũng không được suy ra "chưa ghi danh":
 * trả null để mọi dòng của trang có isEnrolled = null (không rõ) và không dòng nào có "Tiếp tục thanh toán".
 */
async function readEnrolledCourseIds(
  supabase: SupabaseServerClient,
  userId: string,
  rows: PaymentHistoryRow[],
): Promise<Set<string> | null> {
  const courseIds = Array.from(new Set(rows.map((row) => row.course_id).filter(Boolean)));
  if (courseIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .in("course_id", courseIds);
  if (error) {
    console.error("Payment history enrollments failed", error);
    return null;
  }
  return new Set((data ?? []).map((entry) => entry.course_id as string));
}

export async function getPaymentHistory(
  input: unknown,
): Promise<PaymentHistoryResult> {
  const parsedInput = paymentHistoryInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return failure("INVALID_INPUT", "Bộ lọc hoặc số trang không hợp lệ.");
  }
  const { filter, page } = parsedInput.data;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return failure("AUTH_REQUIRED", "Vui lòng đăng nhập để xem lịch sử thanh toán.");
  }

  try {
    let servedPage = page;
    let result = await readPage(supabase, user.id, filter, servedPage);

    // PostgREST trả 416 khi offset vượt tổng, nhưng khi offset đúng bằng tổng (số dòng là bội của cỡ trang) nó trả 200 với danh sách rỗng.
    const isPastEnd =
      result.error?.code === RANGE_NOT_SATISFIABLE ||
      (!result.error && page > 1 && (result.data ?? []).length === 0);
    if (isPastEnd) {
      // Số dòng đã giảm sau lần đếm trước: đếm lại rồi trả trang cuối thực sự tồn tại (G3).
      const counted = await baseQuery(supabase, user.id, filter).limit(1);
      if (counted.error) {
        console.error("Payment history count failed", counted.error);
        return queryFailedResult();
      }
      const total = counted.count ?? 0;
      if (total === 0) {
        return {
          success: true,
          data: {
            items: [],
            total: 0,
            page: 1,
            pageSize: PAYMENT_HISTORY_PAGE_SIZE,
          },
        };
      }
      servedPage = Math.ceil(total / PAYMENT_HISTORY_PAGE_SIZE);
      result = await readPage(supabase, user.id, filter, servedPage);
    }

    if (result.error) {
      console.error("Payment history query failed", result.error);
      return queryFailedResult();
    }

    const rows = (result.data ?? []) as unknown as PaymentHistoryRow[];
    const [hiddenTitles, enrolledCourseIds] = await Promise.all([
      readHiddenCourseTitles(supabase, rows),
      readEnrolledCourseIds(supabase, user.id, rows),
    ]);
    const parsedData = paymentHistoryDataSchema.safeParse({
      items: rows.map((row) => ({
        paymentId: row.id,
        status: row.status,
        amountOriginal: row.amount_original,
        amountDiscount: row.amount_discount,
        amountFinal: row.amount_final,
        currency: row.currency,
        orderCode: row.gateway_order_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        course: row.course
          ? { slug: row.course.slug, title: row.course.title }
          : null,
        hiddenCourseTitle: row.course ? null : (hiddenTitles.get(row.id) ?? null),
        isEnrolled: enrolledCourseIds ? enrolledCourseIds.has(row.course_id) : null,
      })),
      total: result.count ?? rows.length,
      page: servedPage,
      pageSize: PAYMENT_HISTORY_PAGE_SIZE,
    });

    if (!parsedData.success) {
      console.error(
        "Payment history output validation failed",
        parsedData.error.issues,
      );
      return failure("INVALID_DATA", "Dữ liệu lịch sử thanh toán không hợp lệ.");
    }

    return { success: true, data: parsedData.data };
  } catch (error) {
    console.error("Payment history unexpected failure", error);
    return queryFailedResult();
  }
}

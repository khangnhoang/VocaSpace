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

    if (result.error?.code === RANGE_NOT_SATISFIABLE) {
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

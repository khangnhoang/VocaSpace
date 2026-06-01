// app/api/webhook/payos/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { payosService } from "@/services/payos";

// Khởi tạo Supabase Admin Client với đặc quyền hệ thống cao nhất
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Zod Schema kiểm tra cấu trúc gói tin webhook - Đã đồng bộ chuẩn xác theo file webhook.d.ts
const payosWebhookSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(), // Khợp với cấu trúc định nghĩa gốc của PayOS
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string(),
    accountNumber: z.string(),
    reference: z.string(),
    transactionDateTime: z.string(),
    currency: z.string(),
    paymentLinkId: z.string(),
    code: z.string(),
    desc: z.string(),
  }),
  signature: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Kiểm tra cấu trúc dữ liệu đầu vào bằng Zod Schema
    const validation = payosWebhookSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.issues[0].message;
      return NextResponse.json({ message: `Dữ liệu sai cấu trúc: ${errorMessage}` }, { status: 400 });
    }

    const webhookPayload = validation.data;

    // 2. XÁC THỰC CHỮ KÝ SỐ: Gọi hàm .verify bất đồng bộ thông qua namespace .webhooks
    // Sử dụng await để xử lý đúng Promise<WebhookData> và cho phép TypeScript tự suy luận type sạch sẽ
    let verifiedData;
    try {
      verifiedData = await payosService.webhooks.verify(webhookPayload);
    } catch (signatureError) {
      return NextResponse.json({ message: "Chữ ký webhook không hợp lệ. Giao dịch bị từ chối." }, { status: 401 });
    }

    // 3. Nếu mã trạng thái từ PayOS báo thất bại, dừng tiến trình và trả về 200 để xác nhận đã nhận tin
    if (webhookPayload.code !== "00" || !webhookPayload.success) {
      return NextResponse.json({ message: "Giao dịch ghi nhận trạng thái thất bại từ cổng thanh toán." }, { status: 200 });
    }

    // Bóc tách dữ liệu an toàn đã được verify thành công (orderCode và reference giờ đã có sẵn type)
    const { orderCode, reference } = verifiedData;

    // 4. KÍCH HOẠT TRANSACTION NGUYÊN TỬ: Đẩy xuống hàm RPC dưới DB xử lý lõi
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("handle_payment_success", {
      p_gateway: "payos",
      p_gateway_order_id: String(orderCode), // Chuyển kiểu number sang string để ăn index B-Tree
      p_gateway_transaction_id: reference || null
    });

    if (rpcError) {
      throw rpcError;
    }

    // 5. PHÂN TÁCH KẾT QUẢ ĐẦU RA THEO CHUẨN CỦA ĐỒ ÁN
    switch (rpcResult) {
      case "SUCCESS":
      case "IDEMPOTENT_SUCCESS":
        return NextResponse.json({ success: true, code: rpcResult }, { status: 200 });

      case "PAYMENT_NOT_FOUND":
        return NextResponse.json({ message: "Không tìm thấy mã hóa đơn tương ứng trên hệ thống." }, { status: 404 });

      case "INVALID_PAYMENT_DATA":
      case "INVALID_STATUS":
        return NextResponse.json({ message: `Hóa đơn không hợp lệ hoặc đã đóng: ${rpcResult}` }, { status: 400 });

      default:
        return NextResponse.json({ message: "Trạng thái phản hồi không xác định từ hệ thống lõi." }, { status: 500 });
    }

  } catch (error: any) {
    console.error("🚨 [PAYOS_WEBHOOK_ERROR]:", error);
    return NextResponse.json(
      { message: "Xử lý nội bộ webhook thất bại.", error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
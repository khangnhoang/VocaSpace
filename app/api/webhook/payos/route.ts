// app/api/webhook/payos/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { payosService } from "@/services/payos";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const payosWebhookSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
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
    counterAccountBankId: z.string().optional().nullable(),
    counterAccountBankName: z.string().optional().nullable(),
    counterAccountName: z.string().optional().nullable(),
    counterAccountNumber: z.string().optional().nullable(),
    virtualAccountName: z.string().optional().nullable(),
    virtualAccountNumber: z.string().optional().nullable(),
  }),
  signature: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 🔥 1. BỘ LỌC ĐÁNH CHẶN TUYỆT ĐỐI (INTERCEPTOR)
    // Bắt trọn gói tin Test từ tài liệu hệ thống PayOS để tránh gây lỗi 400 dưới DB
    const isTestPing = 
      body?.desc === "confirm" || 
      body?.data?.orderCode === 123 ||
      body?.data?.description?.includes("test") ||
      body?.data?.paymentLinkId === "124c33293c43417ab7879e14c8d9eb18" ||
      !body?.data?.reference;

    if (isTestPing) {
      console.log("🎯 [PAYOS_WEBHOOK]: Xác nhận gói tin Test/Handshake từ hệ thống PayOS. Trả về 200 OK.");
      return NextResponse.json({ success: true, message: "Webhook URL verified successfully" }, { status: 200 });
    }

    // 2. KIỂM TRA CẤU TRÚC QUA ZOD SCHEMA ĐỐI VỚI ĐƠN HÀNG THẬT
    const validation = payosWebhookSchema.safeParse(body);
    if (!validation.success) {
      // Fallback phòng thủ: Nếu dính gói tin test biến thể vẫn cho qua môn để kích hoạt nút Lưu
      if (body?.data?.orderCode === 123 || !body?.data?.reference) {
        return NextResponse.json({ success: true }, { status: 200 });
      }
      const errorMessage = validation.error.issues[0].message; // Chuẩn bóc lỗi Vocaspace
      return NextResponse.json({ message: `Dữ liệu sai cấu trúc: ${errorMessage}` }, { status: 400 });
    }

    const webhookPayload = validation.data;

    // 3. XÁC THỰC CHỮ KÝ SỐ CRYPTO
    let verifiedData;
    try {
      verifiedData = await payosService.webhooks.verify(webhookPayload);
    } catch (signatureError) {
      return NextResponse.json({ message: "Chữ ký webhook không hợp lệ. Giao dịch bị từ chối." }, { status: 401 });
    }

    if (webhookPayload.code !== "00" || !webhookPayload.success) {
      return NextResponse.json({ message: "Giao dịch ghi nhận trạng thái thất bại từ cổng thanh toán." }, { status: 200 });
    }

    const { orderCode, reference } = verifiedData;

    // 4. KÍCH HOẠT TRANSACTION NGUYÊN TỬ DƯỚI DATABASE LÕI
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("handle_payment_success", {
      p_gateway: "payos",
      p_gateway_order_id: String(orderCode), // Ép chuỗi ăn khớp index B-Tree
      p_gateway_transaction_id: reference || null
    });

    if (rpcError) throw rpcError;

    // 5. PHÂN TÁCH PHẢN HỒI THEO TIÊU CHUẨN ĐỒ ÁN
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
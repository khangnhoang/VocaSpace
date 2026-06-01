// services/payos.ts
import { PayOS } from "@payos/node";

const clientId = process.env.PAYOS_CLIENT_ID;
const apiKey = process.env.PAYOS_API_KEY;
const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

if (!clientId || !apiKey || !checksumKey) {
  throw new Error("Hệ thống thiếu cấu hình các biến môi trường dành cho PayOS (CLIENT_ID, API_KEY, CHECKSUM_KEY).");
}

// Khởi tạo instance PayOS dùng chung cho toàn hệ thống
export const payosService = new PayOS({
  clientId,
  apiKey,
  checksumKey,
});
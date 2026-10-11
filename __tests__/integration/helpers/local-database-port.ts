// API 45321 là runtime gốc, API 45441 là runtime E2E cô lập; mỗi runtime có cổng PostgreSQL riêng.
const DATABASE_PORT_BY_API_PORT: Readonly<Record<string, string>> = {
  "45321": "45322",
  "45441": "45442",
};
const DEFAULT_API_URL = "http://127.0.0.1:45321";

// Suy cổng PostgreSQL từ NEXT_PUBLIC_SUPABASE_URL để psql luôn nói chuyện với đúng runtime mà test đang nhắm tới.
// Mọi host, giao thức, cổng hoặc URL lạ đều ném lỗi, không bao giờ rơi về một cổng mặc định khi chưa biết đích.
export function resolveLocalDatabasePort(apiUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_API_URL): string {
  let api: URL;
  try {
    api = new URL(apiUrl);
  } catch {
    throw new Error("PostgreSQL helpers require a valid local Supabase API URL.");
  }
  const databasePort = DATABASE_PORT_BY_API_PORT[api.port];
  if (api.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(api.hostname) || !databasePort) {
    throw new Error("PostgreSQL helpers require the known local Supabase runtime.");
  }
  return databasePort;
}

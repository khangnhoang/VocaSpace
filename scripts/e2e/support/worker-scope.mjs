import { createHash } from "node:crypto";

// Mỗi worker Playwright (`testInfo.parallelIndex`) có không gian dữ liệu riêng để hai worker chạy song song
// không ghi đè hay xóa hàng của nhau. Mọi ID, email, username, slug và đường dẫn Storage mà một file worker-scoped
// ghi đều đi qua helper này.
//
// ID bắt đầu bằng `e2e` + chỉ số worker: tiền tố này không trùng ID nào trong `supabase/seed.sql`
// (có test giữ bất biến đó), nên một fixture worker-scoped không bao giờ chạm hàng seed.

const password = "123123";

export function assertIsolatedRuntime(env = process.env) {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (!loopback || url.port !== "45441" || env.E2E_SUPABASE_WORKDIR !== ".e2e-runtime") {
    throw new Error(
      "Worker-scoped E2E fixtures only run on the isolated E2E runtime (API 45441, workdir .e2e-runtime).",
    );
  }
}

/** UUID v4 hợp lệ, ổn định theo (chỉ số worker, tên): `e2e<index 5 hex>-xxxx-4xxx-8xxx-xxxxxxxxxxxx`. */
export function workerId(index, name) {
  assertIndex(index);
  const digest = createHash("sha256").update(`${index}:${name}`).digest("hex");
  const prefix = `e2e${index.toString(16).padStart(5, "0")}`;
  return `${prefix}-${digest.slice(0, 4)}-4${digest.slice(4, 7)}-8${digest.slice(7, 10)}-${digest.slice(10, 22)}`;
}

export function getWorkerScope(parallelIndex) {
  const index = parallelIndex;
  assertIndex(index);
  const tag = `w${index}`;
  return {
    index,
    tag,
    id: (name) => workerId(index, name),
    slug: (base) => `${base}-${tag}`,
    /** Tiền tố cho tên có thể dọn theo tiền tố; mỗi worker chỉ dọn tiền tố của mình. */
    // Không dùng ký tự đặc biệt của RegExp (test dựng RegExp từ tiêu đề); dấu `-` cuối để `w1-` không khớp `w10-`.
    prefix: (base) => `${base} ${tag}-`,
    teacher: account(index, "teacher", "main"),
    student: account(index, "student", "main"),
    /**
     * Tài khoản riêng cho file cần danh sách khóa học "sạch": `/teacher/courses` liệt kê mọi khóa học của giáo viên
     * và từ 5 khóa học trở lên đổi sang chế độ dày (không còn nút ngay trên thẻ), nên không dùng chung giáo viên chính.
     */
    extraTeacher: (key) => account(index, "teacher", key),
    extraStudent: (key) => account(index, "student", key),
  };
}

function account(index, role, key) {
  const tag = `w${index}`;
  const suffix = key === "main" ? tag : `${key.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${tag}`;
  const label = role === "teacher" ? "Teacher" : "Student";
  return {
    id: workerId(index, key === "main" ? role : `${role}:${key}`),
    email: `e2e-${role}-${suffix.replace(/_/g, "-")}@e2e.test`,
    password,
    fullName: `E2E ${label} ${suffix}`,
    username: `e2e_${role}_${suffix}`,
  };
}

function assertIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index > 0xfffff) {
    throw new Error(`Invalid Playwright parallel index: ${index}`);
  }
}

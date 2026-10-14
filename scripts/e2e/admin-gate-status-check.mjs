// Kiểm tra status HTTP của document /admin và /admin/courses trên build production (AD1 AC2, AD3 AC1): `next dev` không đại diện cho streaming/status của bản build.
// Cách chạy: build + start với NEXT_DIST_DIR=.next-e2e trên cổng 3100 trỏ vào runtime Supabase cô lập (45441), rồi
//   E2E_BASE_URL=http://127.0.0.1:3100 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:45441 E2E_SUPABASE_WORKDIR=.e2e-runtime node scripts/e2e/admin-gate-status-check.mjs
// Script từ chối chạy nếu app không ở loopback:3100 hoặc Supabase khai báo không phải runtime cô lập 45441 (G5).
// Script đăng nhập bằng trình duyệt (tài khoản seed) rồi gửi request document không theo redirect để đọc status thật.
import { chromium } from "@playwright/test";
import { assertIsolatedAdminGateTargets } from "./admin-gate-fixture.mjs";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
assertIsolatedAdminGateTargets(process.env, baseURL);
const NOT_FOUND_TEXT = "Không tìm thấy trang";
const ADMIN_SHELL_TEXT = "Menu Quản Trị";
const failures = [];

function check(label, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!condition) failures.push(label);
}

async function login(browser, email) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("123123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.close();
  return context;
}

async function documentRequest(request, path) {
  const response = await request.get(`${baseURL}${path}`, { maxRedirects: 0 });
  return { status: response.status(), location: response.headers().location ?? null, body: await response.text() };
}

const browser = await chromium.launch();
try {
  const guest = await browser.newContext({ baseURL });
  for (const path of ["/admin", "/admin/user-management", "/admin/courses"]) {
    const res = await documentRequest(guest.request, `${path}?next=https://evil.example`);
    check(
      `guest ${path} -> 307 /login?reason=signin_required`,
      res.status === 307 && new URL(res.location, baseURL).pathname + new URL(res.location, baseURL).search === "/login?reason=signin_required",
      `status ${res.status}, location ${res.location}`,
    );
  }
  await guest.close();

  for (const [role, email] of [["student", "student@gmail.com"], ["teacher", "teacher@gmail.com"]]) {
    const context = await login(browser, email);
    for (const path of ["/admin", "/admin/user-management", "/admin/courses"]) {
      const res = await documentRequest(context.request, path);
      check(
        `${role} ${path} -> 404 with the not-found page and no admin shell`,
        res.status === 404 && res.body.includes(NOT_FOUND_TEXT) && !res.body.includes(ADMIN_SHELL_TEXT),
        `status ${res.status}, notFoundPage ${res.body.includes(NOT_FOUND_TEXT)}, adminShell ${res.body.includes(ADMIN_SHELL_TEXT)}`,
      );
    }
    await context.close();
  }

  const admin = await login(browser, "admin@gmail.com");
  for (const path of ["/admin", "/admin/user-management", "/admin/courses"]) {
    const res = await documentRequest(admin.request, path);
    check(`admin ${path} -> 200 with the admin shell`, res.status === 200 && res.body.includes(ADMIN_SHELL_TEXT), `status ${res.status}`);
  }
  for (const path of ["/admin/stats", "/admin/settings"]) {
    const res = await documentRequest(admin.request, path);
    check(
      `admin ${path} -> 404 with the not-found page and no admin shell`,
      res.status === 404 && res.body.includes(NOT_FOUND_TEXT) && !res.body.includes(ADMIN_SHELL_TEXT),
      `status ${res.status}`,
    );
  }
  await admin.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll admin gate status checks passed.");

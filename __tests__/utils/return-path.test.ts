import { describe, expect, it } from "vitest";
import {
  isHttpsRequest,
  lastSignInMethodCookieOptions,
  parseLastSignInMethod,
  parseReturnPath,
  resolveReturnPath,
  returnPathCookieOptions,
} from "@/lib/auth/return-path";

// Test plan:
// - Mục tiêu: U3 G1/G2/G5 — trang đích sau đăng nhập chỉ là pathname nội bộ thuộc /teacher, /profile, /admin;
//   mọi dạng có thể thành open redirect hoặc vượt thư mục đều về `/`; thuộc tính cookie đúng như plan.
// - Loại test: unit helper + schema thuần.
// - Đối tượng: parseReturnPath/resolveReturnPath (returnPathSchema), parseLastSignInMethod, isHttpsRequest, cookie options.
// - Case thành công: path đúng ba vùng, kể cả path sâu và %XX bình thường; `email`/`google`.
// - Case thất bại: /learn, path giống tên, URL tuyệt đối, `//`, `\`, %2F/%5C/%2E và ký tự điều khiển đã encode,
//   đoạn `.`/`..`, ký tự điều khiển thô, quá 512 ký tự, rỗng và giá trị không phải chuỗi.
// - Bảo mật: G1 kiểm cả lúc ghi lẫn lúc đọc bằng cùng hàm này; G2 Secure theo giao thức, không theo NODE_ENV.

describe("parseReturnPath", () => {
  it.each(["/teacher", "/teacher/courses/x", "/profile", "/profile/orders", "/admin", "/admin/courses", "/teacher/courses/%E1%BA%A1"])(
    "accepts %s",
    (path) => {
      expect(parseReturnPath(path)).toBe(path);
      expect(resolveReturnPath(path)).toBe(path);
    },
  );

  it.each([
    ["/learn/x", "/learn/x"],
    ["the home page", "/"],
    ["the login page", "/login"],
    ["a look-alike prefix", "/teacherx"],
    ["a look-alike admin prefix", "/administrator"],
    ["a protocol-relative URL", "//evil.com"],
    ["a backslash host", "/\\evil.com"],
    ["an absolute URL", "https://evil.com"],
    ["an absolute URL with an allowed path", "https://evil.com/profile"],
    ["an encoded double slash", "/%2F%2Fevil.com"],
    ["an encoded slash inside a segment", "/profile/%2fevil"],
    ["an encoded backslash", "/%5Cevil"],
    ["an encoded backslash inside a segment", "/admin/%5cevil"],
    ["an encoded dot segment", "/profile/%2e%2e/login"],
    ["an encoded control character", "/profile/%0a"],
    ["a parent segment", "/profile/../login"],
    ["a current segment", "/teacher/./courses"],
    ["an empty segment", "/teacher//courses"],
    ["a trailing slash", "/profile/"],
    ["a raw control character", "/profile/\nx"],
    ["a query string", "/profile?next=//evil.com"],
    ["a hash", "/profile#x"],
    ["a too long path", `/profile/${"a".repeat(504)}`],
    ["an empty string", ""],
  ])("rejects %s and falls back to the home page", (_label, path) => {
    expect(parseReturnPath(path)).toBeNull();
    expect(resolveReturnPath(path)).toBe("/");
  });

  it("accepts a path of exactly 512 characters", () => {
    const path = `/profile/${"a".repeat(503)}`;
    expect(path).toHaveLength(512);
    expect(parseReturnPath(path)).toBe(path);
  });

  it.each([undefined, null, 42, ["/profile"], { path: "/profile" }])("rejects the non-string value %j", (value) => {
    expect(parseReturnPath(value)).toBeNull();
    expect(resolveReturnPath(value)).toBe("/");
  });
});

describe("parseLastSignInMethod", () => {
  it.each(["email", "google"] as const)("accepts %s", (method) => {
    expect(parseLastSignInMethod(method)).toBe(method);
  });

  it.each(["Email", "github", "", "email ", undefined, 1])("treats %j as absent", (value) => {
    expect(parseLastSignInMethod(value)).toBeNull();
  });
});

describe("isHttpsRequest", () => {
  it.each([
    [{ "x-forwarded-proto": "https" }, true],
    [{ "x-forwarded-proto": "https,http" }, true],
    [{ "x-forwarded-proto": "http", origin: "https://vocaspace.vercel.app" }, false],
    [{ origin: "https://vocaspace.vercel.app" }, true],
    [{ origin: "http://127.0.0.1:3100" }, false],
    [{ origin: "not a url" }, false],
    [{}, false],
  ])("reads %j as HTTPS=%s", (values, expected) => {
    expect(isHttpsRequest(new Headers(values))).toBe(expected);
  });
});

describe("cookie options", () => {
  it("keeps the return path HttpOnly, Lax, site-wide and ten minutes long", () => {
    expect(returnPathCookieOptions(true)).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 600 });
    expect(returnPathCookieOptions(false).secure).toBe(false);
  });

  it("keeps the last sign-in method HttpOnly, Lax, site-wide and 180 days long", () => {
    expect(lastSignInMethodCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 180 * 24 * 60 * 60,
    });
  });
});

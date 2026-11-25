import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTH_EMAIL_ENGLISH_MARKER } from "@/lib/i18n/auth-email";

// Test plan:
// - Mục tiêu: English localization U6 G2/G3 - marker app gửi khớp từng ký tự với điều kiện trong template, subject và allowlist
//   của Supabase local, và link trong cả hai nhánh vẫn dựng từ `.SiteURL`.
// - Loại test: đọc tệp cấu hình; Node không render được Go template, nên việc Auth chọn nhánh nào được kiểm bằng email thật
//   trên stack local (U6 CP1), không ở đây.
// - Khoảng trống đã biết: template và allowlist hosted không nằm trong repo.

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const CONDITION = `{{ if eq .RedirectTo "${AUTH_EMAIL_ENGLISH_MARKER}" }}`;

describe("auth email templates", () => {
  it("uses the production site URL as the fixed marker", () => {
    expect(AUTH_EMAIL_ENGLISH_MARKER).toBe("https://vocaspace.com/?lang=en");
  });

  it.each([
    ["supabase/templates/confirmation.html", "type=email"],
    ["supabase/templates/recovery.html", "type=recovery"],
  ])("%s branches on the exact marker and builds both links from .SiteURL", (file, type) => {
    const body = read(file);
    expect(body.startsWith(CONDITION)).toBe(true);
    expect(body.trimEnd().endsWith("{{ end }}")).toBe(true);
    const link = `href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&${type}"`;
    expect(body.split(link)).toHaveLength(3);
    expect(body).not.toContain("{{ .RedirectTo }}");
  });

  it("chooses the subjects on the same marker and allows it as a redirect URL", () => {
    const config = read("supabase/config.toml");
    const escaped = CONDITION.replaceAll('"', '\\"');
    expect(config).toContain(`subject = "${escaped}Verify your VocaSpace email{{ else }}Xác minh email VocaSpace{{ end }}"`);
    expect(config).toContain(`subject = "${escaped}Reset your VocaSpace password{{ else }}Đặt lại mật khẩu VocaSpace{{ end }}"`);
    const allowlist = config.match(/^additional_redirect_urls = \[(.*)\]$/m)?.[1] ?? "";
    expect(allowlist.split(", ")).toContain(`"${AUTH_EMAIL_ENGLISH_MARKER}"`);
  });
});

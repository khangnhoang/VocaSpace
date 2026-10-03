// Test plan:
// - Mục tiêu: kiểm tra link checker chỉ chặn link markdown hỏng mới và chấp nhận link hỏng đã ghi trong baseline.
// - Loại test: Node CLI black-box với fixture tạm.
// - Đối tượng: `scripts/docs/check-links.mjs`.
// - Case thành công: link hợp lệ (file, thư mục, fragment, link ngoài, ví dụ trong code) thoát 0; link hỏng có trong baseline thoát 0.
// - Case thất bại: link hỏng không có trong baseline thoát 1 và nêu đúng link; sai chữ hoa/thường bị coi là hỏng; usage sai thoát 2.
// - Invariant cần giữ: kết quả chỉ phụ thuộc vào cây fixture và baseline, không phụ thuộc repo thật.
// - Kết quả verify gần nhất: `node --test scripts/docs/check-links.test.mjs`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./check-links.mjs", import.meta.url));

function createFixture(files, baselineLines = []) {
  const root = mkdtempSync(join(tmpdir(), "check-links-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  const baseline = join(root, "baseline.txt");
  writeFileSync(baseline, ["# comment", ...baselineLines, ""].join("\n"));
  return { root, baseline, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function runCheck({ root, baseline }) {
  const result = spawnSync(process.execPath, [scriptPath, "--root", root, "--baseline", baseline], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("valid relative links exit 0", () => {
  const fixture = createFixture({
    "AGENTS.md": "See [docs](docs/guide.md#top) and [folder](docs/sub/).\n",
    "README.md": "[agents](AGENTS.md) [web](https://example.com/x) [mail](mailto:a@b.c) [anchor](#here)\n",
    "docs/guide.md": "Back to [root](../README.md).\n\n```md\n[sample](missing-in-code.md)\n```\n\nInline `[sample](also-missing.md)`.\n",
    "docs/sub/page.md": "[up](../guide.md)\n",
  });
  try {
    const result = runCheck(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Broken links: 0 \(0 in baseline, 0 new\)/);
  } finally {
    fixture.cleanup();
  }
});

test("a broken link listed in the baseline is accepted", () => {
  const fixture = createFixture(
    { "docs/old.md": "[gone](missing.md)\n" },
    ["docs/old.md -> missing.md"],
  );
  try {
    const result = runCheck(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Broken links: 1 \(1 in baseline, 0 new\)/);
  } finally {
    fixture.cleanup();
  }
});

test("a broken link missing from the baseline exits non-zero and is named", () => {
  const fixture = createFixture(
    { "docs/old.md": "[gone](missing.md)\n", "docs/new.md": "[fresh](nowhere.md)\n" },
    ["docs/old.md -> missing.md"],
  );
  try {
    const result = runCheck(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NEW broken link: docs\/new\.md -> nowhere\.md/);
    assert.doesNotMatch(result.stderr, /old\.md/);
  } finally {
    fixture.cleanup();
  }
});

test("a link whose letter case differs from the real file is broken on every OS", () => {
  const fixture = createFixture({
    "docs/Target.md": "target\n",
    "docs/index.md": "[wrong case](target.md)\n",
  });
  try {
    const result = runCheck(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /docs\/index\.md -> target\.md/);
  } finally {
    fixture.cleanup();
  }
});

test("unknown arguments exit 2", () => {
  const result = spawnSync(process.execPath, [scriptPath, "--bogus", "x"], { encoding: "utf8" });
  assert.equal(result.status, 2);
});

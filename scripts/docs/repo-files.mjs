// Chọn file cho các scanner docs: tracked + untracked-không-bị-ignore của git, để kết quả local và CI giống nhau
// (thư mục bị gitignore như docs/native-multi-agent/reviews/ không có trên clean checkout nên không được quét).
// Root không phải thư mục gốc của một git work tree (fixture test, thư mục tải về) thì trả null để caller
// quay lại duyệt filesystem.

import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

function samePath(a, b) {
  const normalize = (value) => {
    let real = value;
    try {
      real = realpathSync(value);
    } catch {
      // đường dẫn không tồn tại thì so sánh nguyên văn
    }
    const full = resolve(real);
    return process.platform === "win32" ? full.toLowerCase() : full;
  };
  return normalize(a) === normalize(b);
}

export function repoFileIndex(root) {
  const top = spawnSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (top.status !== 0 || !samePath(top.stdout.trim(), root)) return null;
  const listed = spawnSync(
    "git",
    ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (listed.status !== 0) return null;

  const files = new Set(
    listed.stdout
      .split("\0")
      .filter(Boolean)
      // `--cached` vẫn liệt kê file đã bị xóa khỏi working tree nhưng chưa stage việc xóa
      .filter((rel) => existsSync(join(root, rel))),
  );
  const dirs = new Set([""]);
  for (const rel of files) {
    let index = rel.lastIndexOf("/");
    while (index > 0) {
      dirs.add(rel.slice(0, index));
      index = rel.lastIndexOf("/", index - 1);
    }
  }
  return {
    files: [...files],
    has: (rel) => files.has(rel),
    hasDir: (rel) => dirs.has(rel),
  };
}

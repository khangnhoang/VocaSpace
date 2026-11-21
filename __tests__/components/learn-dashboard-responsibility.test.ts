import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import viCommon from "@/messages/vi/common.json";

describe("learner dashboard responsibility", () => {
  it("removes the learner dashboard from profile and adds authenticated /learn navigation", () => {
    const profileSource = readFileSync(
      join(process.cwd(), "app/(client)/profile/page.tsx"),
      "utf8",
    );
    const headerSource = readFileSync(
      join(process.cwd(), "components/ui/header.tsx"),
      "utf8",
    );

    expect(profileSource).not.toContain("CoursesPlaceholder");
    expect(headerSource).toContain('href="/learn"');
    // English localization U1 (Owner chấp nhận ngoại lệ G7, 2026-11-22): nhãn nằm trong catalog; kiểm khóa trong mã nguồn
    // và giá trị tiếng Việt đúng nguyên văn cũ.
    expect(headerSource).toContain('t("account.learningSpace")');
    expect(viCommon.account.learningSpace).toBe("Không gian học tập");
  });
});

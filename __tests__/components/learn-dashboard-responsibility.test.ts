import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
    expect(headerSource).toContain("Không gian học tập");
  });
});

import { describe, expect, it } from "vitest";
import { curveGeometry, recallAt, REVIEW_THRESHOLD, REVIEW_X, xForDay, yForRecall } from "@/lib/auth/memory-curve";
import { mailboxLinkFor, suggestEmailCorrection } from "@/lib/auth/email-help";
import { PASSWORD_STRENGTH_LABELS, passwordStrength } from "@/lib/auth/password-strength";

// Test plan:
// - Mục tiêu: U3 AC4 (thước đo độ mạnh mật khẩu chỉ gợi ý), AC12 (đường cong minh hoạ đúng công thức FSRS và đúng số mốc theo từng màn) và AC5 (gợi ý email chỉ
//   cho lỗi gõ gần tên miền phổ biến, không bao giờ cho tên miền thật; link hộp thư chỉ cho Gmail/Outlook/Yahoo).
// - Loại test: unit hàm thuần.
// - Case chính: R(S) = 90% ở mỗi lần ôn; trục thời gian tăng dần; số đoạn/mốc của login, register 1–5, settled, forgot.
// - Case biên: tên miền đúng, tên miền thật bị loại trừ, cách xa hơn 2 ký tự, thiếu phần trước/sau @, chữ hoa.

describe("memory curve", () => {
  it("reaches the 90% review threshold exactly when elapsed days equal the stability", () => {
    for (const stability of [1, 2, 4, 23, 60]) {
      expect(recallAt(stability, stability)).toBeCloseTo(REVIEW_THRESHOLD, 10);
    }
    expect(recallAt(0, 3)).toBe(1);
  });

  it("orders review marks left to right and maps higher recall higher on the chart", () => {
    expect([...REVIEW_X].sort((a, b) => a - b)).toEqual(REVIEW_X);
    expect(xForDay(0)).toBeLessThan(xForDay(1));
    expect(yForRecall(1)).toBeLessThan(yForRecall(0.9));
  });

  it("draws the whole curve, the no-review ghost and the current last node on /login", () => {
    const geometry = curveGeometry({ kind: "login" });
    expect(geometry.paths).toHaveLength(5);
    expect(geometry.nodes.map((node) => node.tone)).toEqual(["recall", "recall", "recall", "recall", "current"]);
    expect(geometry.ghost).not.toBeNull();
    expect(geometry.preview).toBeNull();
  });

  it.each([1, 2, 3, 4, 5] as const)("shows %i review marks with the last one current at register stage %i", (stage) => {
    const geometry = curveGeometry({ kind: "register", stage });
    expect(geometry.nodes).toHaveLength(stage);
    expect(geometry.paths).toHaveLength(stage - 1);
    expect(geometry.nodes.at(-1)?.tone).toBe("current");
    expect(geometry.preview).not.toBeNull();
    expect(geometry.reachedTick).toBe(stage - 1);
  });

  it("shows the settled curve without a ghost on /auth/set-password", () => {
    const geometry = curveGeometry({ kind: "settled" });
    expect(geometry.paths).toHaveLength(5);
    expect(geometry.ghost).toBeNull();
  });

  it("shows a lapse to a low point, then a relearn jump only after sending", () => {
    const before = curveGeometry({ kind: "forgot", sent: false });
    expect(before.nodes.map((node) => node.key)).toEqual(["node-0", "node-1", "node-2", "low"]);
    expect(before.nodes.at(-1)?.label).toBe("Quên dần");
    expect(before.nodes.at(-1)!.y).toBeGreaterThan(yForRecall(REVIEW_THRESHOLD));

    const after = curveGeometry({ kind: "forgot", sent: true });
    expect(after.nodes.map((node) => node.key)).toEqual(["node-0", "node-1", "node-2", "low", "relearn"]);
    expect(after.nodes.at(-1)).toMatchObject({ label: "Ôn lại", y: Math.round(yForRecall(1) * 10) / 10 });
  });

  it("keeps stable keys so a later variant only adds new parts", () => {
    const stage2 = curveGeometry({ kind: "register", stage: 2 }).paths.map((path) => path.key);
    const stage3 = curveGeometry({ kind: "register", stage: 3 }).paths.map((path) => path.key);
    expect(stage3.slice(0, stage2.length)).toEqual(stage2);
  });
});

describe("suggestEmailCorrection", () => {
  it.each([
    ["lan@gmial.com", "lan@gmail.com"],
    ["lan@gmai.com", "lan@gmail.com"],
    ["lan@GMAIL.CON", "lan@gmail.com"],
    ["lan@yaho.com", "lan@yahoo.com"],
    ["lan@outlok.com", "lan@outlook.com"],
    ["lan@hotmial.com", "lan@hotmail.com"],
    ["lan@icloud.co", "lan@icloud.com"],
    ["  lan@gmail.co  ", "lan@gmail.com"],
  ])("suggests a fix for %s", (value, expected) => {
    expect(suggestEmailCorrection(value)).toBe(expected);
  });

  it.each([
    "lan@gmail.com",
    "lan@Gmail.com",
    "lan@ymail.com",
    "lan@mail.com",
    "lan@email.com",
    "lan@live.com",
    "lan@msn.com",
    "lan@gmx.com",
    "lan@aol.com",
    "lan@yahoo.ca",
    "lan@hotmail.ca",
    "lan@outlook.fr",
    "lan@fpt.edu.vn",
    "lan@company.vn",
    "lan",
    "@gmial.com",
    "lan@",
    "",
  ])("does not suggest anything for %j", (value) => {
    expect(suggestEmailCorrection(value)).toBeNull();
  });
});

describe("mailboxLinkFor", () => {
  it.each([
    ["lan@gmail.com", "Mở Gmail"],
    ["lan@outlook.com", "Mở Outlook"],
    ["lan@hotmail.com", "Mở Outlook"],
    ["lan@yahoo.com", "Mở Yahoo Mail"],
  ])("links %s to its inbox", (value, label) => {
    expect(mailboxLinkFor(value)?.label).toBe(label);
    expect(mailboxLinkFor(value)?.href).toMatch(/^https:\/\//);
  });

  it.each(["lan@icloud.com", "lan@company.vn", "lan", ""])("offers no inbox link for %j", (value) => {
    expect(mailboxLinkFor(value)).toBeNull();
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", 0],
    ["abc12", 0],
    ["abcdef", 1],
    ["abcdefghij", 2],
    ["abcDefgh", 2],
    ["abc#12", 2],
    ["abcDef#2026xy", 4],
    ["ABCDEFGHIJKL", 2],
  ] as const)("rates %j as level %i", (password, level) => {
    expect(passwordStrength(password)).toBe(level);
  });

  it("labels every level", () => {
    expect(PASSWORD_STRENGTH_LABELS).toEqual(["Chưa đủ 6 ký tự", "Yếu", "Tạm được", "Khá", "Mạnh"]);
  });
});

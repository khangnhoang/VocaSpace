import { describe, expect, it } from "vitest";
import { adminUserIdSchema, adminUserSchema, adminUserUpdateSchema } from "@/lib/schemas/auth";

describe("admin user update input", () => {
  const valid = { full_name: "Admin Test", username: "admin_test", phone: "", role: "admin" };

  it("accepts editable fields without email and strips immutable fields", () => {
    expect(adminUserUpdateSchema.parse({ ...valid, email: "ignored", removed_at: "now", actorId: "other" })).toEqual(valid);
  });

  it("keeps email required for account creation", () => {
    expect(adminUserSchema.safeParse(valid).success).toBe(false);
    expect(adminUserSchema.safeParse({ ...valid, email: "admin@example.com" }).success).toBe(true);
  });

  it.each(["root", "", null])("rejects invalid role %s", (role) => {
    expect(adminUserUpdateSchema.safeParse({ ...valid, role }).success).toBe(false);
  });

  it("normalizes UUID case before identity comparison", () => {
    expect(adminUserIdSchema.parse("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA")).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(adminUserIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

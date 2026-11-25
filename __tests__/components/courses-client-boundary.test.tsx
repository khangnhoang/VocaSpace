import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "@/__tests__/support/intl";
import CoursesLayout from "@/app/(client)/courses/layout";
import CourseSlugLayout from "@/app/(client)/courses/[course-slug]/layout";
import CoursePreviewLayout from "@/app/(client)/courses/[course-slug]/preview/layout";
import LearnLayout from "@/app/(client)/learn/layout";
import LearnDashboardLayout from "@/app/(client)/learn/(dashboard)/layout";
import LearnCourseLayout from "@/app/(client)/learn/[course-slug]/layout";
import LearnTopicLayout from "@/app/(client)/learn/[course-slug]/[topic-slug]/layout";
import { PublicCourseDetailView } from "@/app/(client)/courses/_components/PublicCourseDetailView";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: giữ hai ranh giới của U2 trên /courses: (1) props từ Server Component sang thẻ ghi danh phải serialize được, (2) mỗi
//   layout chỉ giao namespace subtree đó dùng (G4, H2), gồm /, /learn và trang bài học.
// - Loại test: render tĩnh trang chi tiết với thẻ ghi danh được thay bằng bản ghi props; layout được gọi trực tiếp với
//   ClientNamespaces thay bằng bản ghi namespace.
// - Case thất bại đã gặp: bản đầu truyền hàm dịch `t` từ PublicCourseDetailView (server) xuống PublicCourseEnrollmentCard (client);
//   `next build` báo "Functions cannot be passed directly to Client Components" ở /courses/[slug] cho cả khách lẫn học viên, còn
//   test render trực tiếp không thấy lỗi vì không có ranh giới server/client.
// - Bảo mật/phân quyền: không áp dụng ở tầng này.
// - Invariant cần giữ: không giá trị hàm nào (kể cả lồng trong object/mảng) đi qua props của thẻ ghi danh; danh mục chỉ nhận
//   `courses`, chi tiết thêm `learning`, xem thử thêm `flashcard`.
// - Giới hạn: test này bảo vệ thẻ ghi danh là client component duy nhất nhận props từ trang chi tiết; bước `next build` + tải
//   /courses/[slug] cho khách và học viên vẫn là bằng chứng cuối cho toàn bộ ranh giới.

const captured = vi.hoisted(() => ({ props: [] as unknown[] }));

vi.mock("@/app/(client)/courses/_components/PublicCourseEnrollmentCard", () => {
  const Card = (props: unknown) => {
    captured.props.push(props);
    return null;
  };
  return { PublicCourseEnrollmentCard: Card, PublicCourseEnrollmentCardLocalized: Card };
});

vi.mock("@/components/i18n/client-namespaces", () => ({
  ClientNamespaces: ({ namespaces }: { namespaces: readonly string[]; children: ReactNode }) => (
    <meta data-namespaces={namespaces.join(",")} />
  ),
}));

function findFunctionPaths(value: unknown, path = "props", seen = new Set<unknown>()): string[] {
  if (typeof value === "function") return [path];
  if (typeof value !== "object" || value === null || seen.has(value)) return [];
  seen.add(value);
  return Object.entries(value).flatMap(([key, child]) => findFunctionPaths(child, `${path}.${key}`, seen));
}

function course(overrides: Partial<PublicCourseDetail> = {}): PublicCourseDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "TOEIC nền tảng",
    slug: "toeic-nen-tang",
    description: "Lộ trình TOEIC rõ ràng cho người mới bắt đầu.",
    thumbnail_url: null,
    price: 250000,
    created_at: "2026-07-10T10:00:00.000Z",
    enrollment_count: 42,
    is_preview_suspended: false,
    owner: { id: "22222222-2222-4222-8222-222222222222", full_name: "Giảng viên", avatar_url: null, bio: null, experience_years: null, certifications: null },
    collaborators: [],
    syllabus: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Chương 1",
        order_index: 0,
        topics: [{ id: "55555555-5555-4555-8555-555555555555", title: "Chủ đề 1", slug: "chu-de-1", order_index: 0, is_preview: true }],
      },
    ],
    is_enrolled: false,
    learner_progress: null,
    ...overrides,
  };
}

function namespacesOf(layout: ReactElement) {
  return /data-namespaces="([^"]*)"/.exec(renderToStaticMarkup(layout))?.[1];
}

describe("course detail server to client boundary", () => {
  it.each([
    ["a guest", course()],
    [
      "an enrolled learner",
      course({ is_enrolled: true, learner_progress: { completed_topic_ids: [], next_topic_slug: "chu-de-1" } }),
    ],
  ])("passes only serializable props to the enrollment card for %s", (_label, detail) => {
    captured.props.length = 0;

    renderToStaticMarkup(<PublicCourseDetailView course={detail} />);

    expect(captured.props).toHaveLength(1);
    expect(findFunctionPaths(captured.props[0])).toEqual([]);
  });
});

describe("courses layouts deliver only the namespaces their subtree renders", () => {
  it("gives the catalog layout courses only", () => {
    expect(namespacesOf(<CoursesLayout>x</CoursesLayout>)).toBe("courses");
  });

  it("adds learning for course detail and preview", () => {
    expect(namespacesOf(<CourseSlugLayout>x</CourseSlugLayout>)).toBe("courses,learning");
  });

  it("adds flashcard only for the public preview subtree", () => {
    expect(namespacesOf(<CoursePreviewLayout>x</CoursePreviewLayout>)).toBe("courses,learning,flashcard");
  });
});

describe("learn and home deliver flashcard only where it renders", () => {
  it("gives the learn root layout no provider of its own", () => {
    expect(namespacesOf(<LearnLayout>x</LearnLayout>)).toBeUndefined();
  });

  it("gives the dashboard, the course overview and the topic page their namespaces", () => {
    expect(namespacesOf(<LearnDashboardLayout>x</LearnDashboardLayout>)).toBe("flashcard,learning,learn,payments");
    expect(namespacesOf(<LearnTopicLayout>x</LearnTopicLayout>)).toBe("flashcard,learning,learn");
    expect(namespacesOf(<LearnCourseLayout>x</LearnCourseLayout>)).toBe("learning,learn");
  });

  it("gives / home and flashcard only, never courses", () => {
    // Trang chủ là Server Component bất đồng bộ nhiều phụ thuộc, nên đọc danh sách namespace từ mã nguồn.
    const source = readFileSync(join(process.cwd(), "app/(client)/page.tsx"), "utf8");
    const delivered = /<ClientNamespaces namespaces=\{\[([^\]]*)\]\}/.exec(source)?.[1].replace(/["\s]/g, "");
    expect(delivered).toBe("home,flashcard");
  });
});

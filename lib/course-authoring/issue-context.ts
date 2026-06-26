import { z } from "zod";
import {
  getCourseStructurePath,
  getTopicBuilderPath,
  TOPIC_BUILDER_TABS,
  type TopicBuilderTab,
} from "@/lib/course-authoring/routes";
import type { CourseReadinessIssueCode } from "@/lib/schemas/course-readiness";

export const COURSE_AUTHORING_ISSUE_TARGET_TYPES = [
  "course",
  "chapter",
  "topic",
  "exercise",
  "question_group",
  "question",
] as const;

type CourseAuthoringSurface = "course_structure" | "topic_builder";

export type CourseAuthoringIssueTargetType =
  (typeof COURSE_AUTHORING_ISSUE_TARGET_TYPES)[number];

type CourseAuthoringIssueRule = {
  surface: CourseAuthoringSurface;
  targetType: CourseAuthoringIssueTargetType;
  tab?: TopicBuilderTab;
  allowedTabs?: readonly TopicBuilderTab[];
};

export const COURSE_AUTHORING_ISSUE_CONTEXT_RULES = {
  course_has_no_chapters: {
    surface: "course_structure",
    targetType: "course",
  },
  chapter_has_no_topics: {
    surface: "course_structure",
    targetType: "chapter",
  },
  topic_has_no_learning_content: {
    surface: "topic_builder",
    targetType: "topic",
    tab: "exercises",
    allowedTabs: ["flashcards", "exercises"],
  },
  exercise_requires_group: {
    surface: "topic_builder",
    targetType: "exercise",
    tab: "exercises",
  },
  question_group_has_no_active_questions: {
    surface: "topic_builder",
    targetType: "question_group",
    tab: "exercises",
  },
  exercise_requires_standalone_question: {
    surface: "topic_builder",
    targetType: "exercise",
    tab: "exercises",
  },
  exercise_has_orphan_questions: {
    surface: "topic_builder",
    targetType: "exercise",
    tab: "exercises",
  },
  exercise_group_missing_context: {
    surface: "topic_builder",
    targetType: "question_group",
    tab: "exercises",
  },
  question_missing_content: {
    surface: "topic_builder",
    targetType: "question",
    tab: "exercises",
  },
  question_has_too_few_options: {
    surface: "topic_builder",
    targetType: "question",
    tab: "exercises",
  },
  question_has_no_correct_option: {
    surface: "topic_builder",
    targetType: "question",
    tab: "exercises",
  },
} as const satisfies Record<CourseReadinessIssueCode, CourseAuthoringIssueRule>;

type CourseAuthoringIssueRuleMap = typeof COURSE_AUTHORING_ISSUE_CONTEXT_RULES;
type CourseAuthoringIssueCode = keyof CourseAuthoringIssueRuleMap;

type CourseAuthoringIssueCodesBySurface<TSurface extends CourseAuthoringSurface> = {
  [TCode in CourseAuthoringIssueCode]: CourseAuthoringIssueRuleMap[TCode]["surface"] extends TSurface
    ? TCode
    : never;
}[CourseAuthoringIssueCode];

export type CourseAuthoringIssueContext = {
  [TCode in CourseAuthoringIssueCode]: {
    issue: TCode;
    targetType: CourseAuthoringIssueRuleMap[TCode]["targetType"];
    target: string;
  } & (CourseAuthoringIssueRuleMap[TCode] extends { tab: TopicBuilderTab }
    ? { tab: TopicBuilderTab }
    : { tab?: never });
}[CourseAuthoringIssueCode];

export type CourseStructureIssueContext = Extract<
  CourseAuthoringIssueContext,
  {
    issue: CourseAuthoringIssueCodesBySurface<"course_structure">;
  }
>;

export type TopicBuilderIssueContext = Extract<
  CourseAuthoringIssueContext,
  {
    issue: CourseAuthoringIssueCodesBySurface<"topic_builder">;
  }
>;

export type ParsedCourseAuthoringIssueContext = CourseAuthoringIssueContext & {
  from: "dashboard";
};

const DASHBOARD_ISSUE_CONTEXT_PARAM_KEYS = [
  "from",
  "issue",
  "targetType",
  "target",
] as const;

export const COURSE_STRUCTURE_ISSUE_UNAVAILABLE_PARAM = "issue_unavailable";
export const COURSE_STRUCTURE_HIGHLIGHT_CHAPTER_PARAM = "chapter";

const courseAuthoringIssueContextSchema = z.strictObject({
  from: z.literal("dashboard"),
  issue: z.string(),
  targetType: z.enum(COURSE_AUTHORING_ISSUE_TARGET_TYPES),
  target: z.uuid(),
  tab: z.enum(TOPIC_BUILDER_TABS).optional(),
});

const courseAuthoringIssueDestinationSchema = z.strictObject({
  from: z.literal("dashboard"),
  issue: z.string(),
  targetType: z.enum(COURSE_AUTHORING_ISSUE_TARGET_TYPES),
  target: z.uuid(),
  tab: z.string().optional(),
});

const courseStructureIssueFeedbackSchema = z.strictObject({
  issueUnavailable: z.literal("1"),
  chapterId: z.uuid().optional(),
});

// Trạng thái này tách URL hỏng hoàn toàn khỏi URL chỉ sai tab.
// Khi chỉ sai tab, trang vẫn giữ được đúng vấn đề và đưa giáo viên về tab an toàn.
export type CourseAuthoringIssueDestinationState =
  | {
      kind: "none";
    }
  | {
      kind: "valid";
      context: ParsedCourseAuthoringIssueContext;
    }
  | {
      kind: "invalid_tab";
      context: ParsedCourseAuthoringIssueContext;
      receivedTab: string | null;
    }
  | {
      kind: "invalid_context";
    };

function getIssueRule(issue: string) {
  return COURSE_AUTHORING_ISSUE_CONTEXT_RULES[
    issue as CourseAuthoringIssueCode
  ];
}

function isContextConsistent(
  context: z.output<typeof courseAuthoringIssueContextSchema>,
): context is ParsedCourseAuthoringIssueContext {
  const rule = getIssueRule(context.issue);
  if (!rule) return false;
  if (context.targetType !== rule.targetType) return false;

  if (rule.surface === "course_structure") {
    return context.tab == null;
  }

  return getAllowedTopicBuilderTabs(rule).includes(context.tab as TopicBuilderTab);
}

function assertIssueContext(context: CourseAuthoringIssueContext) {
  if (
    !isContextConsistent({
      from: "dashboard",
      ...context,
    })
  ) {
    throw new Error("Invalid course authoring issue context.");
  }
}

function appendDashboardIssueContext(
  path: string,
  context: CourseAuthoringIssueContext,
) {
  assertIssueContext(context);

  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);

  params.set("from", "dashboard");
  params.set("issue", context.issue);
  params.set("targetType", context.targetType);
  params.set("target", context.target);

  if (context.tab) {
    params.set("tab", context.tab);
  }

  return `${pathname}?${params.toString()}`;
}

export function getCourseStructureIssuePath(
  courseId: string,
  context: CourseStructureIssueContext,
) {
  return appendDashboardIssueContext(getCourseStructurePath(courseId), context);
}

export function getTopicBuilderIssuePath(
  courseId: string,
  topicId: string,
  context: TopicBuilderIssueContext,
) {
  return appendDashboardIssueContext(
    getTopicBuilderPath(courseId, topicId),
    context,
  );
}

export function parseCourseAuthoringIssueContext(
  rawSearchParams: string | URLSearchParams,
): ParsedCourseAuthoringIssueContext | null {
  const params =
    typeof rawSearchParams === "string"
      ? new URLSearchParams(rawSearchParams)
      : rawSearchParams;

  const parsed = courseAuthoringIssueContextSchema.safeParse({
    from: params.get("from"),
    issue: params.get("issue"),
    targetType: params.get("targetType"),
    target: params.get("target"),
    ...(params.get("tab") ? { tab: params.get("tab") } : {}),
  });

  if (!parsed.success) return null;
  return isContextConsistent(parsed.data) ? parsed.data : null;
}

export function parseCourseAuthoringIssueDestination(
  rawSearchParams: string | URLSearchParams,
): CourseAuthoringIssueDestinationState {
  const params =
    typeof rawSearchParams === "string"
      ? new URLSearchParams(rawSearchParams)
      : rawSearchParams;

  if (params.get("from") !== "dashboard") {
    return { kind: "none" };
  }

  const parsed = courseAuthoringIssueDestinationSchema.safeParse({
    from: params.get("from"),
    issue: params.get("issue"),
    targetType: params.get("targetType"),
    target: params.get("target"),
    ...(params.get("tab") ? { tab: params.get("tab") } : {}),
  });

  if (!parsed.success) return { kind: "invalid_context" };

  const rule = getIssueRule(parsed.data.issue);
  if (!rule || parsed.data.targetType !== rule.targetType) {
    return { kind: "invalid_context" };
  }

  if (rule.surface === "course_structure") {
    if (parsed.data.tab != null) return { kind: "invalid_context" };

    return {
      kind: "valid",
      context: parsed.data as ParsedCourseAuthoringIssueContext,
    };
  }

  const allowedTabs = getAllowedTopicBuilderTabs(rule);
  if (!isTopicBuilderTab(parsed.data.tab) || !allowedTabs.includes(parsed.data.tab)) {
    return {
      kind: "invalid_tab",
      context: {
        from: "dashboard",
        issue: parsed.data.issue,
        targetType: parsed.data.targetType,
        target: parsed.data.target,
        tab: rule.tab,
      } as ParsedCourseAuthoringIssueContext,
      receivedTab: parsed.data.tab ?? null,
    };
  }

  return {
    kind: "valid",
    context: parsed.data as ParsedCourseAuthoringIssueContext,
  };
}

export function hasDashboardIssueContextParams(
  rawSearchParams: string | URLSearchParams,
) {
  const params =
    typeof rawSearchParams === "string"
      ? new URLSearchParams(rawSearchParams)
      : rawSearchParams;

  return params.get("from") === "dashboard";
}

export function getCourseStructureIssueUnavailablePath(
  courseId: string,
  chapterId?: string | null,
) {
  const params = new URLSearchParams({
    [COURSE_STRUCTURE_ISSUE_UNAVAILABLE_PARAM]: "1",
  });

  if (chapterId) {
    params.set(COURSE_STRUCTURE_HIGHLIGHT_CHAPTER_PARAM, chapterId);
  }

  return `${getCourseStructurePath(courseId)}?${params.toString()}`;
}

export function parseCourseStructureIssueFeedback(
  rawSearchParams: string | URLSearchParams,
) {
  const params =
    typeof rawSearchParams === "string"
      ? new URLSearchParams(rawSearchParams)
      : rawSearchParams;

  const parsed = courseStructureIssueFeedbackSchema.safeParse({
    issueUnavailable: params.get(COURSE_STRUCTURE_ISSUE_UNAVAILABLE_PARAM),
    ...(params.get(COURSE_STRUCTURE_HIGHLIGHT_CHAPTER_PARAM)
      ? { chapterId: params.get(COURSE_STRUCTURE_HIGHLIGHT_CHAPTER_PARAM) }
      : {}),
  });

  return parsed.success ? parsed.data : null;
}

export function removeDashboardIssueContextParams(
  pathname: string,
  rawSearchParams: string | URLSearchParams,
) {
  const params =
    typeof rawSearchParams === "string"
      ? new URLSearchParams(rawSearchParams)
      : new URLSearchParams(rawSearchParams.toString());

  for (const key of DASHBOARD_ISSUE_CONTEXT_PARAM_KEYS) {
    params.delete(key);
  }

  // Giữ lại `tab` và các tham số không thuộc dashboard để giáo viên không bị mất vị trí đang soạn.
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function removeCourseStructureIssueFeedbackParam(
  pathname: string,
  rawSearchParams: string | URLSearchParams,
) {
  const params =
    typeof rawSearchParams === "string"
      ? new URLSearchParams(rawSearchParams)
      : new URLSearchParams(rawSearchParams.toString());

  params.delete(COURSE_STRUCTURE_ISSUE_UNAVAILABLE_PARAM);

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function getAllowedTopicBuilderTabs(rule: CourseAuthoringIssueRule) {
  return rule.allowedTabs ?? (rule.tab ? [rule.tab] : []);
}

function isTopicBuilderTab(value: unknown): value is TopicBuilderTab {
  return TOPIC_BUILDER_TABS.includes(value as TopicBuilderTab);
}

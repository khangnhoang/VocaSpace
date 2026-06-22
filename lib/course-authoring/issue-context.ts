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
  } & (CourseAuthoringIssueRuleMap[TCode] extends { tab: infer TTab extends TopicBuilderTab }
    ? { tab: TTab }
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

const courseAuthoringIssueContextSchema = z.strictObject({
  from: z.literal("dashboard"),
  issue: z.string(),
  targetType: z.enum(COURSE_AUTHORING_ISSUE_TARGET_TYPES),
  target: z.uuid(),
  tab: z.enum(TOPIC_BUILDER_TABS).optional(),
});

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

  return context.tab === rule.tab;
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

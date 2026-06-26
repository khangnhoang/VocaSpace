import {
  getToeicPartRule,
  TOEIC_GROUP_CONTEXT_MESSAGES,
  type ToeicGroupContextField,
} from "@/lib/schemas/exercise";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTopicBuilderPath,
} from "@/lib/course-authoring/routes";
import {
  getCourseStructureIssuePath,
  getTopicBuilderIssuePath,
  type CourseStructureIssueContext,
  type TopicBuilderIssueContext,
} from "@/lib/course-authoring/issue-context";
import type {
  CourseDashboardReadiness,
  CourseReadinessDestination,
  CourseReadinessGraph,
  CourseReadinessIssue,
  CourseReadinessIssueCode,
} from "@/lib/schemas/course-readiness";
import { COURSE_READINESS_REMEDIATION_ORDER } from "@/lib/schemas/course-readiness";

// File này nhận dữ liệu đã qua Zod và tạo ra counts, danh sách lỗi đã sắp xếp
// và nút hành động chính. Đăng nhập, phân quyền và đọc Supabase nằm ở Server Action.

type OrderedRow = {
  id: string;
  order_index: number | null;
};

type IssueSortKey = {
  remediationPriority: number;
  chapterOrder: number;
  topicOrder: number;
  exerciseOrder: number;
  groupOrder: number;
  questionOrder: number;
  optionOrder: number;
  entityId: string;
  code: string;
};

type IssueDraft = CourseReadinessIssue & {
  sortKey: IssueSortKey;
};

const MISSING_ORDER = Number.MAX_SAFE_INTEGER;
const REMEDIATION_PRIORITY = COURSE_READINESS_REMEDIATION_ORDER.reduce(
  (priorities, code, index) => {
    priorities[code] = index;
    return priorities;
  },
  {} as Record<CourseReadinessIssueCode, number>,
);

function active<T extends { removed_at: string | null }>(rows: T[]) {
  // Bản ghi đã soft-delete không được tính vào counts, quan hệ hợp lệ hoặc lỗi hợp lệ.
  return rows.filter((row) => row.removed_at == null);
}

function compareOrderedRows(a: OrderedRow, b: OrderedRow) {
  return (
    (a.order_index ?? MISSING_ORDER) - (b.order_index ?? MISSING_ORDER) ||
    a.id.localeCompare(b.id)
  );
}

function groupBy<T, K extends string>(rows: T[], getKey: (row: T) => K) {
  return rows.reduce((groups, row) => {
    const key = getKey(row);
    const current = groups.get(key) || [];
    current.push(row);
    groups.set(key, current);
    return groups;
  }, new Map<K, T[]>());
}

export function getCourseOverviewDestination(
  courseId: string,
): CourseReadinessDestination {
  return {
    type: "course_overview",
    courseId,
    href: getCourseOverviewPath(courseId),
  };
}

export function getCourseStructureDestination(
  courseId: string,
  issueContext?: CourseStructureIssueContext,
): CourseReadinessDestination {
  return {
    type: "course_structure",
    courseId,
    href: issueContext
      ? getCourseStructureIssuePath(courseId, issueContext)
      : getCourseStructurePath(courseId),
  };
}

export function getTopicBuilderDestination(
  courseId: string,
  topicId: string,
  issueContext?: TopicBuilderIssueContext,
): CourseReadinessDestination {
  return {
    type: "topic_builder",
    courseId,
    topicId,
    href: issueContext
      ? getTopicBuilderIssuePath(courseId, topicId, issueContext)
      : getTopicBuilderPath(courseId, topicId),
  };
}

function issueId(
  code: CourseReadinessIssueCode,
  entityType: string,
  entityId: string,
  suffix?: string,
) {
  return [code, entityType, entityId, suffix].filter(Boolean).join(":");
}

function buildSortKey(
  issue: Pick<CourseReadinessIssue, "code">,
  entityId: string,
  order: Partial<
    Pick<
      IssueSortKey,
      | "chapterOrder"
      | "topicOrder"
      | "exerciseOrder"
      | "groupOrder"
      | "questionOrder"
      | "optionOrder"
    >
  > = {},
): IssueSortKey {
  return {
    remediationPriority: REMEDIATION_PRIORITY[issue.code],
    chapterOrder: order.chapterOrder ?? MISSING_ORDER,
    topicOrder: order.topicOrder ?? MISSING_ORDER,
    exerciseOrder: order.exerciseOrder ?? MISSING_ORDER,
    groupOrder: order.groupOrder ?? MISSING_ORDER,
    questionOrder: order.questionOrder ?? MISSING_ORDER,
    optionOrder: order.optionOrder ?? MISSING_ORDER,
    entityId,
    code: issue.code,
  };
}

function compareIssueDrafts(a: IssueDraft, b: IssueDraft) {
  return (
    a.sortKey.remediationPriority - b.sortKey.remediationPriority ||
    a.sortKey.chapterOrder - b.sortKey.chapterOrder ||
    a.sortKey.topicOrder - b.sortKey.topicOrder ||
    a.sortKey.exerciseOrder - b.sortKey.exerciseOrder ||
    a.sortKey.groupOrder - b.sortKey.groupOrder ||
    a.sortKey.questionOrder - b.sortKey.questionOrder ||
    a.sortKey.optionOrder - b.sortKey.optionOrder ||
    a.sortKey.entityId.localeCompare(b.sortKey.entityId) ||
    a.sortKey.code.localeCompare(b.sortKey.code) ||
    a.id.localeCompare(b.id)
  );
}

function omitIssueSortKey({ sortKey, ...issue }: IssueDraft): CourseReadinessIssue {
  void sortKey;
  return issue;
}

function hasMeaningfulText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function contextFieldLabel(field: ToeicGroupContextField) {
  const message = TOEIC_GROUP_CONTEXT_MESSAGES[field];
  return message.replace(/^Vui lòng\s+/i, "").replace(/\.$/, "");
}

export function deriveCourseDashboardReadiness(
  graph: CourseReadinessGraph,
): CourseDashboardReadiness {
  const courseId = graph.course.id;

  // 1. Dựng cây nội dung còn hoạt động từ course xuống topic/exercise.
  const activeChapters = active(graph.chapters)
    .filter((chapter) => chapter.course_id === courseId)
    .sort(compareOrderedRows);
  const activeChapterIds = new Set(activeChapters.map((chapter) => chapter.id));

  const activeTopics = active(graph.topics)
    .filter(
      (topic) =>
        topic.course_id === courseId &&
        topic.chapter_id != null &&
        activeChapterIds.has(topic.chapter_id),
    )
    .sort(compareOrderedRows);
  const activeTopicIds = new Set(activeTopics.map((topic) => topic.id));

  const activeFlashcards = active(graph.flashcards).filter((card) =>
    activeTopicIds.has(card.topic_id),
  );
  const activeExercises = active(graph.exercises)
    .filter(
      (exercise) =>
        exercise.course_id === courseId && activeTopicIds.has(exercise.topic_id),
    )
    .sort(compareOrderedRows);
  const activeExerciseIds = new Set(activeExercises.map((exercise) => exercise.id));

  const activeGroups = active(graph.questionGroups)
    .filter((group) => activeExerciseIds.has(group.exercise_id))
    .sort(compareOrderedRows);
  const activeGroupIds = new Set(activeGroups.map((group) => group.id));

  // Câu hỏi dưới exercise active được giữ lại ngay cả khi group_id không hợp lệ.
  // Bước sau cần dữ liệu này để báo lỗi mồ côi thay vì làm lỗi biến mất.
  const activeQuestions = active(graph.questions)
    .filter(
      (question) =>
        question.course_id === courseId &&
        activeExerciseIds.has(question.exercise_id),
    )
    .sort(compareOrderedRows);
  const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));

  // Option trống không được tính, kể cả khi được đánh dấu đúng.
  const activeOptions = active(graph.answerOptions).filter(
    (option) =>
      activeQuestionIds.has(option.question_id) &&
      hasMeaningfulText(option.content),
  );

  // 2. Gom dữ liệu con theo ID cha để các kiểm tra phía sau dùng cùng một cây đã lọc.
  const topicsByChapter = groupBy(activeTopics, (topic) => topic.chapter_id || "");
  const flashcardsByTopic = groupBy(activeFlashcards, (card) => card.topic_id);
  const exercisesByTopic = groupBy(activeExercises, (exercise) => exercise.topic_id);
  const groupsByExercise = groupBy(activeGroups, (group) => group.exercise_id);
  const questionsByExercise = groupBy(
    activeQuestions,
    (question) => question.exercise_id,
  );
  const questionsByGroup = groupBy(
    activeQuestions.filter(
      (question) => question.group_id != null && activeGroupIds.has(question.group_id),
    ),
    (question) => question.group_id || "",
  );
  const optionsByQuestion = groupBy(activeOptions, (option) => option.question_id);

  // 3. Ghi lại vị trí trong cây để các lỗi cùng loại luôn có thứ tự ổn định.
  const chapterOrder = new Map(
    activeChapters.map((chapter, index) => [chapter.id, index]),
  );
  const topicOrder = new Map(activeTopics.map((topic, index) => [topic.id, index]));
  const exerciseOrder = new Map(
    activeExercises.map((exercise, index) => [exercise.id, index]),
  );
  const groupOrder = new Map(activeGroups.map((group, index) => [group.id, index]));
  const questionOrder = new Map(
    activeQuestions.map((question, index) => [question.id, index]),
  );
  const topicById = new Map(activeTopics.map((topic) => [topic.id, topic]));

  const issues: IssueDraft[] = [];

  const pushIssue = (
    issue: CourseReadinessIssue,
    entityId: string,
    order?: Partial<IssueSortKey>,
  ) => {
    issues.push({
      ...issue,
      sortKey: buildSortKey(issue, entityId, order),
    });
  };

  if (activeChapters.length === 0) {
    pushIssue(
      {
        id: issueId("course_has_no_chapters", "course", courseId),
        code: "course_has_no_chapters",
        category: "structure",
        severity: "critical",
        isBlocking: true,
        context: "Khóa học chưa có chương hoạt động nào.",
        actionLabel: "Thêm chương",
        destination: getCourseStructureDestination(courseId, {
          issue: "course_has_no_chapters",
          targetType: "course",
          target: courseId,
        }),
        entity: {
          type: "course",
          id: courseId,
        },
      },
      courseId,
    );
  }

  for (const chapter of activeChapters) {
    const chapterTopics = topicsByChapter.get(chapter.id) || [];
    const chapterIndex = chapterOrder.get(chapter.id) ?? MISSING_ORDER;

    if (chapterTopics.length === 0) {
      pushIssue(
        {
          id: issueId("chapter_has_no_topics", "chapter", chapter.id),
          code: "chapter_has_no_topics",
          category: "structure",
          severity: "high",
          isBlocking: true,
          context: `Chương "${chapter.title}" chưa có bài học hoạt động nào.`,
          actionLabel: "Thêm bài học",
          destination: getCourseStructureDestination(courseId, {
            issue: "chapter_has_no_topics",
            targetType: "chapter",
            target: chapter.id,
          }),
          entity: {
            type: "chapter",
            id: chapter.id,
            courseId,
          },
        },
        chapter.id,
        { chapterOrder: chapterIndex },
      );
    }
  }

  for (const topic of activeTopics) {
    const topicFlashcards = flashcardsByTopic.get(topic.id) || [];
    const topicExercises = exercisesByTopic.get(topic.id) || [];
    const chapterIndex = chapterOrder.get(topic.chapter_id || "") ?? MISSING_ORDER;
    const topicIndex = topicOrder.get(topic.id) ?? MISSING_ORDER;

    if (topicFlashcards.length + topicExercises.length === 0) {
      pushIssue(
        {
          id: issueId("topic_has_no_learning_content", "topic", topic.id),
          code: "topic_has_no_learning_content",
          category: "content",
          severity: "high",
          isBlocking: true,
          context: `Bài học "${topic.title}" chưa có flashcard hoặc bài tập hoạt động.`,
          actionLabel: "Thêm nội dung",
          destination: getTopicBuilderDestination(courseId, topic.id, {
            issue: "topic_has_no_learning_content",
            targetType: "topic",
            target: topic.id,
            tab: "exercises",
          }),
          entity: {
            type: "topic",
            id: topic.id,
            courseId,
            chapterId: topic.chapter_id || "",
          },
        },
        topic.id,
        { chapterOrder: chapterIndex, topicOrder: topicIndex },
      );
    }

    for (const exercise of topicExercises) {
      const exerciseIndex = exerciseOrder.get(exercise.id) ?? MISSING_ORDER;
      const rule = getToeicPartRule(exercise.part_type);
      const exerciseGroups = groupsByExercise.get(exercise.id) || [];
      const exerciseQuestions = questionsByExercise.get(exercise.id) || [];
      const standaloneQuestions = exerciseQuestions.filter(
        (question) => question.group_id == null,
      );
      // Câu hỏi grouped hợp lệ và câu hỏi mồ côi là hai phân loại khác nhau:
      // câu hỏi mồ côi không được tính là câu hỏi trong group hợp lệ.
      const validGroupedQuestions = exerciseQuestions.filter(
        (question) =>
          question.group_id != null && activeGroupIds.has(question.group_id),
      );
      const orphanQuestions = exerciseQuestions.filter(
        (question) =>
          question.group_id == null ||
          (question.group_id != null && !activeGroupIds.has(question.group_id)),
      );

      if (!rule) continue;

      if (rule.mode === "grouped") {
        if (exerciseGroups.length === 0) {
          pushIssue(
            {
              id: issueId("exercise_requires_group", "exercise", exercise.id),
              code: "exercise_requires_group",
              category: "exercise",
              severity: "critical",
              isBlocking: true,
              context: `Bài tập "${exercise.title}" cần ít nhất một nhóm câu hỏi cho ${exercise.part_type}.`,
              actionLabel: "Bổ sung nhóm câu hỏi",
              destination: getTopicBuilderDestination(courseId, topic.id, {
                issue: "exercise_requires_group",
                targetType: "exercise",
                target: exercise.id,
                tab: "exercises",
              }),
              entity: {
                type: "exercise",
                id: exercise.id,
                courseId,
                topicId: topic.id,
              },
            },
            exercise.id,
            {
              chapterOrder: chapterIndex,
              topicOrder: topicIndex,
              exerciseOrder: exerciseIndex,
            },
          );
        }

        for (const group of exerciseGroups) {
          const groupQuestions = questionsByGroup.get(group.id) || [];
          const groupIndex = groupOrder.get(group.id) ?? MISSING_ORDER;

          if (groupQuestions.length === 0) {
            pushIssue(
              {
                id: issueId(
                  "question_group_has_no_active_questions",
                  "question_group",
                  group.id,
                ),
                code: "question_group_has_no_active_questions",
                category: "exercise",
                severity: "critical",
                isBlocking: true,
                context: `Nhóm câu hỏi trong "${exercise.title}" chưa có câu hỏi hoạt động nào.`,
                actionLabel: "Thêm câu hỏi",
                destination: getTopicBuilderDestination(courseId, topic.id, {
                  issue: "question_group_has_no_active_questions",
                  targetType: "question_group",
                  target: group.id,
                  tab: "exercises",
                }),
                entity: {
                  type: "question_group",
                  id: group.id,
                  courseId,
                  topicId: topic.id,
                  exerciseId: exercise.id,
                },
              },
              group.id,
              {
                chapterOrder: chapterIndex,
                topicOrder: topicIndex,
                exerciseOrder: exerciseIndex,
                groupOrder: groupIndex,
              },
            );
          }
        }

        if (orphanQuestions.length > 0) {
          const firstOrphanQuestion = orphanQuestions.sort(compareOrderedRows)[0];

          pushIssue(
            {
              id: issueId("exercise_has_orphan_questions", "exercise", exercise.id),
              code: "exercise_has_orphan_questions",
              category: "exercise",
              severity: "high",
              isBlocking: true,
              context: `Bài tập "${exercise.title}" có câu hỏi chưa thuộc nhóm hoạt động hợp lệ.`,
              actionLabel: "Gắn câu hỏi vào nhóm",
              destination: getTopicBuilderDestination(courseId, topic.id, {
                issue: "exercise_has_orphan_questions",
                targetType: "exercise",
                target: exercise.id,
                tab: "exercises",
              }),
              entity: {
                type: "exercise",
                id: exercise.id,
                courseId,
                topicId: topic.id,
              },
            },
            exercise.id,
            {
              chapterOrder: chapterIndex,
              topicOrder: topicIndex,
              exerciseOrder: exerciseIndex,
              questionOrder:
                questionOrder.get(firstOrphanQuestion.id) ?? MISSING_ORDER,
            },
          );
        }

        for (const group of exerciseGroups) {
          const groupIndex = groupOrder.get(group.id) ?? MISSING_ORDER;
          for (const field of rule.requiredGroupContext) {
            if (!hasMeaningfulText(group[field])) {
              pushIssue(
                {
                  id: issueId(
                    "exercise_group_missing_context",
                    "question_group",
                    group.id,
                    field,
                  ),
                  code: "exercise_group_missing_context",
                  category: "exercise",
                  severity: "high",
                  isBlocking: true,
                  context: `Nhóm câu hỏi trong "${exercise.title}" thiếu ${contextFieldLabel(field)}.`,
                  actionLabel: "Bổ sung ngữ liệu",
                  destination: getTopicBuilderDestination(courseId, topic.id, {
                    issue: "exercise_group_missing_context",
                    targetType: "question_group",
                    target: group.id,
                    tab: "exercises",
                  }),
                  entity: {
                    type: "question_group",
                    id: group.id,
                    courseId,
                    topicId: topic.id,
                    exerciseId: exercise.id,
                  },
                },
                group.id,
                {
                  chapterOrder: chapterIndex,
                  topicOrder: topicIndex,
                  exerciseOrder: exerciseIndex,
                  groupOrder: groupIndex,
                },
              );
            }
          }
        }

        for (const question of validGroupedQuestions) {
          const questionTopic = topicById.get(exercise.topic_id);
          if (!questionTopic) continue;
          addQuestionIssues(
            question,
            courseId,
            questionTopic.id,
            exercise.id,
            optionsByQuestion.get(question.id) || [],
            pushIssue,
            {
              chapterOrder: chapterIndex,
              topicOrder: topicIndex,
              exerciseOrder: exerciseIndex,
              groupOrder:
                question.group_id != null
                  ? groupOrder.get(question.group_id) ?? MISSING_ORDER
                  : MISSING_ORDER,
              questionOrder: questionOrder.get(question.id) ?? MISSING_ORDER,
            },
          );
        }
      } else if (standaloneQuestions.length === 0) {
        pushIssue(
          {
            id: issueId(
              "exercise_requires_standalone_question",
              "exercise",
              exercise.id,
            ),
            code: "exercise_requires_standalone_question",
            category: "exercise",
            severity: "critical",
            isBlocking: true,
            context: `Bài tập "${exercise.title}" cần ít nhất một câu hỏi độc lập cho part5.`,
            actionLabel: "Thêm câu hỏi",
            destination: getTopicBuilderDestination(courseId, topic.id, {
              issue: "exercise_requires_standalone_question",
              targetType: "exercise",
              target: exercise.id,
              tab: "exercises",
            }),
            entity: {
              type: "exercise",
              id: exercise.id,
              courseId,
              topicId: topic.id,
            },
          },
          exercise.id,
          {
            chapterOrder: chapterIndex,
            topicOrder: topicIndex,
            exerciseOrder: exerciseIndex,
          },
        );
      } else {
        for (const question of standaloneQuestions) {
          addQuestionIssues(
            question,
            courseId,
            topic.id,
            exercise.id,
            optionsByQuestion.get(question.id) || [],
            pushIssue,
            {
              chapterOrder: chapterIndex,
              topicOrder: topicIndex,
              exerciseOrder: exerciseIndex,
              questionOrder: questionOrder.get(question.id) ?? MISSING_ORDER,
            },
          );
        }
      }
    }
  }

  // 4. Sắp lỗi theo thứ tự nên sửa, rồi chọn nút hành động chính từ lỗi đầu tiên.
  const orderedIssues = issues
    .sort(compareIssueDrafts)
    .map(omitIssueSortKey);
  const firstActionableIssue =
    orderedIssues.find((issue) => issue.destination != null) || null;

  return {
    role: graph.role,
    course: {
      id: graph.course.id,
      title: graph.course.title,
      slug: graph.course.slug,
      description: graph.course.description,
      thumbnail_url: graph.course.thumbnail_url,
      price: graph.course.price,
      status: graph.course.status,
      order_index: graph.course.order_index,
    },
    counts: {
      chapters: activeChapters.length,
      topics: activeTopics.length,
      flashcards: activeFlashcards.length,
      exercises: activeExercises.length,
      questionGroups: activeGroups.length,
      questions: activeQuestions.length,
      answerOptions: activeOptions.length,
    },
    issues: orderedIssues,
    primaryCta: firstActionableIssue
      ? {
          id: `primary:${firstActionableIssue.id}`,
          label: firstActionableIssue.actionLabel,
          destination: firstActionableIssue.destination,
          sourceIssueId: firstActionableIssue.id,
          sourceIssueCode: firstActionableIssue.code,
        }
      : {
          id: `primary:course:${courseId}:structure`,
          label: "Quản lý cấu trúc",
          destination: getCourseStructureDestination(courseId),
          sourceIssueId: null,
          sourceIssueCode: null,
        },
  };
}

function addQuestionIssues(
  question: CourseReadinessGraph["questions"][number],
  courseId: string,
  topicId: string,
  exerciseId: string,
  options: CourseReadinessGraph["answerOptions"],
  pushIssue: (
    issue: CourseReadinessIssue,
    entityId: string,
    order?: Partial<IssueSortKey>,
  ) => void,
  order: Partial<IssueSortKey>,
) {
  if (!hasMeaningfulText(question.content)) {
    pushIssue(
      {
        id: issueId("question_missing_content", "question", question.id),
        code: "question_missing_content",
        category: "exercise",
        severity: "critical",
        isBlocking: true,
        context: "Câu hỏi chưa có nội dung.",
        actionLabel: "Bổ sung nội dung câu hỏi",
        destination: getTopicBuilderDestination(courseId, topicId, {
          issue: "question_missing_content",
          targetType: "question",
          target: question.id,
          tab: "exercises",
        }),
        entity: {
          type: "question",
          id: question.id,
          courseId,
          topicId,
          exerciseId,
          questionGroupId: question.group_id,
        },
      },
      question.id,
      order,
    );
  }

  const meaningfulOptions = options.filter((option) =>
    hasMeaningfulText(option.content),
  );
  const correctOptions = meaningfulOptions.filter(
    (option) => option.is_correct === true,
  );

  if (meaningfulOptions.length < 2) {
    pushIssue(
      {
        id: issueId("question_has_too_few_options", "question", question.id),
        code: "question_has_too_few_options",
        category: "exercise",
        severity: "critical",
        isBlocking: true,
        context: "Câu hỏi cần ít nhất 2 đáp án hoạt động có nội dung.",
        actionLabel: "Bổ sung đáp án",
        destination: getTopicBuilderDestination(courseId, topicId, {
          issue: "question_has_too_few_options",
          targetType: "question",
          target: question.id,
          tab: "exercises",
        }),
        entity: {
          type: "question",
          id: question.id,
          courseId,
          topicId,
          exerciseId,
          questionGroupId: question.group_id,
        },
      },
      question.id,
      order,
    );
  }

  if (correctOptions.length === 0) {
    pushIssue(
      {
        id: issueId("question_has_no_correct_option", "question", question.id),
        code: "question_has_no_correct_option",
        category: "exercise",
        severity: "critical",
        isBlocking: true,
        context: "Câu hỏi cần ít nhất 1 đáp án đúng hoạt động.",
        actionLabel: "Chọn đáp án đúng",
        destination: getTopicBuilderDestination(courseId, topicId, {
          issue: "question_has_no_correct_option",
          targetType: "question",
          target: question.id,
          tab: "exercises",
        }),
        entity: {
          type: "question",
          id: question.id,
          courseId,
          topicId,
          exerciseId,
          questionGroupId: question.group_id,
        },
      },
      question.id,
      order,
    );
  }
}

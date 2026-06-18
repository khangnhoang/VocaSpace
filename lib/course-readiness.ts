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
import type {
  CourseDashboardReadiness,
  CourseReadinessDestination,
  CourseReadinessGraph,
  CourseReadinessIssue,
  CourseReadinessIssueCode,
} from "@/lib/schemas/course-readiness";
import { COURSE_READINESS_REMEDIATION_ORDER } from "@/lib/schemas/course-readiness";

// Shape tối thiểu cho các row có thứ tự trong graph. Derivation chỉ cần vị trí
// structural và stable id, không phụ thuộc timestamp để tránh tie-break lệch
// giữa các query tầng khác nhau.
type OrderedRow = {
  id: string;
  order_index: number | null;
};

// Sort key là metadata nội bộ để gom đủ ngữ cảnh structural cho issue ordering.
// Contract trả ra công khai không để lộ key này vì UI chỉ consume issue đã sắp xếp.
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

// IssueDraft tạm giữ sortKey trong lúc tích lũy issue; metadata này bị loại bỏ
// trước khi trả contract để không tạo thêm API public.
type IssueDraft = CourseReadinessIssue & {
  sortKey: IssueSortKey;
};

// Row thiếu order_index vẫn phải có vị trí deterministic, nên được đẩy về sau
// và tiếp tục tie-break bằng stable id.
const MISSING_ORDER = Number.MAX_SAFE_INTEGER;
// Derivation lấy remediation priority từ schema SSOT để không duy trì hệ thống
// ưu tiên CTA/issue thứ hai tách rời contract issue code.
const REMEDIATION_PRIORITY = COURSE_READINESS_REMEDIATION_ORDER.reduce(
  (priorities, code, index) => {
    priorities[code] = index;
    return priorities;
  },
  {} as Record<CourseReadinessIssueCode, number>,
);

function active<T extends { removed_at: string | null }>(rows: T[]) {
  // Soft-delete là boundary chung của readiness: row đã removed không được tính
  // vào counts, relation lookup, hay issue hợp lệ.
  return rows.filter((row) => row.removed_at == null);
}

function compareOrderedRows(a: OrderedRow, b: OrderedRow) {
  return (
    (a.order_index ?? MISSING_ORDER) - (b.order_index ?? MISSING_ORDER) ||
    a.id.localeCompare(b.id)
  );
}

function groupBy<T, K extends string>(rows: T[], getKey: (row: T) => K) {
  // Lookup theo quan hệ đã được lọc ở derivation giúp các phase sau không phải
  // scan lại toàn graph và giảm nguy cơ trộn entity ngoài cây active.
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
  // Destination helper chỉ bọc route SSOT thành contract readiness ổn định.
  return {
    type: "course_overview",
    courseId,
    href: getCourseOverviewPath(courseId),
  };
}

export function getCourseStructureDestination(
  courseId: string,
): CourseReadinessDestination {
  return {
    type: "course_structure",
    courseId,
    href: getCourseStructurePath(courseId),
  };
}

export function getTopicBuilderDestination(
  courseId: string,
  topicId: string,
): CourseReadinessDestination {
  return {
    type: "topic_builder",
    courseId,
    topicId,
    href: getTopicBuilderPath(courseId, topicId),
  };
}

function issueId(
  code: CourseReadinessIssueCode,
  entityType: string,
  entityId: string,
  suffix?: string,
) {
  // ID issue dựa trên code và entity stable, không dựa vào thứ tự hoặc copy
  // tiếng Việt để đổi wording không làm mất identity.
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
  // Thứ tự sửa lỗi lấy semantic remediation trước, rồi mới đến vị trí trong cây
  // content và stable id để cùng input luôn cho cùng issue order.
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

function hasMeaningfulText(value: string | null | undefined) {
  // Whitespace không được xem là nội dung thật cho câu hỏi, option, hoặc ngữ liệu.
  return typeof value === "string" && value.trim().length > 0;
}

function contextFieldLabel(field: ToeicGroupContextField) {
  // Reuse message từ TOEIC rule SSOT nhưng bỏ phần hướng dẫn form để context
  // readiness đọc như mô tả thiếu dữ liệu.
  const message = TOEIC_GROUP_CONTEXT_MESSAGES[field];
  return message.replace(/^Vui lòng\s+/i, "").replace(/\.$/, "");
}

// Chuyển content graph đã được Zod kiểm tra thành contract readiness hoàn chỉnh.
// UI chỉ hiển thị kết quả và không tự triển khai lại các quy tắc nghiệp vụ.
export function deriveCourseDashboardReadiness(
  graph: CourseReadinessGraph,
): CourseDashboardReadiness {
  const courseId = graph.course.id;

  // Phase 1: dựng cây content active từ course xuống topic/exercise.
  // Entity con chỉ được tính khi parent active tồn tại để soft-delete hoặc quan
  // hệ parent mất hiệu lực không làm sai counts và readiness issues.
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
  // Derivation cần dữ liệu này để báo orphan relation thay vì âm thầm bỏ qua.
  const activeQuestions = active(graph.questions)
    .filter(
      (question) =>
        question.course_id === courseId &&
        activeExerciseIds.has(question.exercise_id),
    )
    .sort(compareOrderedRows);
  const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));

  // Chỉ option active có nội dung meaningful mới được tính vào readiness.
  // Blank correct option vì vậy không thể thỏa rule "có đáp án đúng".
  const activeOptions = active(graph.answerOptions).filter(
    (option) =>
      activeQuestionIds.has(option.question_id) &&
      hasMeaningfulText(option.content),
  );

  const topicsByChapter = groupBy(activeTopics, (topic) => topic.chapter_id || "");
  const flashcardsByTopic = groupBy(activeFlashcards, (card) => card.topic_id);
  const exercisesByTopic = groupBy(activeExercises, (exercise) => exercise.topic_id);
  const groupsByExercise = groupBy(activeGroups, (group) => group.exercise_id);
  const questionsByExercise = groupBy(
    activeQuestions,
    (question) => question.exercise_id,
  );
  const questionsByGroup = groupBy(
    // Orphan questions không được xem là thành viên hợp lệ của group; chúng có
    // issue riêng ở grouped exercise phase.
    activeQuestions.filter(
      (question) => question.group_id != null && activeGroupIds.has(question.group_id),
    ),
    (question) => question.group_id || "",
  );
  const optionsByQuestion = groupBy(activeOptions, (option) => option.question_id);

  // Phase 2: ghi lại vị trí structural sau khi graph đã được lọc active.
  // Các map này là tie-break deterministic cho issue có cùng remediation priority.
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

  // Phase 3: tích lũy issue cùng sort metadata nội bộ. Metadata này giúp sort
  // chính xác nhưng không được leak ra public contract.
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
    // Course chưa có chapter là vấn đề structural đầu tiên vì mọi nội dung sau
    // đều phụ thuộc vào cây chapter/topic.
    pushIssue(
      {
        id: issueId("course_has_no_chapters", "course", courseId),
        code: "course_has_no_chapters",
        category: "structure",
        severity: "critical",
        isBlocking: true,
        context: "Khóa học chưa có chương hoạt động nào.",
        actionLabel: "Thêm chương",
        destination: getCourseStructureDestination(courseId),
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
      // Chapter active không có topic active chặn dashboard vì topic là nơi chứa
      // flashcard và exercise thực sự.
      pushIssue(
        {
          id: issueId("chapter_has_no_topics", "chapter", chapter.id),
          code: "chapter_has_no_topics",
          category: "structure",
          severity: "high",
          isBlocking: true,
          context: `Chương "${chapter.title}" chưa có bài học hoạt động nào.`,
          actionLabel: "Thêm bài học",
          destination: getCourseStructureDestination(courseId),
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
      // Topic chỉ sẵn sàng khi có ít nhất một loại learning content active.
      pushIssue(
        {
          id: issueId("topic_has_no_learning_content", "topic", topic.id),
          code: "topic_has_no_learning_content",
          category: "content",
          severity: "high",
          isBlocking: true,
          context: `Bài học "${topic.title}" chưa có flashcard hoặc bài tập hoạt động.`,
          actionLabel: "Thêm nội dung",
          destination: getTopicBuilderDestination(courseId, topic.id),
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
      // Câu hỏi grouped hợp lệ và orphan question là hai phân loại khác nhau:
      // orphan không được tính là câu hỏi trong group hợp lệ.
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
        // Chế độ TOEIC grouped cần group active trước khi xét câu hỏi hoặc ngữ liệu.
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
              destination: getTopicBuilderDestination(courseId, topic.id),
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
            // Mỗi group active phải có câu hỏi active hợp lệ riêng; câu hỏi mồ
            // côi ở exercise không được tính thay cho group này.
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
                destination: getTopicBuilderDestination(courseId, topic.id),
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
          // Standalone question hoặc question trỏ tới group không active đều là
          // orphan trong grouped mode và không được tính như câu hỏi hợp lệ.
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
              destination: getTopicBuilderDestination(courseId, topic.id),
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
              // Required context đến từ TOEIC rule SSOT đang dùng chung với
              // authoring validation; thiếu field này là readiness blocker.
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
                  destination: getTopicBuilderDestination(courseId, topic.id),
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
        // Chế độ TOEIC standalone như part5 yêu cầu câu hỏi độc lập; grouped
        // question không thay thế được câu hỏi standalone.
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
            destination: getTopicBuilderDestination(courseId, topic.id),
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

  // Phase 4: sort theo semantic remediation dependency trước, sau đó theo vị
  // trí structural và stable id. `sortKey` bị loại khỏi output ngay sau sort.
  const orderedIssues = issues
    .sort(compareIssueDrafts)
    .map(({ sortKey: _sortKey, ...issue }) => issue);
  const firstTopic = activeTopics[0] || null;
  // Primary CTA lấy từ issue actionable đầu tiên sau khi sort để không có hệ
  // ưu tiên CTA độc lập với remediation order.
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
          // Fallback khi đã ready hoặc chưa có issue vẫn đưa teacher về topic
          // đầu tiên nếu có, hoặc structure workspace khi course chưa có topic active.
          id: firstTopic
            ? `primary:course:${courseId}:topic:${firstTopic.id}`
            : `primary:course:${courseId}:structure`,
          label: firstTopic ? "Tiếp tục soạn bài học" : "Quản lý cấu trúc",
          destination: firstTopic
            ? getTopicBuilderDestination(courseId, firstTopic.id)
            : getCourseStructureDestination(courseId),
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
    // Nội dung câu hỏi trống đi qua row schema để reviewer/teacher nhận được
    // issue sửa được thay vì toàn graph bị coi là invalid.
    pushIssue(
      {
        id: issueId("question_missing_content", "question", question.id),
        code: "question_missing_content",
        category: "exercise",
        severity: "critical",
        isBlocking: true,
        context: "Câu hỏi chưa có nội dung.",
        actionLabel: "Bổ sung nội dung câu hỏi",
        destination: getTopicBuilderDestination(courseId, topicId),
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

  // Helper tự lọc lại meaningful option để giữ invariant nếu caller tương lai
  // truyền option chưa được lọc ở phase dựng graph active.
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
        destination: getTopicBuilderDestination(courseId, topicId),
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
        destination: getTopicBuilderDestination(courseId, topicId),
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

"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, ClipboardList, Settings } from "lucide-react";
import ExerciseTab from "./ExerciseTab";
import FlashcardTab from "./FlashcardTab";
import SettingsTab from "./SettingsTab";
import {
  getTopicBuilderTab,
  TOPIC_BUILDER_TABS,
  type TopicBuilderTab,
} from "@/lib/course-authoring/routes";
import DashboardIssueNotice from "@/app/(teacher)/courses/[id]/_components/DashboardIssueNotice";
import {
  getCourseStructureIssueUnavailablePath,
  parseCourseAuthoringIssueDestination,
  removeDashboardIssueContextParams,
  type TopicBuilderIssueContext,
} from "@/lib/course-authoring/issue-context";
import {
  getInvalidDashboardIssueGuidance,
  resolveTopicBuilderTopIssueGuidance,
} from "@/lib/course-authoring/issue-guidance";

interface TopicBuilderTabsProps {
  courseId: string;
  topicId: string;
  parentChapterId: string | null;
  initialSearch: string;
}

export default function TopicBuilderTabs({
  courseId,
  topicId,
  parentChapterId,
  initialSearch,
}: TopicBuilderTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Dùng search ban đầu từ Server Component cho lần render đầu để tránh lệch hydration
  // khi URL có tham số dashboard nhưng client chưa đồng bộ search params.
  const search = useSyncExternalStore(
    subscribeToNavigationSnapshot,
    () => searchParams.toString(),
    () => initialSearch,
  );
  const issueDestinationState = useMemo(
    () => parseCourseAuthoringIssueDestination(search),
    [search],
  );
  const activeTab =
    issueDestinationState.kind === "valid" ||
    issueDestinationState.kind === "invalid_tab"
      ? getTopicBuilderTab(issueDestinationState.context.tab ?? null)
      : getTopicBuilderTab(new URLSearchParams(search).get("tab"));
  const dashboardIssueContext =
    issueDestinationState.kind === "valid" ||
    issueDestinationState.kind === "invalid_tab"
      ? issueDestinationState.context
      : null;
  const topicBuilderIssueContext =
    dashboardIssueContext?.issue === "topic_has_no_learning_content" ||
    dashboardIssueContext?.issue === "exercise_requires_group" ||
    dashboardIssueContext?.issue === "question_group_has_no_active_questions" ||
    dashboardIssueContext?.issue === "exercise_requires_standalone_question" ||
    dashboardIssueContext?.issue === "exercise_has_orphan_questions" ||
    dashboardIssueContext?.issue === "exercise_group_missing_context" ||
    dashboardIssueContext?.issue === "question_missing_content" ||
    dashboardIssueContext?.issue === "question_has_too_few_options" ||
    dashboardIssueContext?.issue === "question_has_no_correct_option"
      ? (dashboardIssueContext as TopicBuilderIssueContext)
      : null;
  const topGuidance = useMemo(() => {
    if (issueDestinationState.kind === "invalid_tab") {
      return {
        ...getInvalidDashboardIssueGuidance(),
        title: "Tab trong đường dẫn không còn hợp lệ",
        description:
          "Tab được yêu cầu không dùng được cho vấn đề này. Bạn đã được đưa về tab an toàn để tiếp tục chỉnh sửa.",
      };
    }

    if (!topicBuilderIssueContext) return null;

    return resolveTopicBuilderTopIssueGuidance({
      topicId,
      context: topicBuilderIssueContext,
    });
  }, [issueDestinationState.kind, topicBuilderIssueContext, topicId]);
  const exerciseIssueContext =
    topicBuilderIssueContext?.issue === "topic_has_no_learning_content"
      ? null
      : topicBuilderIssueContext;
  const staleTargetRedirectHref = getCourseStructureIssueUnavailablePath(
    courseId,
    parentChapterId,
  );

  useEffect(() => {
    if (issueDestinationState.kind === "invalid_context") {
      // URL hỏng hoặc target không đúng loại không nên ở lại topic builder,
      // vì màn này không thể biết mục nào cần đánh dấu.
      router.replace(staleTargetRedirectHref, { scroll: false });
      return;
    }

    if (
      (issueDestinationState.kind === "valid" ||
        issueDestinationState.kind === "invalid_tab") &&
      issueDestinationState.context.issue === "topic_has_no_learning_content" &&
      issueDestinationState.context.target !== topicId
    ) {
      router.replace(staleTargetRedirectHref, { scroll: false });
      return;
    }
  }, [issueDestinationState, router, staleTargetRedirectHref, topicId]);

  const handleTabChange = (value: string) => {
    if (TOPIC_BUILDER_TABS.includes(value as TopicBuilderTab)) {
      selectTopicBuilderTab(value as TopicBuilderTab);
    }
  };

  const dismissDashboardIssueGuidance = () => {
    const cleanedPath = removeDashboardIssueContextParams(pathname, search);
    const [cleanPathname, cleanSearch = ""] = cleanedPath.split("?");
    const params = new URLSearchParams(cleanSearch);
    // Đóng lời nhắc chỉ xóa ngữ cảnh dashboard; tab hiện tại vẫn được giữ để giáo viên tiếp tục soạn.
    params.set("tab", activeTab);
    const nextSearch = params.toString();

    router.replace(
      nextSearch ? `${cleanPathname}?${nextSearch}` : cleanPathname,
      {
        scroll: false,
      },
    );
  };

  const selectTopicBuilderTab = (tab: TopicBuilderTab) => {
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    const nextHref = `${pathname}?${params.toString()}`;

    router.replace(nextHref, { scroll: false });
  };

  return (
    <>
      {topGuidance ? (
        <DashboardIssueNotice
          guidance={topGuidance}
          onDismiss={dismissDashboardIssueGuidance}
        />
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-white border p-1 rounded-lg h-14 mb-8 shadow-sm py-5">
          <TabsTrigger
            value="flashcards"
            className="rounded-md px-8 py-4 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 gap-2 font-bold cursor-pointer"
          >
            <BookOpen size={18} /> Từ vựng
          </TabsTrigger>
          <TabsTrigger
            value="exercises"
            className="rounded-md px-8 py-4 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 gap-2 font-bold cursor-pointer"
          >
            <ClipboardList size={18} /> Bài tập TOEIC
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-md px-8 py-4 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 gap-2 font-bold cursor-pointer"
          >
            <Settings size={18} /> Cài đặt bài học
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flashcards">
          <FlashcardTab topicId={topicId} />
        </TabsContent>

        <TabsContent value="exercises">
        <ExerciseTab
          topicId={topicId}
          dashboardIssueContext={exerciseIssueContext}
          onDismissDashboardIssue={dismissDashboardIssueGuidance}
          staleTargetRedirectHref={staleTargetRedirectHref}
        />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab courseId={courseId} topicId={topicId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function subscribeToNavigationSnapshot() {
  return () => undefined;
}

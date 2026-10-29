"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClipboardList, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteExercise, deleteQuestion, getExercisesByTopicId } from "@/app/actions/exercise";
import type { FullExercise, FullExerciseQuestion } from "@/lib/schemas/exercise";
import DashboardIssueNotice from "@/app/(teacher)/teacher/courses/[id]/_components/DashboardIssueNotice";
import type { TopicBuilderIssueContext } from "@/lib/course-authoring/issue-context";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";
import { resolveExerciseIssueGuidance, type DashboardIssueGuidance } from "@/lib/course-authoring/issue-guidance";
import { PUBLISHED_DELETE_IMPACT } from "@/lib/course-authoring/published-edit-impact";
import { PublishedImpactNotice } from "@/app/(teacher)/teacher/courses/[id]/_components/PublishedEditWarning";
import AuthoringWorkbench from "./AuthoringWorkbench";
import { EmptyEditorPanel } from "./EditorFrame";
import ExerciseComposer from "./ExerciseComposer";
import { ExerciseBasicEditor, GroupEditor, QuestionEditor } from "./ExerciseNodeEditors";
import {
  TOEIC_PART_LABELS,
  getExerciseProblem,
  getGroupProblem,
  getQuestionProblem,
  getStandaloneQuestions,
  nodeKey,
  resolveNode,
  type ExerciseNode,
} from "./exercise-outline";
import { useAuthoringGuard, useAuthoringNavigate } from "./authoring-guard";

interface ExerciseWorkbenchProps {
  topicId: string;
  isActive?: boolean;
  readOnly?: boolean;
  isPublished?: boolean;
  dashboardIssueContext?: TopicBuilderIssueContext | null;
  onDismissDashboardIssue?: () => void;
  staleTargetRedirectHref?: string;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
  onMutationSuccess?: () => void;
}

type Selection = ExerciseNode | { kind: "compose" };

function guidanceToNode(guidance: DashboardIssueGuidance | null): ExerciseNode | null {
  if (!guidance?.targetExerciseId) return null;
  if (guidance.targetQuestionId) {
    return {
      kind: "question",
      exerciseId: guidance.targetExerciseId,
      groupId: guidance.targetGroupId ?? null,
      questionId: guidance.targetQuestionId,
    };
  }
  if (guidance.targetGroupId) {
    return { kind: "group", exerciseId: guidance.targetExerciseId, groupId: guidance.targetGroupId };
  }
  return { kind: "exercise", exerciseId: guidance.targetExerciseId };
}

function OutlineItem({
  level,
  label,
  detail,
  problem,
  isSelected,
  isTarget,
  domId,
  onSelect,
}: {
  level: 0 | 1 | 2;
  label: string;
  detail?: string;
  problem?: string | null;
  isSelected: boolean;
  isTarget: boolean;
  domId: string;
  onSelect: () => void;
}) {
  const indent = level === 0 ? "pl-4" : level === 1 ? "pl-8" : "pl-12";
  return (
    <button
      type="button"
      id={domId}
      aria-current={isSelected ? "true" : undefined}
      onClick={onSelect}
      className={`relative flex min-h-11 w-full flex-col items-start gap-0.5 py-2 pr-4 text-left outline-none transition-colors duration-[120ms] focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-inset motion-reduce:transition-none ${indent} ${
        isSelected ? "bg-route-quiet" : "hover:bg-slate-50"
      }`}
    >
      {isSelected ? <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-route" aria-hidden="true" /> : null}
      {level > 0 ? (
        <span
          className={`absolute inset-y-0 w-px bg-slate-200 ${level === 1 ? "left-5" : "left-9"}`}
          aria-hidden="true"
        />
      ) : null}
      <span
        className={`w-full min-w-0 [overflow-wrap:anywhere] ${level === 0 ? "text-sm font-bold" : "text-sm font-medium"} ${
          isSelected ? "text-route" : "text-slate-900"
        } ${level === 2 ? "line-clamp-2" : ""}`}
      >
        {label}
      </span>
      {detail ? <span className="text-xs font-medium text-slate-600">{detail}</span> : null}
      {isTarget ? (
        <span className="text-xs font-semibold text-route">Được dashboard đánh dấu</span>
      ) : null}
      {problem ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-attention">
          <span className="size-1.5 rounded-full bg-attention" aria-hidden="true" /> {problem}
        </span>
      ) : null}
    </button>
  );
}

export default function ExerciseWorkbench({
  topicId,
  isActive = true,
  readOnly = false,
  isPublished = false,
  dashboardIssueContext = null,
  onDismissDashboardIssue,
  staleTargetRedirectHref,
  onAuthoringSuccess,
  onMutationSuccess,
}: ExerciseWorkbenchProps) {
  const navigate = useAuthoringNavigate();
  const guard = useAuthoringGuard();
  const [exercises, setExercises] = useState<FullExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [deletingExercise, setDeletingExercise] = useState<FullExercise | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<FullExerciseQuestion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const issueContextRef = useRef(dashboardIssueContext);
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    issueContextRef.current = dashboardIssueContext;
  });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const res = await getExercisesByTopicId(topicId);
      if (!isMounted) return;
      if (res.error) {
        setLoadError(res.error);
        setIsLoading(false);
        return;
      }
      const nextExercises = res.data ?? [];
      setLoadError(null);
      setExercises(nextExercises);
      setIsLoading(false);
      // Deep link dashboard mở thẳng editor của mục cần sửa ở lần tải đầu tiên.
      const context = issueContextRef.current;
      if (!autoSelectedRef.current && context) {
        autoSelectedRef.current = true;
        const node = guidanceToNode(resolveExerciseIssueGuidance({ exercises: nextExercises, context }));
        if (node && resolveNode(nextExercises, node)) setSelection(node);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [topicId, refreshKey]);

  const dashboardIssueGuidance = useMemo(
    () =>
      !isLoading && dashboardIssueContext
        ? resolveExerciseIssueGuidance({ exercises, context: dashboardIssueContext })
        : null,
    [dashboardIssueContext, exercises, isLoading],
  );
  const targetNode = guidanceToNode(dashboardIssueGuidance);
  const targetKey = targetNode ? nodeKey(targetNode) : null;

  useEffect(() => {
    if (dashboardIssueGuidance?.tone === "warning" && staleTargetRedirectHref) {
      // Chỉ sau khi đã tải bài tập mới biết target còn tồn tại hay không. Target cũ thì quay
      // về Structure để giáo viên không sửa nhầm bài tập khác.
      void navigate(staleTargetRedirectHref, "replace");
    }
  }, [dashboardIssueGuidance?.tone, navigate, staleTargetRedirectHref]);

  const selectedKey = selection && selection.kind !== "compose" ? nodeKey(selection) : null;
  useEffect(() => {
    if (!selectedKey) return;
    document.getElementById(`outline-${selectedKey}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);

  const requestSelection = async (next: Selection | null) => {
    if (next && selection && next.kind !== "compose" && selection.kind !== "compose") {
      if (nodeKey(next) === nodeKey(selection)) return true;
    }
    if (next?.kind === "compose" && selection?.kind === "compose") return true;
    if (guard.hasDirtyEditor() && !(await guard.confirmLeave())) return false;
    setSelection(next);
    return true;
  };

  const afterMutation = () => {
    setRefreshKey((key) => key + 1);
    onMutationSuccess?.();
  };

  const resolved = selection && selection.kind !== "compose" ? resolveNode(exercises, selection) : null;

  const confirmDeleteExercise = async () => {
    if (!deletingExercise || readOnly) return;
    setIsDeleting(true);
    const res = await deleteExercise(deletingExercise.id);
    setIsDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message);
    if (selection && selection.kind !== "compose" && selection.exerciseId === deletingExercise.id) {
      setSelection(null);
    }
    setDeletingExercise(null);
    afterMutation();
  };

  const confirmDeleteQuestion = async () => {
    if (!deletingQuestion || readOnly) return;
    setIsDeleting(true);
    const res = await deleteQuestion(deletingQuestion.id);
    setIsDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message);
    if (selection?.kind === "question" && selection.questionId === deletingQuestion.id) {
      setSelection(null);
    }
    setDeletingQuestion(null);
    afterMutation();
  };

  let editorTitle = "Bài tập";
  let editor: ReactNode = null;
  if (selection?.kind === "compose") {
    editorTitle = "Thêm bài tập";
    editor = (
      <ExerciseComposer
        topicId={topicId}
        readOnly={readOnly}
        onCancel={() => void requestSelection(null)}
        onCreated={() => {
          setSelection(null);
          afterMutation();
        }}
        onCreateSuccess={() => onAuthoringSuccess?.({ type: "exercise_created", topicId }) ?? false}
      />
    );
  } else if (resolved && selection) {
    const isTarget = targetKey === nodeKey(selection);
    if (selection.kind === "exercise") {
      editorTitle = resolved.exercise.title;
      editor = (
        <ExerciseBasicEditor
          key={nodeKey(selection)}
          exercise={resolved.exercise}
          readOnly={readOnly}
          dashboardBadge={isTarget}
          onSaved={afterMutation}
          onDelete={readOnly ? undefined : () => setDeletingExercise(resolved.exercise)}
        />
      );
    } else if (selection.kind === "group" && resolved.group) {
      editorTitle = `Nhóm ${resolved.index + 1}`;
      editor = (
        <GroupEditor
          key={nodeKey(selection)}
          topicId={topicId}
          exercise={resolved.exercise}
          group={resolved.group}
          groupIndex={resolved.index}
          readOnly={readOnly}
          dashboardBadge={isTarget}
          onSaved={afterMutation}
          onAuthoringSuccess={onAuthoringSuccess}
        />
      );
    } else if (selection.kind === "question" && resolved.question) {
      const question = resolved.question;
      editorTitle = `Câu ${resolved.index + 1}`;
      editor = (
        <QuestionEditor
          key={nodeKey(selection)}
          exercise={resolved.exercise}
          question={question}
          questionIndex={resolved.index}
          group={resolved.group}
          readOnly={readOnly}
          isPublished={isPublished}
          dashboardBadge={isTarget}
          onSaved={afterMutation}
          onAuthoringSuccess={onAuthoringSuccess}
          onDelete={readOnly ? undefined : () => setDeletingQuestion(question)}
        />
      );
    }
  }

  const isSelected = (node: ExerciseNode) => selectedKey === nodeKey(node);

  const list = (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Bài tập TOEIC</h2>
          <p className="text-xs font-medium text-slate-600">
            {isLoading ? "Đang tải…" : `${exercises.length} bài tập`}
          </p>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            onClick={() => void requestSelection({ kind: "compose" })}
            disabled={isLoading || !!loadError}
            className="min-h-11 lg:min-h-9"
          >
            <Plus aria-hidden="true" /> Thêm bài tập
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600" role="status">
          <Loader2 className="size-5 animate-spin text-route" aria-hidden="true" /> Đang tải bài tập…
        </div>
      ) : loadError ? (
        <div className="space-y-3 px-4 py-6" role="alert">
          <p className="text-sm font-medium text-correction">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>
            Tải lại
          </Button>
        </div>
      ) : exercises.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <FileText className="mx-auto size-8 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-slate-900">Chưa có bài tập nào</p>
          <p className="mt-1 text-sm text-slate-600">
            {readOnly ? "Bài học này chưa có bài tập." : "Bấm “Thêm bài tập” để tạo bài đầu tiên."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto" aria-label="Cấu trúc bài tập">
          {exercises.map((exercise) => {
            const exerciseNode: ExerciseNode = { kind: "exercise", exerciseId: exercise.id };
            const standalone = getStandaloneQuestions(exercise);
            return (
              <li key={exercise.id} className="py-1">
                <OutlineItem
                  level={0}
                  domId={`outline-${nodeKey(exerciseNode)}`}
                  label={exercise.title}
                  detail={TOEIC_PART_LABELS[exercise.part_type]?.short ?? exercise.part_type}
                  problem={getExerciseProblem(exercise)}
                  isSelected={isSelected(exerciseNode)}
                  isTarget={targetKey === nodeKey(exerciseNode)}
                  onSelect={() => void requestSelection(exerciseNode)}
                />
                {(exercise.groups ?? []).length > 0 ? (
                  <ul>
                    {exercise.groups.map((group, gIndex) => {
                      const groupNode: ExerciseNode = { kind: "group", exerciseId: exercise.id, groupId: group.id };
                      const contextParts = [
                        group.passage_text?.trim() ? "đoạn văn" : null,
                        group.audio_url?.trim() ? "audio" : null,
                        group.image_url?.trim() ? "hình ảnh" : null,
                      ].filter(Boolean);
                      return (
                        <li key={group.id}>
                          <OutlineItem
                            level={1}
                            domId={`outline-${nodeKey(groupNode)}`}
                            label={`Nhóm ${gIndex + 1}`}
                            detail={contextParts.length > 0 ? `Ngữ liệu: ${contextParts.join(", ")}` : "Chưa có ngữ liệu"}
                            problem={getGroupProblem(exercise, group)}
                            isSelected={isSelected(groupNode)}
                            isTarget={targetKey === nodeKey(groupNode)}
                            onSelect={() => void requestSelection(groupNode)}
                          />
                          <ul>
                            {(group.questions ?? []).map((question, qIndex) => {
                              const questionNode: ExerciseNode = {
                                kind: "question",
                                exerciseId: exercise.id,
                                groupId: group.id,
                                questionId: question.id,
                              };
                              return (
                                <li key={question.id}>
                                  <OutlineItem
                                    level={2}
                                    domId={`outline-${nodeKey(questionNode)}`}
                                    label={`Câu ${qIndex + 1}. ${question.content || "(chưa có nội dung)"}`}
                                    problem={getQuestionProblem(question)}
                                    isSelected={isSelected(questionNode)}
                                    isTarget={targetKey === nodeKey(questionNode)}
                                    onSelect={() => void requestSelection(questionNode)}
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {standalone.length > 0 ? (
                  <ul>
                    {standalone.map((question, qIndex) => {
                      const questionNode: ExerciseNode = {
                        kind: "question",
                        exerciseId: exercise.id,
                        groupId: null,
                        questionId: question.id,
                      };
                      return (
                        <li key={question.id}>
                          <OutlineItem
                            level={1}
                            domId={`outline-${nodeKey(questionNode)}`}
                            label={`Câu ${qIndex + 1}. ${question.content || "(chưa có nội dung)"}`}
                            problem={getQuestionProblem(question)}
                            isSelected={isSelected(questionNode)}
                            isTarget={targetKey === nodeKey(questionNode)}
                            onSelect={() => void requestSelection(questionNode)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && exercises.length > 0 ? (
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs leading-5 text-slate-600">
          Thêm nhóm hoặc câu vào bài tập đã lưu chưa được hỗ trợ; cần thì tạo bài tập mới.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {dashboardIssueGuidance?.tone === "info" && onDismissDashboardIssue ? (
        <DashboardIssueNotice guidance={dashboardIssueGuidance} onDismiss={onDismissDashboardIssue} />
      ) : null}
      <AuthoringWorkbench
        label="bài tập"
        list={list}
        editor={editor}
        usePreviewSlot
        isActive={isActive}
        isEditorOpen={editor !== null}
        editorTitle={editorTitle}
        onRequestClose={() => requestSelection(null)}
        emptyEditor={
          <EmptyEditorPanel
            icon={<ClipboardList aria-hidden="true" />}
            title={readOnly ? "Chọn một mục để xem" : "Chọn bài tập, nhóm hoặc câu để sửa"}
            description="Mỗi mục mở ở đây cùng bản xem trước đúng như học viên thấy, kèm ngữ liệu của nhóm."
            action={
              !readOnly && !isLoading && !loadError ? (
                <Button type="button" variant="outline" onClick={() => void requestSelection({ kind: "compose" })}>
                  <Plus aria-hidden="true" /> Thêm bài tập
                </Button>
              ) : null
            }
          />
        }
      />

      <Dialog
        open={!!deletingExercise && !readOnly}
        onOpenChange={(open) => !open && !isDeleting && setDeletingExercise(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa bài tập</DialogTitle>
            <DialogDescription>
              Bài tập “{deletingExercise?.title}” cùng mọi nhóm và câu hỏi bên trong sẽ bị ẩn khỏi bài học.
            </DialogDescription>
          </DialogHeader>
          {isPublished ? <PublishedImpactNotice>{PUBLISHED_DELETE_IMPACT.exercise}</PublishedImpactNotice> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingExercise(null)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDeleteExercise()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Xóa bài tập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingQuestion && !readOnly}
        onOpenChange={(open) => !open && !isDeleting && setDeletingQuestion(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa câu hỏi</DialogTitle>
            <DialogDescription>Xóa câu hỏi và toàn bộ các đáp án của câu này.</DialogDescription>
          </DialogHeader>
          {isPublished ? <PublishedImpactNotice>{PUBLISHED_DELETE_IMPACT.question}</PublishedImpactNotice> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingQuestion(null)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDeleteQuestion()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Xóa câu hỏi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

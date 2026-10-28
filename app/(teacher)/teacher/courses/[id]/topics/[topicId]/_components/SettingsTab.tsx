"use client";
import React, { useId, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getTopicById, updateTopic, deleteTopic } from "@/app/actions/topic";
import type { Topic } from "@/types/database";
import { PUBLISHED_DELETE_IMPACT } from "@/lib/course-authoring/published-edit-impact";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";
import { getTopicDeletePreviewProjection } from "@/app/actions/course-preview";
import {
  CoursePreviewAllocationCard,
  PreviewSuspensionNotice,
  TopicPreviewMarkerToggle,
  useCoursePreviewAllocation,
} from "../../../_components/course-preview-controls";
import PreviewQuotaResolutionDialog from "../../../_components/PreviewQuotaResolutionDialog";
import { useRegisterAuthoringEditor, useSingleFlightSave } from "./authoring-guard";

interface SettingsTabProps {
  topicId: string;
  courseId: string;
  topicStatus: Topic["status"];
  canManagePreviewMarkers: boolean;
  readOnly?: boolean;
  isPublished?: boolean;
  onSaved?: () => void;
}

export default function SettingsTab({
  topicId,
  courseId,
  topicStatus,
  canManagePreviewMarkers,
  readOnly = false,
  isPublished = false,
  onSaved,
}: SettingsTabProps) {
  const titleId = useId();
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [savedTitle, setSavedTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Topic["status"]>("draft");
  const [isDeleting, setIsDeleting] = useState(false);

  // State quản lý Modal Xóa
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const preview = useCoursePreviewAllocation(courseId, canManagePreviewMarkers);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      if (isDeleting) return;
      const res = await getTopicById(topicId);
      if (res.data) {
        setTitle(res.data.title);
        setSavedTitle(res.data.title);
        setStatus(res.data.status as Topic["status"]);
      }
      setIsLoading(false);
    };
    loadData();
  }, [isDeleting, topicId]);

  const isDirty = !isLoading && title !== savedTitle;
  const saveFlight = useSingleFlightSave();

  const handleSave = async () => {
    if (readOnly) return false;
    setIsPending(true);
    setSaveError(null);
    const res = await updateTopic({ topicId, title });
    setIsPending(false);
    if (res.error) {
      setSaveError(res.error);
      return false;
    }
    toast.success(res.message);
    setSavedTitle(title);
    setSaveState("saved");
    onSaved?.();
    return true;
  };

  useRegisterAuthoringEditor(
    readOnly
      ? null
      : {
          isDirty: () => isDirty,
          save: () => saveFlight.run(handleSave),
          pendingSave: saveFlight.pending,
          discard: () => {
            setTitle(savedTitle);
            setSaveError(null);
          },
          label: "Tên bài học",
        },
  );

  const handleDelete = async (unmarkTopicIds: string[]) => {
    if (readOnly) return { error: "Bài học đang chờ duyệt hoặc chỉ có quyền xem." };
    setIsDeleting(true);
    let deleted = false;
    try {
      const res = await deleteTopic({
        topicId,
        // Hộp thoại xóa chính là bước xác nhận (có cảnh báo ảnh hưởng học viên), nên gửi cờ xác nhận mà server yêu cầu.
        confirmPublished: isPublished,
        unmarkTopicIds,
      });
      if (res.error) return res;
      deleted = true;
      toast.success(res.message);
      router.replace(getCourseStructurePath(courseId));
      return res;
    } finally {
      if (!deleted) setIsDeleting(false);
    }
  };

  const topicTitle = title.trim() || "bài học này";

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section
        aria-labelledby={`${titleId}-heading`}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <h2 id={`${titleId}-heading`} className="text-lg font-bold text-slate-900">
          Thông tin bài học
        </h2>
        <div>
          <label htmlFor={titleId} className="mb-1.5 block text-sm font-semibold text-slate-800">
            Tên bài học
          </label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaveState("idle");
              setSaveError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isPending && isDirty) void saveFlight.run(handleSave);
            }}
            disabled={readOnly}
            aria-invalid={saveError ? true : undefined}
            aria-describedby={saveError ? `${titleId}-error` : undefined}
            className="h-12 w-full text-base font-medium"
          />
          {saveError ? (
            <p id={`${titleId}-error`} role="alert" className="mt-1.5 text-sm font-medium text-correction">
              {saveError}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            Trạng thái hiện tại:{" "}
            {status === "published"
              ? "Đã xuất bản"
              : status === "pending"
                ? "Đang chờ duyệt"
                : "Bản nháp"}
          </p>
          <p className="mt-1">
            Trạng thái được quản lý qua quy trình duyệt; cài đặt này chỉ cập
            nhật thông tin bài học.
          </p>
        </div>

        {!readOnly ? (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            {isDirty ? (
              <span className="text-sm font-semibold text-attention">Chưa lưu</span>
            ) : saveState === "saved" ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-growth">
                <Check className="size-4" aria-hidden="true" /> Đã lưu
              </span>
            ) : null}
            <Button
              size="lg"
              disabled={isPending || !isDirty}
              aria-busy={isPending}
              onClick={() => void saveFlight.run(handleSave)}
              className="w-full sm:w-auto"
            >
              {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Lưu cài đặt
            </Button>
          </div>
        ) : null}
      </section>

      {canManagePreviewMarkers ? (
        <section aria-label="Xem thử miễn phí" className="space-y-4">
          <PreviewSuspensionNotice
            allocation={preview.allocation}
            canManage={canManagePreviewMarkers}
            onAction={() => document.getElementById("course-preview-expand-markers")?.click()}
          />
          <CoursePreviewAllocationCard
            allocation={preview.allocation}
            isLoading={preview.isLoading}
            isUpdating={preview.isUpdating}
            error={preview.error}
            canManage={canManagePreviewMarkers}
            showTopicListAction={false}
            onChange={preview.changeMarkers}
            onRefresh={preview.refresh}
          />
          <TopicPreviewMarkerToggle
            topicId={topicId}
            title={topicTitle}
            status={topicStatus}
            allocation={preview.allocation}
            canManage={canManagePreviewMarkers}
            isUpdating={preview.isUpdating}
            onChange={preview.changeMarkers}
          />
        </section>
      ) : null}

      <section
        aria-labelledby={`${titleId}-danger`}
        className="mt-10 flex flex-col items-stretch gap-4 rounded-2xl border border-correction-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="min-w-0 flex-1">
          <h2 id={`${titleId}-danger`} className="text-base font-bold text-correction">
            Khu vực nguy hiểm
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Bài học sẽ được ẩn khỏi cấu trúc khóa học. Nội dung bên trong vẫn được giữ lại và không bị xóa vĩnh viễn.
          </p>
        </div>
        <Button
          variant="destructive-quiet"
          size="lg"
          disabled={readOnly}
          onClick={() => setIsDeleteDialogOpen(true)}
          className="w-full border border-correction-line sm:w-auto"
        >
          <Trash2 aria-hidden="true" /> Xóa bài học này
        </Button>
      </section>

      <PreviewQuotaResolutionDialog
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        targetType="topic"
        targetId={topicId}
        targetTitle={topicTitle}
        description="Bài học sẽ được ẩn khỏi cấu trúc đang hoạt động. Nội dung bên trong được giữ lại và có thể khôi phục."
        publishedImpact={isPublished ? PUBLISHED_DELETE_IMPACT.topic : undefined}
        confirmText="Xóa bài học"
        loadingText="Đang xóa bài học…"
        getProjection={getTopicDeletePreviewProjection}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// app/(teacher)/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx
import React, { useState, useEffect, useTransition } from "react";
import {
  FileText,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Headphones,
  ImageIcon,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getExercisesByTopicId,
  deleteExercise,
  deleteQuestion,
  updateExerciseBasic,
  updateQuestionGroup,
  updateQuestion,
  deleteQuestionGroupMedia,
} from "@/app/actions/exercise";
import {
  FullExercise,
  FullExerciseQuestion,
  FullExerciseGroup,
  FullExerciseOption,
} from "@/lib/schemas/exercise";
import AddExerciseDialog from "./AddExerciseDialog";
import QuestionGroupMediaField, {
  type UploadedQuestionGroupMedia,
} from "./QuestionGroupMediaField";

export default function ExerciseTab({ topicId }: { topicId: string }) {
  const [exercises, setExercises] = useState<FullExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // STATES: XÓA
  const [deletingExercise, setDeletingExercise] = useState<FullExercise | null>(
    null,
  );
  const [deletingQuestion, setDeletingQuestion] =
    useState<FullExerciseQuestion | null>(null);

  // STATES: SỬA TẦNG 1 (EXERCISE)
  const [editingExercise, setEditingExercise] = useState<FullExercise | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editPart, setEditPart] = useState("");

  // STATES: SỬA TẦNG 2 (GROUP)
  const [editingGroup, setEditingGroup] = useState<FullExerciseGroup | null>(
    null,
  );
  const [editGroupPassage, setEditGroupPassage] = useState("");
  const [editGroupAudio, setEditGroupAudio] = useState("");
  const [editGroupImage, setEditGroupImage] = useState("");
  const [editUploadedMedia, setEditUploadedMedia] = useState<UploadedQuestionGroupMedia[]>([]);

  // STATES: SỬA TẦNG 3 (QUESTION & OPTIONS)
  const [editingQuestion, setEditingQuestion] =
    useState<FullExerciseQuestion | null>(null);
  const [editQuestionContent, setEditQuestionContent] = useState("");
  const [editQuestionExplanation, setEditQuestionExplanation] = useState("");
  const [editQuestionOptions, setEditQuestionOptions] = useState<
    (Omit<FullExerciseOption, "id"> & { id?: string })[]
  >([]);

  const optionLabel = (index: number) => {
    let label = "";
    let cursor = index;

    do {
      label = String.fromCharCode(65 + (cursor % 26)) + label;
      cursor = Math.floor(cursor / 26) - 1;
    } while (cursor >= 0);

    return label;
  };

  const trackEditUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setEditUploadedMedia((current) => [
      ...current.filter(
        (item) => item.bucket !== media.bucket || item.path !== media.path,
      ),
      media,
    ]);
  };

  const forgetEditUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setEditUploadedMedia((current) =>
      current.filter(
        (item) => item.bucket !== media.bucket || item.path !== media.path,
      ),
    );
  };

  const cleanupEditUploadedMedia = async (
    mediaList: UploadedQuestionGroupMedia[],
  ) => {
    if (mediaList.length === 0) return;

    const results = await Promise.allSettled(
      mediaList.map((media) => deleteQuestionGroupMedia(media.bucket, media.path)),
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn("[QUESTION GROUP MEDIA EDIT CLEANUP REJECTED]:", result.reason);
        return;
      }

      if ("error" in result.value) {
        console.warn(
          "[QUESTION GROUP MEDIA EDIT CLEANUP ERROR]:",
          mediaList[index],
          result.value.error,
        );
      }
    });

    setEditUploadedMedia((current) =>
      current.filter(
        (item) =>
          !mediaList.some(
            (media) => media.bucket === item.bucket && media.path === item.path,
          ),
      ),
    );
  };

  // Tải danh sách bài tập
  useEffect(() => {
    let isMounted = true;
    const loadExercises = async () => {
      setIsLoading(true);
      const res = await getExercisesByTopicId(topicId);
      if (isMounted) {
        if (res.data) setExercises(res.data);
        setIsLoading(false);
      }
    };
    loadExercises();
    return () => {
      isMounted = false;
    };
  }, [topicId, refreshKey]);

  // ==================== HANDLERS: DELETE ====================
  const handleDeleteExercise = () => {
    if (!deletingExercise) return;
    startTransition(async () => {
      const res = await deleteExercise(deletingExercise.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setDeletingExercise(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const handleDeleteQuestion = () => {
    if (!deletingQuestion) return;
    startTransition(async () => {
      const res = await deleteQuestion(deletingQuestion.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setDeletingQuestion(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  // ==================== HANDLERS: EDIT ====================
  const openEditExercise = (ex: FullExercise) => {
    setEditingExercise(ex);
    setEditTitle(ex.title);
    setEditPart(ex.part_type);
  };
  const handleEditExerciseBasic = () => {
    if (!editingExercise) return;
    startTransition(async () => {
      const res = await updateExerciseBasic(
        editingExercise.id,
        editTitle,
        editPart,
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setEditingExercise(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const openEditGroup = (group: FullExerciseGroup) => {
    setEditingGroup(group);
    setEditGroupPassage(group.passage_text || "");
    setEditGroupAudio(group.audio_url || "");
    setEditGroupImage(group.image_url || "");
    setEditUploadedMedia([]);
  };
  const handleEditGroup = () => {
    if (!editingGroup) return;
    startTransition(async () => {
      // 🔥 Gọi API với đầy đủ 4 tham số theo cấu trúc mới
      const res = await updateQuestionGroup(
        editingGroup.id,
        editGroupPassage,
        editGroupAudio,
        editGroupImage,
      );
      if (res.error) {
        const mediaToCleanup = [...editUploadedMedia];
        await cleanupEditUploadedMedia(mediaToCleanup);

        mediaToCleanup.forEach((media) => {
          if (media.publicUrl === editGroupAudio) setEditGroupAudio("");
          if (media.publicUrl === editGroupImage) setEditGroupImage("");
        });

        toast.error(res.error);
      } else {
        toast.success(res.message);
        setEditUploadedMedia([]);
        setEditingGroup(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const openEditQuestion = (q: FullExerciseQuestion) => {
    setEditingQuestion(q);
    setEditQuestionContent(q.content);
    setEditQuestionExplanation(q.explanation || "");
    setEditQuestionOptions(
      q.options
        .slice()
        .sort(
          (a, b) =>
            (a.order_index ?? Number.MAX_SAFE_INTEGER) -
              (b.order_index ?? Number.MAX_SAFE_INTEGER) ||
            (a.label || "").localeCompare(b.label || "") ||
            a.id.localeCompare(b.id),
        )
        .map((o) => ({ ...o })),
    );
  };
  const handleEditQuestion = () => {
    if (!editingQuestion) return;
    const cleanOptions = editQuestionOptions
      .map((option) => ({
        id: option.id,
        content: option.content.trim(),
        is_correct: option.is_correct,
      }))
      .filter((option) => option.content !== "");

    if (cleanOptions.length < 2) {
      toast.error("Câu hỏi phải có ít nhất 2 đáp án hợp lệ.");
      return;
    }

    if (!cleanOptions.some((option) => option.is_correct)) {
      toast.error("Câu hỏi phải có ít nhất 1 đáp án đúng hợp lệ.");
      return;
    }

    startTransition(async () => {
      // 🔥 Khớp cấu trúc tham số giải thích mới của API
      const res = await updateQuestion(
        editingQuestion.id,
        editQuestionContent,
        editQuestionExplanation || null,
        cleanOptions,
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setEditingQuestion(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Kho bài tập</h2>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập câu hỏi trắc nghiệm và cụm ngữ liệu thông minh
          </p>
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl shadow-sm px-5"
        >
          <Plus size={18} className="mr-2" /> Thêm Bài tập
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">
            Chưa có bài tập nào
          </h3>
          <p className="text-slate-500 font-medium mt-2">
            Bấm &quot;Thêm Bài tập&quot; để tạo đề thi.
          </p>
        </div>
      ) : (
        exercises.map((ex) => (
          <div key={ex.id} className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-blue-600" /> {ex.title}
                <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full ml-3 uppercase font-semibold">
                  {ex.part_type}
                </span>
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => openEditExercise(ex)}
                >
                  <Pencil size={16} className="mr-2" /> Sửa thông tin chung
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                  onClick={() => setDeletingExercise(ex)}
                >
                  <Trash2 size={16} className="mr-2" /> Xóa bài
                </Button>
              </div>
            </div>

            {/* NHÁNH CHÍNH 1: HIỂN THỊ CÂU HỎI THEO CỤM/GROUP (PART 1, 3, 7) */}
            {ex.groups?.map((group, gIndex) => (
              <div
                key={group.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group/item"
              >
                <div className="lg:col-span-12 flex justify-end opacity-0 group-hover/item:opacity-100 transition-opacity gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-slate-500 hover:text-blue-600"
                    onClick={() => openEditGroup(group)}
                  >
                    <Pencil size={14} className="mr-2" /> Sửa nhóm ngữ liệu
                  </Button>
                </div>

                <div className="lg:col-span-5 space-y-4 border-r border-slate-100 pr-6 pt-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> Ngữ liệu (Nhóm {gIndex + 1})
                  </div>
                  {group.passage_text && (
                    <div className="bg-slate-50 p-5 rounded-xl text-slate-700 leading-relaxed text-sm italic border border-slate-100 whitespace-pre-wrap">
                      {group.passage_text}
                    </div>
                  )}
                  <div className="space-y-1">
                    {group.audio_url && (
                      <div className="text-blue-500 text-sm font-medium flex items-center gap-2 bg-blue-50/50 p-2 rounded-lg">
                        <Headphones size={15} /> Âm thanh đính kèm thành công
                      </div>
                    )}
                    {group.image_url && (
                      <div className="text-emerald-500 text-sm font-medium flex items-center gap-2 bg-emerald-50/50 p-2 rounded-lg">
                        <ImageIcon size={15} /> Hình ảnh đính kèm thành công
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-8 pt-2">
                  {group.questions?.map((q, idx) => (
                    <div
                      key={q.id}
                      className="space-y-4 relative group/question"
                    >
                      <div className="flex justify-end opacity-0 group-hover/question:opacity-100 transition-opacity gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-blue-600"
                          onClick={() => openEditQuestion(q)}
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-rose-600"
                          onClick={() => setDeletingQuestion(q)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>

                      <div className="font-bold text-slate-900 flex flex-col gap-1 pr-16">
                        <div className="flex gap-2">
                          <span className="text-blue-600">Q{idx + 1}.</span>{" "}
                          {q.content}
                        </div>
                        {q.explanation && (
                          <span className="text-xs font-normal text-slate-500 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic block">
                            <strong>Lời giải:</strong> {q.explanation}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((opt, optIndex) => (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                              opt.is_correct
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200 font-bold"
                                : "bg-white border-slate-200 text-slate-600"
                            }`}
                          >
                            <span className="text-sm">
                              <span className="font-bold mr-2">
                                {opt.label || optionLabel(optIndex)}.
                              </span>
                              {opt.content}
                            </span>
                            {opt.is_correct && (
                              <CheckCircle2
                                size={16}
                                className="text-emerald-600"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* NHÁNH CHÍNH 2: HIỂN THỊ LUỒNG CÂU HỎI ĐỘC LẬP TẠI GỐC ROOT (PHÙ HỢP PART 5) */}
{ex.questions && ex.questions.length > 0 && (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
      <HelpCircle size={14} className="text-blue-500" /> Danh sách câu hỏi đơn độc lập
    </div>
    <div className="space-y-8">
      {/* 🔥 SỬA TẠI ĐÂY: Ép mảng questions về đúng chuẩn dữ liệu FullExerciseQuestion có ID chắc chắn */}
      {(ex.questions as unknown as FullExerciseQuestion[]).map((q, idx) => (
        <div key={q.id} className="space-y-4 relative group/question">
          <div className="flex justify-end opacity-0 group-hover/question:opacity-100 transition-opacity gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-slate-400 hover:text-blue-600" 
              onClick={() => openEditQuestion(q)} // Hết lỗi! TS đã biết q.id chắc chắn là string
            >
              <Pencil size={12} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-rose-600" onClick={() => setDeletingQuestion(q)}>
              <Trash2 size={12} />
            </Button>
          </div>

          <div className="font-bold text-slate-900 flex flex-col gap-1 pr-16">
            <div className="flex gap-2">
              <span className="text-blue-600">Q{idx + 1}.</span> {q.content}
            </div>
            {q.explanation && (
              <span className="text-xs font-normal text-slate-500 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic block">
                <strong>Lời giải:</strong> {q.explanation}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {q.options?.map((opt, optIndex) => (
              <div
                key={opt.id}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  opt.is_correct
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200 font-bold"
                    : "bg-white border-slate-200 text-slate-600"
                }`}
              >
                <span className="text-sm">
                  <span className="font-bold mr-2">
                    {opt.label || optionLabel(optIndex)}.
                  </span>
                  {opt.content}
                </span>
                {opt.is_correct && <CheckCircle2 size={16} className="text-emerald-600" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
          </div>
        ))
      )}

      {/* ==================================================== */}
      {/* MODALS PHÂN TẦNG QUẢN LÝ DỮ LIỆU                     */}
      {/* ==================================================== */}

      <AddExerciseDialog
        isOpen={isAddOpen}
        setIsOpen={setIsAddOpen}
        topicId={topicId}
        onSuccess={() => setRefreshKey((p) => p + 1)}
      />

      {/* MODAL SỬA BÀI TẬP TẦNG 1 */}
      <Dialog
        open={!!editingExercise}
        onOpenChange={(open) => !open && setEditingExercise(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Sửa thông tin chung
            </DialogTitle>
            <DialogDescription className="hidden">
              Sửa Tên và loại Part
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Tên bài tập
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Loại bài (Part)
              </label>
              <Select value={editPart} onValueChange={setEditPart}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-80">
                  <SelectItem value="part1">
                    Part 1: Photographs (Listening)
                  </SelectItem>
                  <SelectItem value="part3">
                    Part 3: Conversations (Listening)
                  </SelectItem>
                  <SelectItem value="part5">
                    Part 5: Incomplete Sentences (Reading)
                  </SelectItem>
                  <SelectItem value="part7">
                    Part 7: Reading Comprehension
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setEditingExercise(null)}
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              disabled={isPending || editTitle.length < 4}
              onClick={handleEditExerciseBasic}
              className="bg-[#3B82F6] text-white rounded-xl"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL SỬA NHÓM TẦNG 2 - CẬP NHẬT THÊM IMAGE_URL */}
      <Dialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
      >
        <DialogContent className="sm:max-w-xl bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Sửa Nhóm ngữ liệu
            </DialogTitle>
            <DialogDescription className="hidden">
              Cập nhật nội dung tài nguyên phương tiện
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Đoạn văn (Reading Passage)
              </label>
              <Textarea
                value={editGroupPassage}
                onChange={(e) => setEditGroupPassage(e.target.value)}
                className="min-h-32 rounded-xl resize-none"
                placeholder="Nhập đoạn văn..."
              />
            </div>
            <QuestionGroupMediaField
              type="audio"
              label="Audio"
              value={editGroupAudio}
              onChange={setEditGroupAudio}
              onUploaded={trackEditUploadedMedia}
              onDeleted={forgetEditUploadedMedia}
              disabled={isPending}
            />
            <QuestionGroupMediaField
              type="image"
              label="Hình ảnh"
              value={editGroupImage}
              onChange={setEditGroupImage}
              onUploaded={trackEditUploadedMedia}
              onDeleted={forgetEditUploadedMedia}
              disabled={isPending}
            />
          </div>
          <div className="mt-4 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setEditingGroup(null)}
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              disabled={isPending}
              onClick={handleEditGroup}
              className="bg-[#3B82F6] text-white rounded-xl"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL SỬA CÂU HỎI TẦNG 3 - ĐÃ BỔ SUNG Ô NHẬP GIẢI THÍCH (EXPLANATION) */}
      <Dialog
        open={!!editingQuestion}
        onOpenChange={(open) => !open && setEditingQuestion(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Sửa Câu hỏi & Đáp án
            </DialogTitle>
            <DialogDescription className="hidden">
              Chỉnh sửa nội dung và phân định đáp án đúng
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto max-h-[65vh] pr-1">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Nội dung câu hỏi
              </label>
              <Input
                value={editQuestionContent}
                onChange={(e) => setEditQuestionContent(e.target.value)}
                className="h-12 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                Giải thích đáp án (Explanation)
              </label>
              <Textarea
                value={editQuestionExplanation}
                onChange={(e) => setEditQuestionExplanation(e.target.value)}
                className="min-h-20 rounded-xl resize-none"
                placeholder="Nhập căn cứ chọn đáp án đúng..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">
                Các đáp án (Tích chọn đáp án đúng)
              </label>
              <div className="space-y-3">
                {editQuestionOptions.map((opt, index) => (
                  <div
                    key={opt.id || index}
                    className="flex items-center gap-4 p-2 bg-slate-50 rounded-xl border"
                  >
                    <input
                      type="radio"
                      name="edit_correct_option"
                      className="w-5 h-5 text-blue-600 ml-2"
                      checked={opt.is_correct}
                      onChange={() => {
                        setEditQuestionOptions((prev) =>
                          prev.map((o, i) => ({
                            ...o,
                            is_correct: i === index,
                          })),
                        );
                      }}
                    />
                    <span className="w-8 text-sm font-bold text-slate-500 text-center">
                      {optionLabel(index)}
                    </span>
                    <Input
                      value={opt.content}
                      onChange={(e) => {
                        setEditQuestionOptions((prev) =>
                          prev.map((o, i) =>
                            i === index ? { ...o, content: e.target.value } : o,
                          ),
                        );
                      }}
                      className="h-10 rounded-lg flex-1 bg-white"
                      placeholder={`Đáp án ${String.fromCharCode(65 + index)}`}
                    />
                    {editQuestionOptions.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-400 hover:text-rose-600"
                        onClick={() => {
                          setEditQuestionOptions((prev) => {
                            const next = prev.filter((_, i) => i !== index);
                            if (!next.some((option) => option.is_correct)) {
                              next[0] = { ...next[0], is_correct: true };
                            }
                            return next;
                          });
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setEditQuestionOptions((prev) => [
                      ...prev,
                      { content: "", is_correct: false },
                    ])
                  }
                  className="w-full border-dashed text-blue-600 hover:bg-blue-50 rounded-xl font-bold"
                >
                  <Plus size={16} className="mr-2" /> Thêm đáp án{" "}
                  {optionLabel(editQuestionOptions.length)}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setEditingQuestion(null)}
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              disabled={isPending || !editQuestionContent.trim()}
              onClick={handleEditQuestion}
              className="bg-[#3B82F6] text-white rounded-xl"
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Lưu dữ liệu"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE MODALS */}
      <Dialog
        open={!!deletingExercise}
        onOpenChange={(open) => !open && setDeletingExercise(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa bài tập</DialogTitle>
            <DialogDescription>
              Hành động này sẽ soft-delete toàn bộ nhóm dữ liệu bên dưới.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeletingExercise(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleDeleteExercise}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-xl"
            >
              Xóa bài
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deletingQuestion}
        onOpenChange={(open) => !open && setDeletingQuestion(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Xóa câu hỏi</DialogTitle>
            <DialogDescription>
              Xóa câu hỏi và toàn bộ các phương án lựa chọn liên quan.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeletingQuestion(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleDeleteQuestion}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-xl"
            >
              Xóa câu hỏi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

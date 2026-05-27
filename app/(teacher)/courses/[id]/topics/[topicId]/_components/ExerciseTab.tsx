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
  deleteQuestionGroup,
  deleteQuestion,
  updateExerciseBasic,
  updateQuestionGroup,
  updateQuestion,
  FullExercise,
  FullExerciseQuestion,
  FullExerciseGroup,
  FullExerciseOption,
} from "@/app/actions/exercise";
import AddExerciseDialog from "./AddExerciseDialog";

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
  const [deletingGroup, setDeletingGroup] = useState<FullExerciseGroup | null>(
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

  // STATES: SỬA TẦNG 3 (QUESTION & OPTIONS)
  const [editingQuestion, setEditingQuestion] =
    useState<FullExerciseQuestion | null>(null);
  const [editQuestionContent, setEditQuestionContent] = useState("");
  const [editQuestionOptions, setEditQuestionOptions] = useState<
    FullExerciseOption[]
  >([]);

  // Load Data
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

  const handleDeleteGroup = () => {
    if (!deletingGroup) return;
    startTransition(async () => {
      const res = await deleteQuestionGroup(deletingGroup.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setDeletingGroup(null);
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
  };
  const handleEditGroup = () => {
    if (!editingGroup) return;
    startTransition(async () => {
      const res = await updateQuestionGroup(
        editingGroup.id,
        editGroupPassage,
        editGroupAudio,
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setEditingGroup(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  const openEditQuestion = (q: FullExerciseQuestion) => {
    setEditingQuestion(q);
    setEditQuestionContent(q.content);
    setEditQuestionOptions(q.options.map((o) => ({ ...o }))); // Deep copy để không sửa trực tiếp props
  };
  const handleEditQuestion = () => {
    if (!editingQuestion) return;
    startTransition(async () => {
      const res = await updateQuestion(
        editingQuestion.id,
        editQuestionContent,
        editQuestionOptions,
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
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Kho bài tập</h2>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập câu hỏi trắc nghiệm đa phương tiện
          </p>
        </div>
        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl shadow-sm px-5"
        >
          <Plus size={18} className="mr-2" /> Thêm Bài tập
        </Button>
      </div>

      {/* LIST EXERCISES */}
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
            Bấm &quot;Thêm Bài tập&quot; để thiết lập câu hỏi.
          </p>
        </div>
      ) : (
        exercises.map((ex) => (
          <div key={ex.id} className="space-y-6">
            {/* TẦNG EXERCISE: TIÊU ĐỀ & NÚT HÀNH ĐỘNG */}
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-blue-600" /> {ex.title}
                <span className="text-sm font-normal text-slate-400 bg-slate-100 px-3 py-1 rounded-full ml-3 uppercase">
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
                  <Pencil size={16} className="mr-2" /> Sửa
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

            {/* TẦNG GROUP */}
            {ex.groups?.map((group, gIndex) => (
              <div
                key={group.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group/item"
              >
                {/* NÚT SỬA/XÓA GROUP */}
                <div className="absolute top-4 right-4 opacity-0 group-hover/item:opacity-100 transition-opacity flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-slate-500 hover:text-blue-600"
                    onClick={() => openEditGroup(group)}
                  >
                    <Pencil size={14} className="mr-2" /> Sửa nhóm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-slate-500 hover:text-rose-600"
                    onClick={() => setDeletingGroup(group)}
                  >
                    <Trash2 size={14} className="mr-2" /> Xóa
                  </Button>
                </div>

                {/* NGỮ LIỆU */}
                <div className="lg:col-span-5 space-y-4 border-r border-slate-100 pr-6 pt-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> Ngữ liệu (Nhóm {gIndex + 1})
                  </div>
                  {group.passage_text && (
                    <div className="bg-slate-50 p-5 rounded-xl text-slate-700 leading-relaxed text-sm italic border border-slate-100 whitespace-pre-wrap">
                      {group.passage_text}
                    </div>
                  )}
                  {group.audio_url && (
                    <div className="text-blue-500 text-sm font-medium flex items-center gap-2">
                      <Headphones size={16} /> Có Audio đính kèm
                    </div>
                  )}
                </div>

                {/* CÂU HỎI */}
                <div className="lg:col-span-7 space-y-8 pt-4">
                  {group.questions?.map((q, idx) => (
                    <div
                      key={q.id}
                      className="space-y-4 relative group/question"
                    >
                      {/* NÚT SỬA/XÓA CÂU HỎI */}
                      <div className="absolute top-0 right-0 opacity-0 group-hover/question:opacity-100 transition-opacity flex gap-1">
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

                      <div className="font-bold text-slate-900 flex gap-2 pr-16">
                        <span className="text-blue-600">Q{idx + 1}.</span>{" "}
                        {q.content}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((opt) => (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                              opt.is_correct
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200 font-bold"
                                : "bg-white border-slate-200 text-slate-600"
                            }`}
                          >
                            <span className="text-sm">{opt.content}</span>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed text-blue-600 hover:bg-blue-50"
                    onClick={() =>
                      toast("Tính năng Thêm Câu Hỏi rời đang xây dựng")
                    }
                  >
                    <Plus size={16} className="mr-2" /> Thêm câu hỏi vào nhóm
                    này
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed border-2 h-12 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
              onClick={() => toast("Tính năng Thêm Nhóm rời đang xây dựng")}
            >
              <Plus size={18} className="mr-2" /> Thêm Nhóm Ngữ Liệu (Group)
            </Button>
          </div>
        ))
      )}

      {/* ==================================================== */}
      {/* CÁC MODAL HỖ TRỢ BÊN DƯỚI */}
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
              Sửa thông tin Bài Tập
            </DialogTitle>
            <DialogDescription className="hidden">
              Sửa Tên và Part
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

      {/* MODAL SỬA NHÓM TẦNG 2 */}
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
              Sửa Ngữ liệu
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
                className="min-h-37.5 rounded-xl resize-none"
                placeholder="Nhập đoạn văn..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                <Headphones size={14} /> Link Audio (Listening)
              </label>
              <Input
                value={editGroupAudio}
                onChange={(e) => setEditGroupAudio(e.target.value)}
                className="h-12 rounded-xl"
                placeholder="Link .mp3..."
              />
            </div>
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

      {/* MODAL SỬA CÂU HỎI TẦNG 3 */}
      <Dialog
        open={!!editingQuestion}
        onOpenChange={(open) => !open && setEditingQuestion(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Sửa Câu hỏi</DialogTitle>
            <DialogDescription className="hidden">
              Sửa Câu hỏi và đáp án
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
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
              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">
                Các đáp án (Chọn đáp án đúng)
              </label>
              <div className="space-y-3">
                {editQuestionOptions.map((opt, index) => (
                  <div
                    key={opt.id}
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
                  </div>
                ))}
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
                "Lưu Câu hỏi"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CÁC MODAL XÓA GIỮ NGUYÊN (Lược bớt cho gọn file) */}
      <Dialog
        open={!!deletingExercise}
        onOpenChange={(open) => !open && setDeletingExercise(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription className="hidden">
              Xác nhận xóa
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeletingExercise(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleDeleteExercise}
              className="bg-rose-600 text-white"
            >
              Xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Xóa nhóm ngữ liệu</DialogTitle>
            <DialogDescription className="hidden">
              Xác nhận xóa
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeletingGroup(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleDeleteGroup}
              className="bg-rose-600 text-white"
            >
              Xóa
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
            <DialogDescription className="hidden">
              Xác nhận xóa
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeletingQuestion(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleDeleteQuestion}
              className="bg-rose-600 text-white"
            >
              Xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

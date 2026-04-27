"use client";
import React, { useTransition } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Plus, Trash2, ArrowLeft, Headphones } from "lucide-react";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { exerciseSchema, type ExerciseFormValues } from "@/lib/schemas/exercise";
import { createExercise } from "@/app/actions/exercise";

interface AddExerciseDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  topicId: string;
  onSuccess: () => void;
}

export default function AddExerciseDialog({ isOpen, setIsOpen, topicId, onSuccess }: AddExerciseDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema) as any,
    defaultValues: {
      title: "",
      part_type: "part7",
      order_index: 1,
      groups: [{ passage_text: "", audio_url: "", questions: [{ content: "", options: [
        { content: "", is_correct: true }, { content: "", is_correct: false },
        { content: "", is_correct: false }, { content: "", is_correct: false }
      ]}]}]
    }
  });

  const { fields: groupFields, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: "groups",
  });

  const onSubmit = (values: ExerciseFormValues) => {
    startTransition(async () => {
      const res = await createExercise(topicId, values);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        form.reset();
        setIsOpen(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent showCloseButton={false} className="bg-slate-50 border-slate-200 shadow-2xl w-[95vw]! sm:max-w-[95vw]! h-[95vh]! rounded-2xl p-0 flex flex-col z-60">
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
          <Button variant="ghost" onClick={() => setIsOpen(false)}><ArrowLeft size={22} /></Button>
          <DialogTitle className="text-xl font-bold">Thêm Bài tập mới</DialogTitle>
          
          {/* FIX WARNING: Thêm Description ẩn */}
          <DialogDescription className="hidden">Form thêm bài tập đa tầng</DialogDescription>
          
          <Button disabled={isPending} onClick={form.handleSubmit(onSubmit)} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl">
            {isPending ? <Loader2 className="animate-spin mr-2" /> : "Lưu Bài Tập"}
          </Button>
        </div>

        <Form {...form}>
          <form className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
            {/* TẦNG 1: THÔNG TIN CHUNG */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 gap-6">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên bài tập</FormLabel>
                  <FormControl><Input placeholder="VD: Reading Practice Test 1" className="h-12 rounded-xl" {...field} /></FormControl>
                  <FormMessage className="text-rose-500 text-xs" />
                </FormItem>
              )} />

              {/* FIX SELECT: Đã bọc FormField để Hook Form nhận state */}
              <FormField control={form.control} name="part_type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loại bài (Part)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Chọn Part" /></SelectTrigger>
                    </FormControl>
                    <SelectContent className="z-70">
                      <SelectItem value="part1">Part 1: Photographs (Listening)</SelectItem>
                      <SelectItem value="part3">Part 3: Conversations (Listening)</SelectItem>
                      <SelectItem value="part7">Part 7: Reading Comprehension</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-rose-500 text-xs" />
                </FormItem>
              )} />
            </div>

            {/* TẦNG 2: DANH SÁCH GROUPS */}
            <div className="space-y-6">
              {groupFields.map((group, gIndex) => (
                <div key={group.id} className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm relative">
                  <div className="absolute top-4 right-4">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(gIndex)} className="text-rose-500 hover:bg-rose-50"><Trash2 size={18} /></Button>
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 mb-4">Nhóm câu hỏi {gIndex + 1}</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Ngữ liệu của Group */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Đoạn văn (Reading Passage)</label>
                        <Textarea placeholder="Nhập đoạn văn cho nhóm câu hỏi này..." className="min-h-37.5 rounded-xl resize-none" {...form.register(`groups.${gIndex}.passage_text`)} />
                      </div>
                      
                      {/* BỔ SUNG: Ô NHẬP AUDIO URL */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Headphones size={14} /> Link Audio (Listening)
                        </label>
                        <Input placeholder="Nhập đường dẫn file âm thanh (.mp3, .wav)..." className="h-12 rounded-xl" {...form.register(`groups.${gIndex}.audio_url`)} />
                      </div>
                    </div>
                    
                    {/* TẦNG 3: CÂU HỎI */}
                    <QuestionList form={form} gIndex={gIndex} />
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={() => appendGroup({ passage_text: "", audio_url: "", questions: [{ content: "", options: [{ content: "", is_correct: true }, { content: "", is_correct: false }, { content: "", is_correct: false }, { content: "", is_correct: false }] }] })} className="w-full h-14 border-dashed border-2 text-blue-600 hover:bg-blue-50 font-bold rounded-2xl">
              <Plus className="mr-2" /> Thêm Nhóm câu hỏi (Ngữ liệu)
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// COMPONENT CON: QUẢN LÝ CÂU HỎI & ĐÁP ÁN (TẦNG 3 & 4)
// ==========================================
function QuestionList({ form, gIndex }: { form: any; gIndex: number }) {
  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: form.control,
    name: `groups.${gIndex}.questions`,
  });

  return (
    <div className="space-y-6">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Các câu hỏi</label>
      {questionFields.map((q, qIndex) => (
        <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex gap-2 mb-4">
            <span className="font-bold text-blue-600 mt-3">Q{qIndex + 1}.</span>
            <div className="flex-1">
               <Input placeholder="Nội dung câu hỏi..." className="h-10 rounded-lg bg-white" {...form.register(`groups.${gIndex}.questions.${qIndex}.content`)} />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(qIndex)} className="text-rose-500 mt-1"><Trash2 size={16} /></Button>
          </div>

          {/* TẦNG 4: 4 ĐÁP ÁN CỐ ĐỊNH */}
          <div className="grid grid-cols-1 gap-2 pl-6">
            {[0, 1, 2, 3].map((oIndex) => (
              <div key={oIndex} className="flex items-center gap-3">
                <input type="radio" 
                  className="w-4 h-4 text-blue-600" 
                  name={`groups.${gIndex}.questions.${qIndex}.correct_answer`} 
                  defaultChecked={oIndex === 0} 
                  onChange={() => {
                    [0, 1, 2, 3].forEach(i => {
                       form.setValue(`groups.${gIndex}.questions.${qIndex}.options.${i}.is_correct`, i === oIndex);
                    });
                  }}
                />
                <Input placeholder={`Đáp án ${String.fromCharCode(65 + oIndex)}`} className="h-9 rounded-lg bg-white" {...form.register(`groups.${gIndex}.questions.${qIndex}.options.${oIndex}.content`)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={() => appendQuestion({ content: "", options: [{ content: "", is_correct: true }, { content: "", is_correct: false }, { content: "", is_correct: false }, { content: "", is_correct: false }] })} className="text-blue-600 font-bold hover:bg-blue-50 w-full">
        <Plus size={16} className="mr-2" /> Thêm câu hỏi
      </Button>
    </div>
  );
}
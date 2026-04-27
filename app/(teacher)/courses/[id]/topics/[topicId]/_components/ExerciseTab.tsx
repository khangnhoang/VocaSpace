// app/(teacher)/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx
import React, { useState, useEffect } from "react";
import { FileText, MessageSquare, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExercisesByTopicId } from "@/app/actions/exercise";
import { Exercise } from "./type";
import AddExerciseDialog from "./AddExerciseDialog";

export default function ExerciseTab({ topicId }: { topicId: string }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Gắn API Lấy dữ liệu
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
    return () => { isMounted = false; };
  }, [topicId, refreshKey]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Kho bài tập</h2>
          <p className="text-sm text-slate-500 mt-1">Thiết lập câu hỏi trắc nghiệm đa phương tiện</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl shadow-sm px-5">
          <Plus size={18} className="mr-2" /> Thêm Bài tập
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-24 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Chưa có bài tập nào</h3>
          <p className="text-slate-500 font-medium mt-2">Bấm &quot;Thêm Bài tập&quot; để thiết lập câu hỏi.</p>
        </div>
      ) : (
        exercises.map((ex) => (
          <div key={ex.id} className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-blue-600" /> {ex.title}
              </h2>
            </div>

            {ex.groups?.map((group) => (
              <div key={group.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="lg:col-span-5 space-y-4 border-r border-slate-100 pr-6">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} /> Ngữ liệu
                  </div>
                  {group.passage_text && (
                    <div className="bg-slate-50 p-5 rounded-xl text-slate-700 leading-relaxed text-sm italic border border-slate-100">
                      {group.passage_text}
                    </div>
                  )}
                  {group.audio_url && <div className="text-blue-500 text-sm font-medium">[Có Audio đính kèm]</div>}
                </div>

                <div className="lg:col-span-7 space-y-8">
                  {group.questions?.map((q, idx) => (
                    <div key={q.id} className="space-y-4">
                      <div className="font-bold text-slate-900 flex gap-2">
                        <span className="text-blue-600">Q{idx + 1}.</span> {q.content}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((opt) => (
                          <div key={opt.id} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            opt.is_correct ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200" : "bg-white border-slate-200 text-slate-600"
                          }`}>
                            <span className="text-sm font-medium">{opt.content}</span>
                            {opt.is_correct && <CheckCircle2 size={16} className="text-emerald-600" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Gọi Modal Thêm Bài Tập */}
      <AddExerciseDialog 
        isOpen={isAddOpen} 
        setIsOpen={setIsAddOpen} 
        topicId={topicId} 
        onSuccess={() => setRefreshKey(p => p + 1)} 
      />
    </div>
  );
}

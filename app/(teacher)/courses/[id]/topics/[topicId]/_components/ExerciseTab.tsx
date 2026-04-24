// app/(teacher)/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx
import { FileText, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock Data từ Backend gửi
// Mock Data mô phỏng cấu trúc trả về từ Backend (Stage 1)
const mockExercises = [
  {
    id: "ex-1",
    title: "Reading Practice - Part 7",
    part_type: "part7",
    groups: [
      {
        id: "g-1",
        passage_text:
          "Please read the following email regarding the new company policy. Effective next Monday, all employees must log their hours using the new online portal. The old paper-based system will be officially discontinued. Failure to log your hours in the new system by Friday 5 PM will result in delayed payroll processing. If you encounter any technical issues with your login credentials, please contact the IT support desk immediately at extension 555.",
        image_url: null,
        audio_url: null,
        questions: [
          {
            id: "q-1",
            content: "What is the main purpose of the email?",
            options: [
              {
                id: "o-1",
                content: "To announce a company holiday",
                is_correct: false,
              },
              {
                id: "o-2",
                content: "To explain a new time-logging policy",
                is_correct: true,
              },
              {
                id: "o-3",
                content: "To fire an unproductive employee",
                is_correct: false,
              },
              {
                id: "o-4",
                content: "To request a departmental meeting",
                is_correct: false,
              },
            ],
          },
          {
            id: "q-2",
            content: "When does the new rule officially take effect?",
            options: [
              { id: "o-5", content: "Immediately", is_correct: false },
              { id: "o-6", content: "Next Monday", is_correct: true },
              { id: "o-7", content: "Next month", is_correct: false },
              { id: "o-8", content: "By Friday 5 PM", is_correct: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ex-2",
    title: "Listening Practice - Part 3",
    part_type: "part3",
    groups: [
      {
        id: "g-2",
        passage_text:
          "(Transcript for teacher reference) \nMan: Hi Sarah, do you happen to know if the color printer in the second-floor break room is working? I need to print the marketing brochures for the 3 PM presentation. \nWoman: No, unfortunately, it's out of magenta ink. I called the maintenance team this morning, and they said a technician will come to fix it by 2 PM.",
        image_url: null,
        audio_url: "https://example.com/audio-placeholder.mp3",
        questions: [
          {
            id: "q-3",
            content: "What is the man trying to do?",
            options: [
              {
                id: "o-9",
                content: "He cannot find the break room",
                is_correct: false,
              },
              {
                id: "o-10",
                content: "He needs to print some brochures",
                is_correct: true,
              },
              {
                id: "o-11",
                content: "He is fixing a broken machine",
                is_correct: false,
              },
              {
                id: "o-12",
                content: "He is calling the maintenance team",
                is_correct: false,
              },
            ],
          },
          {
            id: "q-4",
            content: "What time will the problem likely be resolved?",
            options: [
              { id: "o-13", content: "By this morning", is_correct: false },
              { id: "o-14", content: "By 2:00 PM", is_correct: true },
              { id: "o-15", content: "By 3:00 PM", is_correct: false },
              { id: "o-16", content: "Tomorrow morning", is_correct: false },
            ],
          },
        ],
      },
    ],
  },
];

export default function ExerciseTab() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {mockExercises.map((ex) => (
        <div key={ex.id} className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-blue-600" /> {ex.title}
            </h2>
            <Button variant="outline" size="sm">
              Thêm nhóm câu hỏi
            </Button>
          </div>

          {ex.groups.map((group) => (
            <div
              key={group.id}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              {/* Cột trái: Ngữ liệu (Passage/Audio/Image) */}
              <div className="lg:col-span-5 space-y-4 border-r border-slate-100 pr-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare size={14} /> Ngữ liệu (Reading Passage)
                </div>
                <div className="bg-slate-50 p-5 rounded-xl text-slate-700 leading-relaxed text-sm italic border border-slate-100">
                  {group.passage_text}
                </div>
                {/* Chừa chỗ cho Audio/Image sau này */}
                <div className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400">
                  Placeholder cho Audio / Image (Stage 2)
                </div>
              </div>

              {/* Cột phải: Danh sách câu hỏi */}
              <div className="lg:col-span-7 space-y-8">
                {group.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-4">
                    <div className="font-bold text-slate-900 flex gap-2">
                      <span className="text-blue-600">Q{idx + 1}.</span>{" "}
                      {q.content}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            opt.is_correct
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          <span className="text-sm font-medium">
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
        </div>
      ))}
    </div>
  );
}

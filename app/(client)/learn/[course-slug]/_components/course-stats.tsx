import { BookOpen, Layers, CreditCard, Dumbbell, Users } from "lucide-react";

interface CourseStatsProps {
  stats: {
    total_chapters: number;
    total_topics: number;
    total_cards: number;
    total_exercises: number;
    total_enrollments: number;
  };
}

export default function CourseStats({ stats }: CourseStatsProps) {
  const items = [
    {
      label: "Chương học",
      value: stats.total_chapters,
      icon: BookOpen,
      color: "text-blue-500 bg-blue-50",
    },
    {
      label: "Bài học",
      value: stats.total_topics,
      icon: Layers,
      color: "text-emerald-500 bg-emerald-50",
    },
    {
      label: "Thẻ từ vựng",
      value: stats.total_cards,
      icon: CreditCard,
      color: "text-purple-500 bg-purple-50",
    },
    {
      label: "Bài tập TOEIC",
      value: stats.total_exercises,
      icon: Dumbbell,
      color: "text-orange-500 bg-orange-50",
    },
    {
      label: "Học viên",
      value: stats.total_enrollments,
      icon: Users,
      color: "text-pink-500 bg-pink-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-center p-2">
          <div className={`p-3 rounded-xl ${item.color} mb-2 shrink-0`}>
            <item.icon size={22} />
          </div>
          <span className="text-xl font-bold text-slate-800">
            {item.value.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-500 mt-0.5">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

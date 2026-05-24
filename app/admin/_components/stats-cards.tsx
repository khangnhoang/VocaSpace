import { CircleDollarSign, Users, BookOpen, Brain } from "lucide-react";

interface StatsCardsProps {
  data: {
    totalRevenue: number;
    totalStudents: number;
    activeCourses: number;
    totalFlashcardReviews: number;
  };
}

export default function StatsCards({ data }: StatsCardsProps) {
  // Mảng cấu hình dữ liệu và UI cho 4 thẻ
  const cards = [
    {
      title: "Tổng doanh thu",
      value: `${data.totalRevenue.toLocaleString()}đ`,
      icon: CircleDollarSign,
      trend: "+12.5% so với tháng trước",
      trendColor: "text-emerald-400", // Xanh lá báo hiệu tăng trưởng tốt
      iconColor: "text-emerald-400 bg-emerald-400/10",
    },
    {
      title: "Tổng số học viên",
      value: data.totalStudents.toLocaleString(),
      icon: Users,
      trend: "+120 học viên mới tuần này",
      trendColor: "text-cyan-400", // Đồng bộ màu cyan của VocaSpace logo
      iconColor: "text-cyan-400 bg-cyan-400/10",
    },
    {
      title: "Khóa học hoạt động",
      value: data.activeCourses.toLocaleString(),
      icon: BookOpen,
      trend: "Bao gồm 142 bài học (Topics)",
      trendColor: "text-slate-400", // Màu trung tính cho thông tin phụ
      iconColor: "text-orange-400 bg-orange-400/10",
    },
    {
      title: "Lượt ôn tập thẻ (FSRS)",
      value: data.totalFlashcardReviews.toLocaleString(),
      icon: Brain,
      trend: "Độ ổn định (Stability) trung bình: 85%",
      trendColor: "text-purple-400",
      iconColor: "text-purple-400 bg-purple-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-sm hover:bg-slate-800 transition-colors duration-300"
        >
          {/* Tiêu đề & Icon */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400 tracking-wide">
              {card.title}
            </span>
            <div className={`p-2.5 rounded-xl ${card.iconColor}`}>
              <card.icon size={20} />
            </div>
          </div>

          {/* Con số chính */}
          <div className="mt-4">
            <span className="text-2xl font-bold text-white tracking-tight">
              {card.value}
            </span>
          </div>

          {/* Chỉ số phụ (Trend) */}
          <div className="mt-2">
            <span className={`text-xs font-medium ${card.trendColor}`}>
              {card.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
interface RevenueTrend {
  month: string;
  revenue: number;
}

interface UserDistribution {
  students: number;
  teachers: number;
  admins: number;
}

interface AnalyticsChartsProps {
  trends: RevenueTrend[];
  distribution: UserDistribution;
}

export default function AnalyticsCharts({
  trends,
  distribution,
}: AnalyticsChartsProps) {
  const totalUsers =
    distribution.students + distribution.teachers + distribution.admins;

  // Tính toán tỷ lệ phần trăm cho biểu đồ Cơ cấu người dùng
  const studentPercent = Math.round((distribution.students / totalUsers) * 100);
  const teacherPercent = Math.round((distribution.teachers / totalUsers) * 100);
  const adminPercent = Math.round((distribution.admins / totalUsers) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      {/* 1. BÊN TRÁI: BIỂU ĐỒ ĐƯỜNG VÙNG (AREA CHART) - CHIẾM 70% (7/10 CỘT) */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 lg:col-span-7 flex flex-col justify-between">
        {/* Header của biểu đồ */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 tracking-wide">
              Xu hướng doanh thu
            </h3>
            <p className="text-2xl font-bold text-white mt-1">₫125,500,000</p>
          </div>
          <select className="bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer">
            <option>Theo tháng (Monthly)</option>
            <option>Theo tuần (Weekly)</option>
          </select>
        </div>

        {/* Khung vẽ biểu đồ SVG tự thích ứng kích thước */}
        <div className="w-full h-64 relative mt-4">
          <svg
            className="w-full h-full"
            viewBox="0 0 700 220"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Đổ màu Gradient nhạt dần cho vùng bên dưới đường cong */}
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="rgb(168, 85, 247)"
                  stopOpacity="0.25"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(168, 85, 247)"
                  stopOpacity="0.0"
                />
              </linearGradient>
            </defs>

            {/* Các đường kẻ ngang mờ làm mốc đồ thị (Grid Lines) */}
            <line
              x1="0"
              y1="20"
              x2="700"
              y2="20"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1="70"
              x2="700"
              y2="70"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1="120"
              x2="700"
              y2="120"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1="170"
              x2="700"
              y2="170"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1="210"
              x2="700"
              y2="210"
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* Vùng đổ màu bóng phía dưới (Area Path) */}
            <path
              d="M 10 180 Q 110 130 220 150 T 440 80 T 690 70 L 690 210 L 10 210 Z"
              fill="url(#chartGradient)"
            />

            {/* Đường vẽ cong chính mang màu sắc tím hiện đại (Line Path) */}
            <path
              d="M 10 180 Q 110 130 220 150 T 440 80 T 690 70"
              fill="none"
              stroke="#a855f7"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Điểm nút nhấn nổi bật (Tooltip Anchor Point) */}
            <circle
              cx="440"
              cy="80"
              r="5"
              fill="#a855f7"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>

          {/* Tooltip giả lập khi tương tác vi diệu */}
          <div className="absolute top-[50px] left-[60%] -translate-x-1/2 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-[11px] shadow-xl pointer-events-none z-10">
            <p className="font-semibold text-slate-400">Tháng 4 (Apr)</p>
            <p className="font-bold text-purple-400 mt-0.5">₫11,500,000</p>
          </div>
        </div>

        {/* Trục hoành hiển thị mốc thời gian đã được Việt hóa */}
        <div className="flex justify-between text-[11px] font-medium text-slate-500 mt-2 px-1">
          {trends.map((t, i) => (
            <span key={i} className="w-10 text-center">
              {t.month}
            </span>
          ))}
        </div>
      </div>

      {/* 2. BÊN PHẢI: BIỂU ĐỒ VÀNH KHUYÊN (DOUGHNUT CHART) - CHIẾM 30% (3/10 CỘT) */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 lg:col-span-3 flex flex-col justify-between items-center text-center">
        <div className="w-full text-left mb-4">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wide">
            Cơ cấu Người dùng
          </h3>
        </div>

        {/* Thân biểu đồ hình tròn có đục lỗ ở giữa kèm số Tổng */}
        <div className="relative w-44 h-44 flex items-center justify-center my-auto">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 42 42"
          >
            {/* Lát cắt nền xám cố định */}
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="#334155"
              strokeWidth="4.5"
            />

            {/* Lát cắt đại diện Học viên (Student - Màu Tím) */}
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="#a855f7"
              strokeWidth="4.5"
              strokeDasharray={`${studentPercent} ${100 - studentPercent}`}
              strokeDashoffset="0"
            />

            {/* Lát cắt đại diện Giảng viên (Teacher - Màu Xanh Cyan) */}
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="#06b6d4"
              strokeWidth="4.5"
              strokeDasharray={`${teacherPercent} ${100 - teacherPercent}`}
              strokeDashoffset={`-${studentPercent}`}
            />

            {/* Lát cắt đại diện Quản trị viên (Admin - Màu Hồng) */}
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="#f43f5e"
              strokeWidth="4.5"
              strokeDasharray={`${adminPercent} ${100 - adminPercent}`}
              strokeDashoffset={`-${studentPercent + teacherPercent}`}
            />
          </svg>

          {/* Dữ liệu lõi ghi nhận ở trung tâm quả địa cầu (Center Text) */}
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {totalUsers.toLocaleString()}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">
              Tổng số
            </span>
          </div>
        </div>

        {/* Mục Chú giải (Legend) thanh lịch nằm dưới đáy để tối ưu không gian UX */}
        <div className="w-full grid grid-cols-3 gap-2 pt-4 border-t border-slate-700/50 mt-4 text-[11px] font-medium">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
              <span>Học viên</span>
            </div>
            <span className="text-white font-bold mt-1">{studentPercent}%</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
              <span>Trợ giảng</span>
            </div>
            <span className="text-white font-bold mt-1">{teacherPercent}%</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>Admin</span>
            </div>
            <span className="text-white font-bold mt-1">{adminPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

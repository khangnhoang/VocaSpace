// app/admin/_components/analytics-charts.tsx
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

export default function AnalyticsCharts({ trends, distribution }: AnalyticsChartsProps) {
  // 1. Tính tổng doanh thu thực tế từ mảng dữ liệu truyền vào
  const totalRevenue = trends.reduce((sum, t) => sum + t.revenue, 0);

  // 2. Tính toán tỷ lệ phần trăm cho biểu đồ Cơ cấu người dùng (Doughnut)
  const totalUsers = distribution.students + distribution.teachers + distribution.admins;
  const studentPercent = Math.round((distribution.students / totalUsers) * 100);
  const teacherPercent = Math.round((distribution.teachers / totalUsers) * 100);
  const adminPercent = Math.round((distribution.admins / totalUsers) * 100);

  // ============================================================================
  // THUẬT TOÁN ĐỘNG HÓA TỌA ĐỘ ĐỒ THỊ SVG (DYNAMIC SVG LINE GENERATION)
  // ============================================================================
  const svgWidth = 700;
  const svgHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 20;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const floorY = svgHeight - paddingBottom; // Đường đáy đồ thị (Y = 200)

  // Tìm điểm doanh thu cao nhất để làm đỉnh đồ thị
  const maxRevenue = Math.max(...trends.map((t) => t.revenue), 1000000);

  // Ánh xạ mảng dữ liệu thô thành mảng tọa độ hình học (X, Y) trên khung SVG
  const points = trends.map((t, i) => {
    // Trục X phân bổ đều theo số lượng phần tử
    const x = paddingLeft + (i / (trends.length - 1)) * chartWidth;
    // Trục Y đảo ngược trong SVG (0 ở trên cùng, cao nhất ở dưới đáy)
    const y = floorY - (t.revenue / maxRevenue) * chartHeight;
    return { x, y, month: t.month, revenue: t.revenue };
  });

  // Tạo chuỗi lệnh vẽ đường thẳng nối các điểm (Line Path)
  const linePath = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  // Tạo chuỗi lệnh đổ màu vùng bóng phía dưới đồ thị (Area Path)
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = points.length > 0 
    ? `${linePath} L ${lastPoint.x} ${floorY} L ${firstPoint.x} ${floorY} Z`
    : "";

  // Chọn điểm cuối cùng trong mảng làm điểm hiển thị Tooltip hoạt họa
  const activePoint = lastPoint || { x: 440, y: 80, month: "N/A", revenue: 0 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      {/* 1. BÊN TRÁI: BIỂU ĐỒ ĐƯỜNG VÙNG (AREA CHART) */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 lg:col-span-7 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 tracking-wide">Xu hướng doanh thu</h3>
            {/* 🔥 FIX: Hiển thị tổng doanh thu thật thay vì số fix cứng */}
            <p className="text-2xl font-bold text-white mt-1">₫{totalRevenue.toLocaleString()}</p>
          </div>
          <select className="bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer">
            <option>Theo tháng (Monthly)</option>
            <option>Theo tuần (Weekly)</option>
          </select>
        </div>

        {/* Khung vẽ biểu đồ SVG tự thích ứng kích thước */}
        <div className="w-full h-64 relative mt-4">
          <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Các đường kẻ ngang mốc đồ thị (Grid Lines) */}
            <line x1="0" y1="20" x2={svgWidth} y2="20" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="70" x2={svgWidth} y2="70" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="120" x2={svgWidth} y2="120" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="170" x2={svgWidth} y2="170" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1={floorY} x2={svgWidth} y2={floorY} stroke="#475569" strokeWidth="1.5" />

            {/* 🔥 FIX: Vùng đổ màu bóng đã chạy theo data động */}
            {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}

            {/* 🔥 FIX: Đường vẽ chính (Line) chuyển sang nét gãy hiện đại (Straight-line Area) chạy theo data động */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#a855f7"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 🔥 FIX: Nút chấm Neo Tooltip tự động nhảy tới điểm mới nhất */}
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="5"
              fill="#a855f7"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>

          {/* 🔥 FIX: Định vị Tooltip động bằng CSS inline, số liệu map chuẩn từ điểm active */}
          <div 
            className="absolute -translate-x-1/2 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-[11px] shadow-xl pointer-events-none z-10 transition-all duration-300"
            style={{ 
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${(activePoint.y / svgHeight) * 100 - 15}%` 
            }}
          >
            <p className="font-semibold text-slate-400">Tháng {activePoint.month}</p>
            <p className="font-bold text-purple-400 mt-0.5">₫{activePoint.revenue.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex justify-between text-[11px] font-medium text-slate-500 mt-2 px-1">
          {trends.map((t, i) => (
            <span key={i} className="w-10 text-center">{t.month}</span>
          ))}
        </div>
      </div>

      {/* 2. BÊN PHẢI: BIỂU ĐỒ VÀNH KHUYÊN (DOUGHNUT CHART) */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 lg:col-span-3 flex flex-col justify-between items-center text-center">
        <div className="w-full text-left mb-4">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wide">Cơ cấu Người dùng</h3>
        </div>

        <div className="relative w-44 h-44 flex items-center justify-center my-auto">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 42 42">
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#334155" strokeWidth="4.5" />
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#a855f7" strokeWidth="4.5" strokeDasharray={`${studentPercent} ${100 - studentPercent}`} strokeDashoffset="0" />
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#06b6d4" strokeWidth="4.5" strokeDasharray={`${teacherPercent} ${100 - teacherPercent}`} strokeDashoffset={`-${studentPercent}`} />
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f43f5e" strokeWidth="4.5" strokeDasharray={`${adminPercent} ${100 - adminPercent}`} strokeDashoffset={`-${studentPercent + teacherPercent}`} />
          </svg>

          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-extrabold text-white tracking-tight">{totalUsers.toLocaleString()}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">Tổng số</span>
          </div>
        </div>

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
              <span>Giảng viên</span>
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
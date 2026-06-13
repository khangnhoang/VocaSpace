import React from "react";
import { BookOpen, Clock, CheckCircle, FileEdit, Users } from "lucide-react";

interface AdminCourseStatsProps {
  totalCourses: number;
  draftCourses: number;
  pendingCourses: number;
  publishedCourses: number;
  totalEnrollments?: number;
}

export function AdminCourseStats({
  totalCourses,
  draftCourses,
  pendingCourses,
  publishedCourses,
  totalEnrollments,
}: AdminCourseStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">
            Tổng khóa học
          </span>
          <BookOpen className="h-5 w-5 text-[#00C4D4]" />
        </div>
        <div className="text-3xl font-bold text-white">{totalCourses}</div>
      </div>

      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">Chờ duyệt</span>
          <Clock className="h-5 w-5 text-orange-400" />
        </div>
        <div className="text-3xl font-bold text-white">{pendingCourses}</div>
      </div>

      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">
            Đã xuất bản
          </span>
          <CheckCircle className="h-5 w-5 text-blue-500" />
        </div>
        <div className="text-3xl font-bold text-white">{publishedCourses}</div>
      </div>

      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">Bản nháp</span>
          <FileEdit className="h-5 w-5 text-purple-400" />
        </div>
        <div className="text-3xl font-bold text-white">{draftCourses}</div>
      </div>

      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">
            Tổng lượt đăng ký
          </span>
          <Users className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="text-3xl font-bold text-white">
          {totalEnrollments !== undefined && totalEnrollments !== null
            ? totalEnrollments
            : "-"}
        </div>
      </div>
    </div>
  );
}

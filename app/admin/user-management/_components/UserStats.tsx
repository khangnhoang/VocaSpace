// File: app/admin/user-management/_components/UserStats.tsx
import React from "react";
import { GraduationCap, Briefcase, ShieldCheck, Users } from "lucide-react";

interface UserStatsProps {
  stats: { student: number; teacher: number; admin: number; total: number };
}

export default function UserStats({ stats }: UserStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">Học viên</span>
          <GraduationCap className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="text-3xl font-bold text-white">{stats.student}</div>
      </div>
      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">Giáo viên</span>
          <Briefcase className="h-5 w-5 text-blue-500" />
        </div>
        <div className="text-3xl font-bold text-white">{stats.teacher}</div>
      </div>
      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">Quản trị viên</span>
          <ShieldCheck className="h-5 w-5 text-purple-500" />
        </div>
        <div className="text-3xl font-bold text-white">{stats.admin}</div>
      </div>
      <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-400">Tổng tài khoản</span>
          <Users className="h-5 w-5 text-cyan-500" />
        </div>
        <div className="text-3xl font-bold text-white">{stats.total}</div>
      </div>
    </div>
  );
}
import React from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";

export type AdminCourseStatusFilter = "all" | "draft" | "pending" | "published";

interface AdminCourseToolbarProps {
  status: AdminCourseStatusFilter;
  query: string;
  onStatusChange: (status: AdminCourseStatusFilter) => void;
  onQueryChange: (query: string) => void;
}

export function AdminCourseToolbar({
  status,
  query,
  onStatusChange,
  onQueryChange,
}: AdminCourseToolbarProps) {
  return (
    <div className="flex w-full flex-col items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#111827] p-4 shadow-sm xl:flex-row">
      <div className="group relative w-full xl:max-w-md">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-hover:text-[#00C4D4]" />
        <Input
          aria-label="Tìm kiếm khóa học theo tên hoặc slug"
          placeholder="Tìm kiếm theo tên, slug..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-12 w-full rounded-xl border-slate-800 bg-[#0B1120] pl-12 text-sm text-slate-200 transition-all duration-300 placeholder:text-slate-600 hover:border-slate-700 focus-visible:ring-0 sm:text-base"
        />
      </div>
      <Tabs
        value={status}
        onValueChange={(value) =>
          onStatusChange(value as AdminCourseStatusFilter)
        }
        className="w-full xl:w-auto"
      >
        <TabsList
          aria-label="Lọc khóa học theo trạng thái"
          className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-[#0B1120] p-1 text-slate-500 sm:h-12 sm:grid-cols-4 xl:w-auto"
        >
          <TabsTrigger
            value="all"
            className="flex h-full cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-slate-800/50 hover:text-white data-[state=active]:bg-[#1E293B] data-[state=active]:text-white sm:py-0"
          >
            Tất cả
          </TabsTrigger>
          <TabsTrigger
            value="draft"
            className="flex h-full cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-slate-800/50 hover:text-white data-[state=active]:bg-[#1E293B] data-[state=active]:text-white sm:py-0"
          >
            Nháp
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="flex h-full cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-slate-800/50 hover:text-white data-[state=active]:bg-[#1E293B] data-[state=active]:text-white sm:py-0"
          >
            Chờ duyệt
          </TabsTrigger>
          <TabsTrigger
            value="published"
            className="flex h-full cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-slate-800/50 hover:text-white data-[state=active]:bg-[#1E293B] data-[state=active]:text-white sm:py-0"
          >
            Xuất bản
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

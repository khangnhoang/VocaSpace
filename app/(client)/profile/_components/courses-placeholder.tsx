// app/(client)/profile/_components/courses-placeholder.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Layers,
  ArrowRight,
  Loader2,
  Sparkles,
  Play,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { getUserDashboardOverview } from "@/app/actions/profile";
import ReviewSheet from "./review-sheet"; // Tích hợp Component Ngăn trượt mới

interface EnrolledCourse {
  id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
}

interface DeckStats {
  total: number;
  learning: number;
  due: number;
}

export default function CoursesPlaceholder() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [stats, setStats] = useState<DeckStats>({
    total: 0,
    learning: 0,
    due: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Trạng thái điều khiển trượt mở Sheet Global Review
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);

  const loadDashboard = async () => {
    const res = await getUserDashboardOverview();

    if (res?.error) {
      setError(res.error);
      return;
    }

    setCourses(res.enrolledCourses || []);
    setStats(res.deckStats || { total: 0, learning: 0, due: 0 });
  };

  const refreshDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      await loadDashboard();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard().finally(() => {
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="mt-4 text-sm font-medium text-slate-500">
          Đang tải dữ liệu học tập...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-rose-600">{error}</p>
      </div>
    );
  }

  const hasReviewableCards = stats.learning > 0 || stats.due > 0;

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* 1. THỐNG KÊ DECK TỔNG QUAN (ANKI COUNTERS) CÓ KÈM NÚT ÔN TẬP */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800">
              Thống kê Bộ thẻ (Anki Deck)
            </h3>
          </div>

          {/* NÚT KÍCH HOẠT SHEET TRƯỢT ÔN TẬP */}
          <Button
            onClick={() => setIsReviewSheetOpen(true)}
            disabled={stats.total === 0}
            className={`rounded-xl px-5 py-2 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all ${
              hasReviewableCards
                ? "bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            <Play size={13} fill="currentColor" />
            <span>{hasReviewableCards ? "Ôn tập ngay" : "Kiểm tra thẻ"}</span>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 text-center">
          <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-3 border border-slate-100">
            <span className="text-2xl font-black text-slate-700">
              {stats.total}
            </span>
            <span className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tổng số thẻ
            </span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl bg-orange-50 p-3 border border-orange-100">
            <span className="text-2xl font-black text-orange-600">
              {stats.learning}
            </span>
            <span className="mt-1 text-xs font-semibold text-orange-500 uppercase tracking-wider">
              Thẻ chưa xong
            </span>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 p-3 border border-emerald-100">
            <span className="text-2xl font-black text-emerald-600">
              {stats.due}
            </span>
            <span className="mt-1 text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Thẻ đến hạn
            </span>
          </div>
        </div>
      </div>

      {/* 2. DANH SÁCH KHÓA HỌC ĐÃ THAM GIA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-800">Khóa học của bạn</h3>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">
            {courses.length} khóa học
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="mb-3 h-12 w-12 stroke-1 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              Bạn chưa tham gia khóa học nào.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Hãy lật thẻ học tập để tự động ghi nhận khóa học nhé!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-blue-200 hover:bg-white hover:shadow-md"
              >
                <div>
                  <h4 className="line-clamp-1 font-bold text-slate-800">
                    {course.title}
                  </h4>
                  {course.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {course.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end border-t border-slate-100/80 pt-3">
                  <Link
                    href={`/learn/${course.slug}/overview`}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Tiếp tục học <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RENDER SHEET TRƯỢT TẠI GỐC COMPONENT */}
      <ReviewSheet
        isOpen={isReviewSheetOpen}
        onClose={() => setIsReviewSheetOpen(false)}
        onReviewComplete={refreshDashboard} // Refresh ngay số liệu khi có thay đổi
      />
    </div>
  );
}

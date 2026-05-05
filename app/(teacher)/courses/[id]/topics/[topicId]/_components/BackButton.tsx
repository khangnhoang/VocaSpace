"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()} // Hành vi này tương đương việc bấm nút "Back" trên trình duyệt, giúp đóng Sheet mượt mà
      className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
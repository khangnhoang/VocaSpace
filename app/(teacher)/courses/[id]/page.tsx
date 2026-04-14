"use client";

import React, { useState } from "react";
import { Plus, BookOpen, Pencil, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// ==========================================
// 1. DANH SÁCH KHÓA HỌC (Để hiển thị tên linh hoạt)
// ==========================================
const courseDictionary: Record<string, string> = {
  "toeic-800": "Chinh phục TOEIC 800+",
  "ielts-65": "IELTS Foundation 6.5",
  "toeic-vocab": "600 Từ vựng TOEIC cốt lõi",
};

// ==========================================
// 2. MOCK DATA (Đã bổ sung courseId để lọc)
// ==========================================
const initialChapters = [
  {
    id: "c1",
    courseId: "toeic-800", // Thuộc khóa TOEIC
    title: "Part 1: Photographs (Mô tả tranh)",
    order: 1,
    createdAt: "10/04/2026",
  },
  {
    id: "c2",
    courseId: "toeic-800", // Thuộc khóa TOEIC
    title: "Part 2: Question & Response (Hỏi đáp)",
    order: 2,
    createdAt: "11/04/2026",
  },
  {
    id: "c3",
    courseId: "ielts-65", // Thuộc khóa IELTS
    title: "Listening: Section 1 & 2",
    order: 1,
    createdAt: "12/04/2026",
  },
  {
    id: "c4",
    courseId: "toeic-vocab", // Thuộc khóa Từ vựng
    title: "Chủ đề 1: Office (Văn phòng)",
    order: 1,
    createdAt: "13/04/2026",
  },
];

export default function ChapterManagementPage() {
  // ==========================================
  // 3. CÁC STATE QUẢN LÝ DỮ LIỆU & GIAO DIỆN
  // ==========================================
  const [chapters, setChapters] = useState(initialChapters);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // State QUAN TRỌNG: Quản lý khóa học đang được XEM ở ngoài bảng
  const [viewCourseId, setViewCourseId] = useState("toeic-800");

  // State lưu dữ liệu form nhập vào khi thêm mới
  const [newTitle, setNewTitle] = useState("");
  const [newOrder, setNewOrder] = useState("");
  // Mặc định form thêm mới sẽ chọn sẵn khóa học đang xem
  const [newCourseId, setNewCourseId] = useState(viewCourseId);

  // PHẦN THÊM MỚI: State lưu thông tin chương chuẩn bị xóa
  const [chapterToDelete, setChapterToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // ==========================================
  // 4. HÀM XỬ LÝ KHI BẤM "THÊM MỚI"
  // ==========================================
  const handleAddChapter = () => {
    if (!newTitle.trim()) {
      alert("Vui lòng nhập tên chương!");
      return;
    }

    // Đếm số chương hiện tại của khóa học được chọn để tự động tăng số thứ tự
    const chaptersInSelectedCourse = chapters.filter(
      (c) => c.courseId === newCourseId,
    );

    const newChapter = {
      id: `c-${Date.now()}`,
      courseId: newCourseId, // Lưu ID khóa học người dùng đã chọn trong form
      title: newTitle,
      order: newOrder
        ? parseInt(newOrder)
        : chaptersInSelectedCourse.length + 1,
      createdAt: new Date().toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    };

    setChapters([...chapters, newChapter]);

    // Reset lại form và đóng Modal
    setNewTitle("");
    setNewOrder("");
    setIsDialogOpen(false);
  };

  // PHẦN THÊM MỚI: Hàm thực thi việc xóa khi người dùng ấn "Xác nhận"
  const confirmDelete = () => {
    if (chapterToDelete) {
      setChapters(chapters.filter((c) => c.id !== chapterToDelete.id));
      setChapterToDelete(null);
    }
  };

  // ==========================================
  // 5. LỌC DỮ LIỆU ĐỂ HIỂN THỊ LÊN BẢNG
  // ==========================================
  const displayedChapters = chapters.filter(
    (chapter) => chapter.courseId === viewCourseId,
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-6 md:p-10 font-sans text-black">
      <div className="max-w-6xl mx-auto">
        {/* PHẦN THÊM MỚI: MODAL XÁC NHẬN XÓA CHƯƠNG */}
        <Dialog
          open={!!chapterToDelete}
          onOpenChange={(isOpen) => !isOpen && setChapterToDelete(null)}
        >
          <DialogContent className="sm:max-w-100 bg-white border-slate-200 shadow-2xl rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Trash2 className="text-rose-500" size={22} strokeWidth={2.5} />
                Xác nhận xóa chương
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa chương{" "}
              <span className="font-bold text-slate-900">
                {chapterToDelete?.title}
              </span>{" "}
              không?
              <br />
              <span className="text-sm text-rose-500 mt-2 block italic">
                *Hành động này không thể hoàn tác.
              </span>
            </div>
            <DialogFooter className="px-6 py-5 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button
                onClick={() => setChapterToDelete(null)}
                className="cursor-pointer px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                className="cursor-pointer px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-md active:scale-95 transition-all"
              >
                Xóa ngay
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================== */}
        {/* HEADER */}
        {/* ========================================== */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-start gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mb-1">
                Quản lý chương học
              </h1>
              <p className="text-sm md:text-base text-slate-500">
                Sắp xếp và tổ chức nội dung bài học theo cấu trúc.
              </p>
            </div>
          </div>

          {/* Dialog thêm chương mới */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button
                className="cursor-pointer flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
                onClick={() => setNewCourseId(viewCourseId)} // Reset form về khóa đang xem
              >
                <Plus size={18} strokeWidth={2.5} />
                Thêm chương mới
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-120 bg-white border-slate-200 shadow-2xl rounded-2xl p-0 overflow-hidden">
              <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 ">
                  <Plus
                    className="text-emerald-500"
                    size={22}
                    strokeWidth={3}
                  />
                  Thêm Chương Mới
                </DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tên chương
                  </label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Nhập tên chương..."
                    className="h-12 border-slate-200 focus-visible:ring-[#3B82F6] rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Thứ tự hiển thị
                  </label>
                  <Input
                    type="number"
                    value={newOrder}
                    onChange={(e) => setNewOrder(e.target.value)}
                    placeholder="Ví dụ: 1"
                    className="h-12 border-slate-200 focus-visible:ring-[#3B82F6] rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Thuộc khóa học
                  </label>
                  <Select value={newCourseId} onValueChange={setNewCourseId}>
                    <SelectTrigger className="cursor-pointer w-full h-12 border-slate-200 focus:ring-[#3B82F6] focus:ring-2 focus:ring-offset-0 rounded-xl bg-white">
                      <SelectValue placeholder="-- CHỌN KHÓA HỌC --" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={4}
                      className="bg-white rounded-xl shadow-xl border-slate-100"
                    >
                      <SelectItem
                        value="toeic-800"
                        className="cursor-pointer py-3 font-medium focus:bg-blue-50 focus:text-[#3B82F6]"
                      >
                        Chinh phục TOEIC 800+
                      </SelectItem>
                      <SelectItem
                        value="ielts-65"
                        className="cursor-pointer py-3 font-medium focus:bg-blue-50 focus:text-[#3B82F6]"
                      >
                        IELTS Foundation 6.5
                      </SelectItem>
                      <SelectItem
                        value="toeic-vocab"
                        className="cursor-pointer py-3 font-medium focus:bg-blue-50 focus:text-[#3B82F6]"
                      >
                        600 Từ vựng TOEIC cốt lõi
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="px-6 py-5 border-t border-slate-100 bg-white flex gap-3">
                <DialogClose asChild>
                  <button className="cursor-pointer px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    Hủy bỏ
                  </button>
                </DialogClose>
                <button
                  onClick={handleAddChapter}
                  className="cursor-pointer px-6 py-2.5 text-sm font-semibold text-white bg-[#3B82F6] rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:bg-[#2563EB] active:scale-95 transition-all"
                >
                  Thêm Mới
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* ========================================== */}
        {/* KHỐI CHUYỂN ĐỔI KHÓA HỌC */}
        {/* ========================================== */}
        <div className="w-full space-y-8">
          <div className="flex flex-col md:flex-row gap-6 w-full">
            <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-5 flex items-center gap-4 transition-all">
              <div className="text-[#3B82F6] bg-blue-50 p-3 rounded-lg">
                <BookOpen size={24} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                  Khóa học hiện tại
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  {courseDictionary[viewCourseId]}
                </h2>
              </div>
            </div>

            <div className="w-full md:w-[320px] flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 ml-1">
                Chuyển khóa học
              </p>
              <Select value={viewCourseId} onValueChange={setViewCourseId}>
                <SelectTrigger className="cursor-pointer w-full bg-white border-slate-200 text-slate-900 font-medium h-14 rounded-xl shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="CHỌN KHÓA HỌC" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="bg-white border-slate-100 text-slate-800 shadow-xl rounded-xl"
                >
                  <SelectItem
                    value="toeic-800"
                    className="cursor-pointer py-3 font-medium focus:bg-blue-50 focus:text-[#3B82F6]"
                  >
                    Chinh phục TOEIC 800+
                  </SelectItem>
                  <SelectItem
                    value="ielts-65"
                    className="cursor-pointer py-3 font-medium focus:bg-blue-50 focus:text-[#3B82F6]"
                  >
                    IELTS Foundation 6.5
                  </SelectItem>
                  <SelectItem
                    value="toeic-vocab"
                    className="cursor-pointer py-3 font-medium focus:bg-blue-50 focus:text-[#3B82F6]"
                  >
                    600 Từ vựng TOEIC cốt lõi
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ========================================== */}
          {/* BẢNG DỮ LIỆU */}
          {/* ========================================== */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 w-20 text-center">STT</th>
                    <th className="px-6 py-4">Tên chương</th>
                    <th className="px-6 py-4 w-24 text-center">Thứ tự</th>
                    <th className="px-6 py-4 w-40">Ngày tạo</th>
                    <th className="px-6 py-4 w-32 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {displayedChapters
                    .sort((a, b) => a.order - b.order)
                    .map((chapter, index) => (
                      <tr
                        key={chapter.id}
                        className=" hover:bg-slate-50/50 transition-colors"
                        onClick={() =>
                          console.log(
                            `Chuyển sang trang chi tiết chương: ${chapter.title}`,
                          )
                        }
                      >
                        <td className="px-6 py-4 text-center text-slate-500">
                          <div className="border border-slate-200 bg-slate-50 rounded-md py-1 w-8 mx-auto text-xs">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-900">
                          {chapter.title}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500">
                          {chapter.order}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {chapter.createdAt}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              className="text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                              title="Sửa"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Pencil size={18} strokeWidth={2} />
                            </button>

                            {/* PHẦN THAY ĐỔI: Kích hoạt state thay vì xóa thẳng */}
                            <button
                              className="text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                              title="Xóa"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChapterToDelete({
                                  id: chapter.id,
                                  title: chapter.title,
                                });
                              }}
                            >
                              <Trash2 size={18} strokeWidth={2} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {/* Nếu khóa học này chưa có chương nào */}
                  {displayedChapters.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-slate-500"
                      >
                        Khóa học này chưa có chương nào. Hãy bấm Thêm chương
                        mới.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

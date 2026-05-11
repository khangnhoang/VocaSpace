"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, ProfileFormValues } from "@/lib/schemas/profile";
// Giả sử bạn đang dùng thư viện toast như 'sonner' hoặc 'react-hot-toast'
import { toast } from "sonner";

// Mock Data
const mockUserData = {
  full_name: "Nguyễn Văn A",
  username: "nguyenvana",
  dob: "2000-01-01",
  gender: "male" as const,
  phone: "0123456789", // Trường này sẽ read-only
};

export default function EditProfileForm() {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: mockUserData,
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsPending(true);

    // Fake API Delay 1.5s
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("Dữ liệu submit:", data);
    toast.success("Cập nhật thông tin thành công!");

    setIsPending(false);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Trường Phone - Read Only */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Số điện thoại
        </label>
        <input
          type="text"
          value={mockUserData.phone}
          readOnly
          disabled
          className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500 cursor-not-allowed sm:text-sm"
        />
      </div>

      {/* Trường Họ Tên */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Họ và tên
        </label>
        <input
          type="text"
          {...form.register("full_name")}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
        />
        {form.formState.errors.full_name && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.full_name.message}
          </p>
        )}
      </div>

      {/* Các trường khác tương tự... */}

      {/* Nút Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <span className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Đang lưu...
          </span>
        ) : (
          "Lưu thay đổi"
        )}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import EditProfileForm from "./edit-profile-form";
import ChangePasswordForm from "./change-pwd-form";

export default function ProfileSidebar() {
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Khung Avatar & Info cơ bản */}
      <div className="flex flex-col items-center border-b border-slate-100 bg-slate-50/50 p-6 text-center">
        <div className="mb-4 h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md bg-emerald-500 flex items-center justify-center text-white text-3xl font-bold">
          A
        </div>
        <h2 className="text-xl font-bold text-slate-800">Nguyễn Văn A</h2>
        <p className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-2">
          Student
        </p>
      </div>

      {/* Tabs chuyển đổi Form */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === "profile" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Hồ sơ
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === "security" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Bảo mật
        </button>
      </div>

      {/* Vùng render Form */}
      <div className="p-6">
        {activeTab === "profile" ? <EditProfileForm /> : <ChangePasswordForm />}
      </div>
    </div>
  );
}

// app/(client)/profile/_components/profile-sidebar.tsx
"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { getUserProfile, uploadAvatar } from "@/app/actions/profile";
import { UserProfileDTO } from "@/lib/schemas/profile";

import EditProfileForm from "./edit-profile-form";
import ChangePasswordForm from "./change-pwd-form";

export default function ProfileSidebar() {
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [profileData, setProfileData] = useState<UserProfileDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isUploadingAvatar, startAvatarTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref kiểm soát vòng đời, đảm bảo an toàn bộ nhớ và ngắt chuỗi cảnh báo của linter
  const isMounted = useRef(false);

  // Hàm thuần túy chỉ làm nhiệm vụ gọi Server Action
  const fetchRealData = useCallback(async () => {
    // Self-Audit: Server Action getUserProfile cần tự kiểm tra auth.uid() ở backend
    const res = await getUserProfile();
    
    // Chỉ cập nhật state khi component thực sự còn tồn tại trên DOM
    if (isMounted.current) {
      if (res.error) {
        toast.error(res.error);
      } else if (res.data) {
        setProfileData(res.data);
      }
      setIsLoading(false);
    }
  }, []);

  // Xử lý riêng khi user chủ động bấm làm mới dữ liệu
  const handleRefreshData = useCallback(() => {
    setIsLoading(true);
    fetchRealData();
  }, [fetchRealData]);

  useEffect(() => {
    isMounted.current = true;
    
    // Sử dụng luồng gọi ngầm định tách biệt khỏi context đồng bộ của Effect body
    const loadInitialData = async () => {
      await fetchRealData();
    };
    
    loadInitialData();

    return () => {
      isMounted.current = false;
    };
  }, [fetchRealData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    startAvatarTransition(async () => {
      const res = await uploadAvatar(formData);
      
      if (res.error) {
        toast.error(res.error);
        return; 
      }

      if (res.success && res.avatarUrl) {
        toast.success("Cập nhật ảnh đại diện thành công!");
        setProfileData((prev) => prev ? { ...prev, avatar_url: res.avatarUrl } : null);
      }
    });
  };

  const initialLetter = profileData?.full_name?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden font-sans">
      <div className="flex flex-col items-center border-b border-slate-100 bg-slate-50/50 p-6 text-center relative">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        <button
          type="button"
          disabled={isUploadingAvatar || isLoading}
          onClick={() => fileInputRef.current?.click()}
          className="mb-4 h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md bg-emerald-500 flex items-center justify-center text-white text-3xl font-bold relative group cursor-pointer active:scale-95 transition-all"
        >
          {isLoading ? (
            <Loader2 className="animate-spin w-8 h-8 text-white" />
          ) : isUploadingAvatar ? (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1 z-10">
              <Loader2 className="animate-spin w-6 h-6 text-white" />
            </div>
          ) : profileData?.avatar_url ? (
            <Image 
              src={profileData.avatar_url} 
              alt="Avatar" 
              fill
              sizes="96px"
              className="object-cover" 
            />
          ) : (
            initialLetter
          )}

          {!isLoading && !isUploadingAvatar && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white z-10">
              <Camera size={20} />
              <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">Tải ảnh</span>
            </div>
          )}
        </button>

        <h2 className="text-xl font-bold text-slate-800">
          {isLoading ? "Đang tải..." : profileData?.full_name || "Học viên"}
        </h2>
        
        <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mt-2 uppercase tracking-wider">
          {profileData?.role || "Student"}
        </p>
      </div>

      <div className="flex border-b border-slate-100 bg-slate-50/30">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
            activeTab === "profile" 
              ? "border-b-2 border-emerald-500 text-emerald-600 bg-white" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Hồ sơ cá nhân
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
            activeTab === "security" 
              ? "border-b-2 border-emerald-500 text-emerald-600 bg-white" 
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Bảo mật
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin w-8 h-8 text-emerald-500" />
          </div>
        ) : activeTab === "profile" ? (
          <EditProfileForm 
            initialData={profileData} 
            onRefreshData={handleRefreshData} 
          />
        ) : (
          <ChangePasswordForm />
        )}
      </div>
    </div>
  );
}
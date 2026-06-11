"use client";

import { useRef, useState } from "react";
import { Headphones, ImageIcon, LinkIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteQuestionGroupMedia,
  uploadQuestionGroupAudio,
  uploadQuestionGroupImage,
} from "@/app/actions/exercise";
import {
  validateQuestionGroupMediaFile,
  type QuestionGroupMediaType,
} from "@/lib/schemas/exercise";

export type UploadedQuestionGroupMedia = {
  bucket: string;
  path: string;
  publicUrl: string;
};

type MediaMode = "url" | "upload";

type QuestionGroupMediaFieldProps = {
  type: QuestionGroupMediaType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUploaded?: (media: UploadedQuestionGroupMedia) => void;
  onDeleted?: (media: UploadedQuestionGroupMedia) => void;
  disabled?: boolean;
};

export default function QuestionGroupMediaField({
  type,
  label,
  value,
  onChange,
  onUploaded,
  onDeleted,
  disabled = false,
}: QuestionGroupMediaFieldProps) {
  const [mode, setMode] = useState<MediaMode>("url");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] =
    useState<UploadedQuestionGroupMedia | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const Icon = type === "image" ? ImageIcon : Headphones;

  const uploadAction =
    type === "image" ? uploadQuestionGroupImage : uploadQuestionGroupAudio;

  const handleUpload = async (file: File | null | undefined) => {
    if (!file) return;

    const validated = await validateQuestionGroupMediaFile(type, file);
    if (!validated.success) {
      toast.error(validated.error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const result = await uploadAction(formData);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const previousUpload =
        uploadedMedia && value === uploadedMedia.publicUrl ? uploadedMedia : null;

      setUploadedMedia(result.data);
      onUploaded?.(result.data);
      onChange(result.data.publicUrl);
      toast.success(result.message);

      if (previousUpload) {
        const cleanup = await deleteQuestionGroupMedia(
          previousUpload.bucket,
          previousUpload.path,
        );
        if ("error" in cleanup) {
          console.warn("[QUESTION GROUP MEDIA CLIENT CLEANUP ERROR]:", cleanup.error);
        } else {
          onDeleted?.(previousUpload);
        }
      }
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClear = async () => {
    const mediaToDelete =
      uploadedMedia && value === uploadedMedia.publicUrl ? uploadedMedia : null;

    onChange("");

    if (!mediaToDelete) return;

    const result = await deleteQuestionGroupMedia(
      mediaToDelete.bucket,
      mediaToDelete.path,
    );

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setUploadedMedia(null);
    onDeleted?.(mediaToDelete);
    toast.success(result.message);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Icon size={14} /> {label}
        </label>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => setMode("url")}
            className={`h-8 px-3 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              mode === "url"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LinkIcon size={13} /> URL
          </button>
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => setMode("upload")}
            className={`h-8 px-3 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              mode === "upload"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Upload size={13} /> Upload
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || isUploading}
          placeholder={
            type === "image"
              ? "Dán link ảnh .jpg, .png hoặc .webp..."
              : "Dán link audio .mp3, .wav, .ogg, .m4a..."
          }
          className="h-11 rounded-xl"
        />
      ) : (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="file"
            disabled={disabled || isUploading}
            accept={
              type === "image"
                ? "image/jpeg,image/png,image/webp"
                : "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/aac,audio/webm"
            }
            onChange={(event) => handleUpload(event.target.files?.[0])}
            className="h-11 rounded-xl"
          />
          {isUploading && (
            <Button type="button" disabled variant="outline" className="h-11 rounded-xl">
              <Loader2 size={16} className="animate-spin" />
            </Button>
          )}
        </div>
      )}

      {value && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-blue-600 break-all"
            >
              {value}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || isUploading}
              onClick={handleClear}
              className="h-7 w-7 shrink-0 text-slate-400 hover:text-rose-600"
            >
              <X size={14} />
            </Button>
          </div>
          {type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Xem trước hình ảnh nhóm câu hỏi"
              className="max-h-36 w-full rounded-lg object-contain bg-white"
            />
          ) : (
            <audio controls src={value} className="w-full" />
          )}
        </div>
      )}
    </div>
  );
}

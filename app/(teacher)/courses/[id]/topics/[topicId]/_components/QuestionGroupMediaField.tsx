"use client";

import { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Headphones,
  ImageIcon,
  LinkIcon,
  Loader2,
  Pause,
  Play,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteQuestionGroupMedia } from "@/app/actions/exercise";
import {
  isValidQuestionGroupMediaUrl,
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
  error?: string;
  inputName?: string;
  initialMode?: MediaMode;
  disabled?: boolean;
};

export function getQuestionGroupMediaSummary(value: string) {
  try {
    const url = new URL(value);
    const lastSegment = url.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : url.hostname;
  } catch {
    return value;
  }
}

export function QuestionGroupMediaPreview({
  type,
  value,
  label,
  onRemove,
  disabled = false,
}: {
  type: QuestionGroupMediaType;
  value: string;
  label?: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canPreview = value.trim() !== "" && isValidQuestionGroupMediaUrl(type, value);
  const Icon = type === "image" ? ImageIcon : Headphones;
  const title =
    label || (type === "image" ? "Hình ảnh nhóm câu hỏi" : "Âm thanh nhóm câu hỏi");

  if (!canPreview) return null;

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      toast.error("Không thể phát âm thanh trong trình duyệt.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
          <Icon size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-700">{title}</div>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs font-medium text-blue-600"
          >
            {getQuestionGroupMediaSummary(value)}
          </a>
        </div>

        {type === "audio" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAudio}
            className="h-9 rounded-lg shrink-0"
          >
            {isPlaying ? (
              <Pause size={15} className="mr-1.5" />
            ) : (
              <Play size={15} className="mr-1.5" />
            )}
            {isPlaying ? "Tạm dừng" : "Phát"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded((current) => !current)}
            className="h-9 rounded-lg shrink-0"
          >
            {isExpanded ? (
              <ChevronUp size={15} className="mr-1.5" />
            ) : (
              <ChevronDown size={15} className="mr-1.5" />
            )}
            {isExpanded ? "Thu gọn" : "Xem"}
          </Button>
        )}

        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={onRemove}
            className="h-8 w-8 shrink-0 text-slate-400 hover:text-rose-600"
          >
            <X size={14} />
          </Button>
        )}
      </div>

      {type === "audio" && (
        <audio
          ref={audioRef}
          src={value}
          preload="none"
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {type === "image" && isExpanded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Xem trước hình ảnh nhóm câu hỏi"
          className="max-h-56 w-full rounded-lg object-contain bg-white border border-slate-100"
        />
      )}
    </div>
  );
}

export default function QuestionGroupMediaField({
  type,
  label,
  value,
  onChange,
  onUploaded,
  onDeleted,
  error,
  inputName,
  initialMode = "url",
  disabled = false,
}: QuestionGroupMediaFieldProps) {
  const [mode, setMode] = useState<MediaMode>(initialMode);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploadedMedia, setUploadedMedia] =
    useState<UploadedQuestionGroupMedia | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const Icon = type === "image" ? ImageIcon : Headphones;
  const displayError = error || uploadError;
  const canPreview = value.trim() !== "" && isValidQuestionGroupMediaUrl(type, value);

  const handleUpload = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadError("");
    setSelectedFileName(file.name);

    const validated = await validateQuestionGroupMediaFile(type, file);
    if (!validated.success) {
      setUploadError(validated.error);
      toast.error(validated.error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);

    setIsUploading(true);
    try {
      const response = await fetch("/api/question-group-media/upload", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json().catch(() => ({
        error: "Không thể tải file lên hệ thống. Vui lòng thử lại.",
      }))) as UploadedQuestionGroupMedia | { error: string };

      if (!response.ok || "error" in result) {
        const message =
          "error" in result
            ? result.error
            : "Không thể tải file lên hệ thống. Vui lòng thử lại.";
        setUploadError(message);
        toast.error(message);
        return;
      }

      const previousUpload =
        uploadedMedia && value === uploadedMedia.publicUrl ? uploadedMedia : null;

      setUploadedMedia(result);
      onUploaded?.(result);
      onChange(result.publicUrl);
      setSelectedFileName(file.name);
      toast.success("Đã tải file lên thành công.");

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
    setUploadError("");
    setSelectedFileName("");
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
          name={inputName}
          value={value}
          aria-invalid={!!displayError}
          onChange={(event) => {
            setUploadError("");
            onChange(event.target.value);
          }}
          disabled={disabled || isUploading}
          placeholder={
            type === "image"
              ? "Dán link ảnh .jpg, .png hoặc .webp..."
              : "Dán link audio .mp3, .wav, .ogg, .m4a..."
          }
          className="h-11 rounded-xl"
        />
      ) : (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            disabled={disabled || isUploading}
            className="sr-only"
            accept={
              type === "image"
                ? "image/jpeg,image/png,image/webp"
                : "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/aac,audio/webm"
            }
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
              className="h-11 rounded-xl font-bold"
            >
              {isUploading ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Upload size={16} className="mr-2" />
              )}
              {isUploading
                ? "Đang tải lên..."
                : type === "image"
                  ? "Chọn hình ảnh"
                  : "Chọn tệp âm thanh"}
            </Button>

            {(selectedFileName || uploadedMedia || value) && (
              <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-bold uppercase text-slate-400">
                  {isUploading ? "Đang xử lý" : uploadedMedia ? "Đã tải lên" : "Đã chọn"}
                </div>
                <div className="truncate text-xs font-medium text-slate-700">
                  {selectedFileName ||
                    (uploadedMedia?.path
                      ? getQuestionGroupMediaSummary(uploadedMedia.path)
                      : getQuestionGroupMediaSummary(value))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {displayError && (
        <p className="text-xs font-medium text-rose-500">{displayError}</p>
      )}

      {value && canPreview && (
        <QuestionGroupMediaPreview
          type={type}
          value={value}
          label={type === "image" ? "Hình ảnh đã gắn" : "Âm thanh đã gắn"}
          onRemove={handleClear}
          disabled={disabled || isUploading}
        />
      )}

      {value && !canPreview && (
        <p className="text-xs text-slate-500">
          URL chưa hợp lệ nên chưa thể hiển thị bản xem trước.
        </p>
      )}
    </div>
  );
}

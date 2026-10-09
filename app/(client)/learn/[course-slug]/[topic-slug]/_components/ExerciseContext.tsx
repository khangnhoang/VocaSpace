"use client";

import { useState } from "react";
import { Expand, Headphones, ImageOff, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { QuestionGroupDTO } from "@/lib/schemas/learn";
import type { MaterialArrangement, MaterialKind } from "./exercise-arrangement";

const MISSING_LABEL: Record<MaterialKind, string> = {
  image: "hình ảnh",
  audio: "âm thanh",
  passage: "đoạn văn",
};

interface ExerciseContextProps {
  group: QuestionGroupDTO;
  arrangement: MaterialArrangement;
  /** Whether the image may open in a larger dialog. Part 1 reads from the picture. */
  enlargeableImage: boolean;
  /** Lets a consumer react to a failed media request, e.g. Preview rechecks its eligibility. */
  onMediaError?: (src: string) => void;
}

/**
 * The enlarged view requests the image again, so it can fail after the inline one
 * loaded (for example when Preview was withdrawn in between) and reports it the
 * same way.
 */
function ZoomedImage({
  src,
  alt,
  onMediaError,
}: {
  src: string;
  alt: string;
  onMediaError?: (src: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border border-attention-line bg-attention-quiet p-6 text-center"
      >
        <ImageOff aria-hidden="true" className="size-8 text-attention" />
        <p className="text-sm font-medium text-slate-800">Không tải được hình ảnh.</p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setAttempt((current) => current + 1);
          }}
        >
          <RotateCcw aria-hidden="true" />
          Tải lại hình ảnh
        </Button>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={attempt}
      src={src}
      alt={alt}
      onError={() => {
        setFailed(true);
        onMediaError?.(src);
      }}
      className="mx-auto block h-auto max-h-[78vh] w-auto max-w-full object-contain"
    />
  );
}

/** Local retry for one failed media element; it never resubmits an answer. */
function MaterialImage({
  src,
  enlargeable,
  onMediaError,
}: {
  src: string;
  enlargeable: boolean;
  onMediaError?: (src: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const alt = "Hình ảnh của nhóm câu hỏi";
  const markFailed = () => {
    setStatus("failed");
    onMediaError?.(src);
  };

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-attention-line bg-attention-quiet p-6 text-center">
        <ImageOff aria-hidden="true" className="size-8 text-attention" />
        <p className="text-sm font-medium text-slate-800">Không tải được hình ảnh.</p>
        <Button
          variant="outline"
          onClick={() => {
            setStatus("loading");
            setAttempt((current) => current + 1);
          }}
        >
          <RotateCcw aria-hidden="true" />
          Tải lại hình ảnh
        </Button>
      </div>
    );
  }

  const image = (extraClassName: string) => (
    // Managed media has unknown intrinsic size and must not be cropped, so the
    // plain element is used instead of a fixed-frame optimized image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={attempt}
      src={src}
      alt={alt}
      // The server-rendered image can finish or fail before hydration attaches the
      // handlers below, so a settled element is read once when it mounts.
      ref={(element) => {
        if (element?.complete && status === "loading") {
          if (element.naturalWidth > 0) setStatus("ready");
          else markFailed();
        }
      }}
      onLoad={() => setStatus("ready")}
      onError={markFailed}
      className={extraClassName}
    />
  );

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${
        status === "loading" ? "min-h-48 animate-pulse motion-reduce:animate-none" : ""
      }`}
    >
      {image("mx-auto block h-auto max-h-[70vh] w-auto max-w-full object-contain")}
      {enlargeable && status === "ready" && (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="absolute right-2 bottom-2 bg-white/90"
              aria-label="Phóng to hình ảnh"
            >
              <Expand aria-hidden="true" />
              Phóng to
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] max-w-[min(96vw,64rem)] overflow-auto">
            <DialogHeader>
              <DialogTitle>Hình ảnh của nhóm câu hỏi</DialogTitle>
              <DialogDescription className="sr-only">
                Bản phóng to của hình ảnh đi kèm câu hỏi.
              </DialogDescription>
            </DialogHeader>
            <ZoomedImage src={src} alt={alt} onMediaError={onMediaError} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MaterialAudio({ src, onMediaError }: { src: string; onMediaError?: (src: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-recall-line bg-recall-quiet p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-recall">
        <Headphones aria-hidden="true" className="size-5" />
        Nghe âm thanh
      </p>
      {/* The element is keyed by the group, so moving between questions of one
          group keeps the player and its position. */}
      <audio
        key={attempt}
        controls
        preload="metadata"
        src={src}
        aria-label="Âm thanh của nhóm câu hỏi"
        onError={() => {
          setFailed(true);
          onMediaError?.(src);
        }}
        onLoadedMetadata={() => setFailed(false)}
        className="h-11 w-full"
      >
        Trình duyệt của bạn không hỗ trợ thẻ audio.
      </audio>
      {failed && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-800">
          <span>Không tải được âm thanh.</span>
          <Button variant="outline" size="sm" onClick={() => { setFailed(false); setAttempt((current) => current + 1); }}>
            <RotateCcw aria-hidden="true" />
            Tải lại âm thanh
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Group material in the arrangement chosen for its TOEIC part. Only material
 * the group really carries is rendered: no placeholder for absent media.
 */
export default function ExerciseContext({
  group,
  arrangement,
  enlargeableImage,
  onMediaError,
}: ExerciseContextProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {arrangement.kinds.map((kind) => {
        if (kind === "image" && group.image_url) {
          return (
            <MaterialImage
              key="image"
              src={group.image_url}
              enlargeable={enlargeableImage}
              onMediaError={onMediaError}
            />
          );
        }
        if (kind === "audio" && group.audio_url) {
          return <MaterialAudio key="audio" src={group.audio_url} onMediaError={onMediaError} />;
        }
        if (kind === "passage" && group.passage_text) {
          return (
            <div
              key="passage"
              className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-base leading-7 text-slate-800 [overflow-wrap:anywhere] md:p-5"
            >
              {group.passage_text}
            </div>
          );
        }
        return null;
      })}
      {arrangement.missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-attention-line bg-attention-quiet p-3 text-sm text-slate-900">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attention" />
          Nhóm câu hỏi này đang thiếu {arrangement.missing.map((kind) => MISSING_LABEL[kind]).join(", ")}. Hãy báo cho giáo viên của khóa học.
        </p>
      )}
    </div>
  );
}

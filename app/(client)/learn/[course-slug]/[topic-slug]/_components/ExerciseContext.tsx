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
import { viLearningText } from "@/lib/i18n/learning-text";
import type { Translate } from "@/lib/i18n/translate";
import type { QuestionGroupDTO } from "@/lib/schemas/learn";
import type { MaterialArrangement, MaterialKind } from "./exercise-arrangement";

const MISSING_KEY: Record<MaterialKind, string> = {
  image: "context.missingImage",
  audio: "context.missingAudio",
  passage: "context.missingPassage",
};

interface ExerciseContextProps {
  group: QuestionGroupDTO;
  arrangement: MaterialArrangement;
  /** Whether the image may open in a larger dialog. Part 1 reads from the picture. */
  enlargeableImage: boolean;
  /** Lets a consumer react to a failed media request, e.g. Preview rechecks its eligibility. */
  onMediaError?: (src: string) => void;
  /** `learning` namespace translator (H7); callers that do not pass one keep today's Vietnamese. */
  t?: Translate;
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
  t,
}: {
  src: string;
  alt: string;
  onMediaError?: (src: string) => void;
  t: Translate;
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
        <p className="text-sm font-medium text-slate-800">{t("context.imageFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setAttempt((current) => current + 1);
          }}
        >
          <RotateCcw aria-hidden="true" />
          {t("context.reloadImage")}
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
  t,
}: {
  src: string;
  enlargeable: boolean;
  onMediaError?: (src: string) => void;
  t: Translate;
}) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const alt = t("context.image");
  const markFailed = () => {
    setStatus("failed");
    onMediaError?.(src);
  };

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-attention-line bg-attention-quiet p-6 text-center">
        <ImageOff aria-hidden="true" className="size-8 text-attention" />
        <p className="text-sm font-medium text-slate-800">{t("context.imageFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            setStatus("loading");
            setAttempt((current) => current + 1);
          }}
        >
          <RotateCcw aria-hidden="true" />
          {t("context.reloadImage")}
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
              aria-label={t("context.enlargeLabel")}
            >
              <Expand aria-hidden="true" />
              {t("context.enlarge")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] max-w-[min(96vw,64rem)] overflow-auto">
            <DialogHeader>
              <DialogTitle>{t("context.image")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("context.enlargedDescription")}
              </DialogDescription>
            </DialogHeader>
            <ZoomedImage src={src} alt={alt} onMediaError={onMediaError} t={t} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MaterialAudio({
  src,
  onMediaError,
  t,
}: {
  src: string;
  onMediaError?: (src: string) => void;
  t: Translate;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-recall-line bg-recall-quiet p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-recall">
        <Headphones aria-hidden="true" className="size-5" />
        {t("context.listen")}
      </p>
      {/* The element is keyed by the group, so moving between questions of one
          group keeps the player and its position. */}
      <audio
        key={attempt}
        controls
        preload="metadata"
        src={src}
        aria-label={t("context.audioLabel")}
        onError={() => {
          setFailed(true);
          onMediaError?.(src);
        }}
        onLoadedMetadata={() => setFailed(false)}
        className="h-11 w-full"
      >
        {t("context.audioUnsupported")}
      </audio>
      {failed && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-800">
          <span>{t("context.audioFailed")}</span>
          <Button variant="outline" size="sm" onClick={() => { setFailed(false); setAttempt((current) => current + 1); }}>
            <RotateCcw aria-hidden="true" />
            {t("context.reloadAudio")}
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
  t = viLearningText,
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
              t={t}
            />
          );
        }
        if (kind === "audio" && group.audio_url) {
          return <MaterialAudio key="audio" src={group.audio_url} onMediaError={onMediaError} t={t} />;
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
          {t("context.missing", { kinds: arrangement.missing.map((kind) => t(MISSING_KEY[kind])).join(", ") })}
        </p>
      )}
    </div>
  );
}

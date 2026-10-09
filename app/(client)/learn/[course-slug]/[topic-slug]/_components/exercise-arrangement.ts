import {
  getToeicPartRule,
  type ToeicGroupContextField,
} from "@/lib/schemas/exercise";
import type { QuestionGroupDTO } from "@/lib/schemas/learn";

export type MaterialKind = "image" | "audio" | "passage";

export interface MaterialArrangement {
  /** Material that actually exists, in reading order. */
  kinds: MaterialKind[];
  /** `split` puts material beside the response on wide screens; `band` keeps a compact audio row above it. */
  layout: "none" | "band" | "split";
  /** Part 1 is read from the picture, so the image column gets the larger share. */
  dominant: "image" | "text";
  /** Context the part requires but the group does not carry. */
  missing: MaterialKind[];
}

// Reading order per TOEIC part. Parts that are not listed use the audio-first default.
const KIND_ORDER: Record<string, MaterialKind[]> = {
  part1: ["image", "audio", "passage"],
  part6: ["passage", "image", "audio"],
  part7: ["passage", "image", "audio"],
};
const DEFAULT_ORDER: MaterialKind[] = ["audio", "image", "passage"];

const FIELD_KIND: Record<ToeicGroupContextField, MaterialKind> = {
  image_url: "image",
  audio_url: "audio",
  passage_text: "passage",
};

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function presentKinds(group: QuestionGroupDTO): Set<MaterialKind> {
  const present = new Set<MaterialKind>();
  if (hasText(group.image_url)) present.add("image");
  if (hasText(group.audio_url)) present.add("audio");
  if (hasText(group.passage_text)) present.add("passage");
  return present;
}

/**
 * Chooses how a group's material sits next to its questions. It only orders and
 * places what the group actually carries: no field is invented, and the
 * authoring-only `visibleGroupContext` list does not hide learner material.
 */
export function arrangeMaterial(
  partType: string | null | undefined,
  group: QuestionGroupDTO,
  isStandalone: boolean,
): MaterialArrangement {
  if (isStandalone) {
    return { kinds: [], layout: "none", dominant: "text", missing: [] };
  }

  const present = presentKinds(group);
  const order = (partType && KIND_ORDER[partType]) || DEFAULT_ORDER;
  const kinds = order.filter((kind) => present.has(kind));
  const rule = partType ? getToeicPartRule(partType) : null;
  const missing = (rule?.requiredGroupContext ?? [])
    .map((field) => FIELD_KIND[field])
    .filter((kind) => !present.has(kind));

  const layout =
    kinds.length === 0
      ? "none"
      : kinds.includes("image") || kinds.includes("passage")
        ? "split"
        : "band";

  return {
    kinds,
    layout,
    dominant: partType === "part1" && kinds.includes("image") ? "image" : "text",
    missing,
  };
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";

export default function CourseThumbnail({ src, sizes }: { src: string | null; sizes: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return src && failedUrl !== src ? (
    <Image src={src} alt="" fill sizes={sizes} unoptimized className="object-cover" onError={() => setFailedUrl(src)} />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-slate-600"><BookOpen className="size-6" aria-hidden="true" /></span>
  );
}

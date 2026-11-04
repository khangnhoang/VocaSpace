"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import { cn } from "@/lib/utils";

export const PRIMARY_NAV_LABEL = "Điều hướng chính";

export const PRIMARY_NAV_LINKS = [
  { label: "Trang chủ", href: "/" },
  { label: "Khóa học", href: getPublicCourseCatalogPath() },
  { label: "Học tập", href: "/learn" },
] as const;

export function isCurrentPath(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function HeaderNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={PRIMARY_NAV_LABEL} className={className}>
      <ul className="flex items-center gap-1">
        {PRIMARY_NAV_LINKS.map(({ label, href }) => {
          const isCurrent = isCurrentPath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-[8px] px-3 text-sm font-semibold transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 motion-reduce:transition-none",
                  isCurrent ? "text-route" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

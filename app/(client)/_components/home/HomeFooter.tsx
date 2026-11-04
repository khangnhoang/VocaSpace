import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Facebook, Instagram, Youtube, type LucideIcon } from "lucide-react";
import type { HomeSocialLink, HomeSocialNetwork } from "@/lib/homepage/content";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import { cn } from "@/lib/utils";
import { HOME_CONTAINER } from "./home-layout";
import { TEACHER_SECTION_ID } from "./HomeTeacherSection";

// Màu thương hiệu chỉ hiện khi rê chuột/focus; icon trắng trên các nền này vẫn đạt 3:1 cho thành phần không phải chữ.
const SOCIAL_NETWORKS: Record<HomeSocialNetwork, { name: string; Icon: LucideIcon; hover: string }> = {
  facebook: { name: "Facebook", Icon: Facebook, hover: "hover:bg-[#1877F2] focus-visible:bg-[#1877F2]" },
  youtube: { name: "YouTube", Icon: Youtube, hover: "hover:bg-[#FF0000] focus-visible:bg-[#FF0000]" },
  instagram: { name: "Instagram", Icon: Instagram, hover: "hover:bg-[#E4405F] focus-visible:bg-[#E4405F]" },
};

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center text-slate-300 transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 motion-reduce:transition-none"
    >
      <ChevronRight
        aria-hidden="true"
        className="absolute -left-4 size-3.5 -translate-x-1 text-recall-line opacity-0 transition-[opacity,transform] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
      />
      {children}
    </Link>
  );
}

type HomeFooterProps = {
  socialLinks: readonly HomeSocialLink[];
};

export default function HomeFooter({ socialLinks }: HomeFooterProps) {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className={`${HOME_CONTAINER} grid grid-cols-1 gap-8 pb-8 pt-12 md:grid-cols-[2fr_1fr_1fr]`}>
        <div>
          <Image
            src="/brand/vocaspace-logo-white.svg"
            alt="VocaSpace"
            width={587}
            height={117}
            className="h-7 w-auto"
          />
          <p className="mt-4 max-w-[28em] text-sm leading-[22px] text-slate-400">
            Nền tảng học từ vựng bằng thẻ và lịch ôn tập cá nhân, cho người học và giáo viên tiếng Anh.
          </p>
          {socialLinks.length > 0 && (
            <ul aria-label="VocaSpace trên mạng xã hội" className="mt-5 flex gap-2">
              {socialLinks.map(({ network, href }) => {
                const { name, Icon, hover } = SOCIAL_NETWORKS[network];
                return (
                  <li key={network}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`VocaSpace trên ${name} (mở tab mới)`}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-[8px] border border-slate-300/20 text-slate-300 transition-[background-color,border-color,color,transform] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:border-transparent hover:text-white focus-visible:border-transparent focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                        hover,
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <nav aria-labelledby="home-footer-explore">
          <h2 id="home-footer-explore" className="mb-3 text-sm font-bold leading-5 text-white">
            Khám phá
          </h2>
          <ul className="grid gap-2 text-sm">
            <li>
              <FooterLink href={getPublicCourseCatalogPath()}>Khóa học</FooterLink>
            </li>
            <li>
              <FooterLink href="/learn">Học tập</FooterLink>
            </li>
            <li>
              <FooterLink href={`#${TEACHER_SECTION_ID}`}>Dành cho giáo viên</FooterLink>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="home-footer-legal">
          <h2 id="home-footer-legal" className="mb-3 text-sm font-bold leading-5 text-white">
            Pháp lý
          </h2>
          <ul className="grid gap-2 text-sm">
            <li>
              <FooterLink href="/privacy">Chính sách quyền riêng tư</FooterLink>
            </li>
            <li>
              <FooterLink href="/terms">Điều khoản sử dụng</FooterLink>
            </li>
          </ul>
        </nav>
      </div>
      <div className={HOME_CONTAINER}>
        <p className="border-t border-slate-300/15 py-5 text-xs leading-4 text-slate-400">
          © 2026 VocaSpace. Bảo lưu mọi quyền.
        </p>
      </div>
    </footer>
  );
}

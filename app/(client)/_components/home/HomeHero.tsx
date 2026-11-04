import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import HeroFreeCourseFact, { HeroFact } from "./HeroFreeCourseFact";
import HeroPractice from "./HeroPractice";
import { HOME_CONTAINER, HOME_EYEBROW } from "./home-layout";

// Màn mở đầu: các dòng của hero hiện lần lượt cách nhau 60ms, cả cụm xong trong khoảng 560ms rồi khung thử tự lật một lần.
// Chỉ CSS chạy khi tải trang; người dùng giảm chuyển động thấy ngay trạng thái cuối.
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[320ms] motion-safe:fill-mode-both";

type HomeHeroProps = {
  isSignedIn: boolean;
};

export default function HomeHero({ isSignedIn }: HomeHeroProps) {
  return (
    <section aria-labelledby="home-hero-title" className="py-10 sm:py-16">
      <div
        className={`${HOME_CONTAINER} grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14`}
      >
        <div>
          <p className={`${HOME_EYEBROW} ${ENTER}`}>TOEIC · IELTS · Từ vựng theo chủ đề</p>
          <h1
            id="home-hero-title"
            className={`${ENTER} motion-safe:delay-[60ms] mt-4 max-w-[13em] text-[32px] font-extrabold leading-10 tracking-[-0.02em] text-slate-900 sm:text-[40px] sm:leading-[48px]`}
          >
            Nhớ từ vựng lâu hơn, <span className="text-route">ôn đúng lúc</span> bạn sắp quên
          </h1>
          <p className={`${ENTER} motion-safe:delay-[120ms] mt-4 max-w-[34em] text-base leading-[26px] text-slate-600`}>
            Học bằng thẻ, tự đánh giá mức nhớ sau mỗi từ. VocaSpace xếp lịch ôn tiếp theo cho từng từ, để thời gian
            học dồn vào chỗ bạn còn yếu.
          </p>
          <div className={`${ENTER} motion-safe:delay-[180ms] mt-8 flex flex-col gap-4 sm:flex-row sm:items-center`}>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={getPublicCourseCatalogPath()}>
                Khám phá khóa học
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {isSignedIn ? (
              <Button asChild variant="link" size="lg" className="self-start px-1">
                <Link href="/learn">Tiếp tục học</Link>
              </Button>
            ) : (
              <Button asChild variant="link" size="lg" className="self-start px-1">
                <Link href="/register">Đăng ký miễn phí</Link>
              </Button>
            )}
          </div>
          <ul className={`${ENTER} motion-safe:delay-[240ms] mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600`}>
            <HeroFact>Nhiều khóa cho học thử không cần đăng nhập</HeroFact>
            <Suspense fallback={null}>
              <HeroFreeCourseFact />
            </Suspense>
          </ul>
        </div>
        <HeroPractice />
      </div>
    </section>
  );
}

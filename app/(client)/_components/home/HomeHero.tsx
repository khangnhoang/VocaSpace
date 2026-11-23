import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getPublicCourseCatalogPath } from "@/lib/public-courses/routes";
import HeroFreeCourseFact, { HeroFact } from "./HeroFreeCourseFact";
import HeroPractice from "./HeroPractice";
import { HOME_CONTAINER, HOME_EYEBROW } from "./home-layout";
import styles from "./hero-layout.module.css";

// Dùng CSS cho phần chữ server-rendered để nội dung vẫn hiện khi JavaScript chưa chạy.
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] motion-safe:fill-mode-both";

type HomeHeroProps = {
  isSignedIn: boolean;
};

export default function HomeHero({ isSignedIn }: HomeHeroProps) {
  const t = useTranslations("home");
  return (
    <section aria-labelledby="home-hero-title" className="py-10 sm:py-16 lg:py-[clamp(1.5rem,4svh,4rem)]">
      <div
        className={`${HOME_CONTAINER} ${styles.heroGrid} grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12`}
      >
        <div>
          <p className={`${HOME_EYEBROW} ${ENTER}`}>{t("hero.eyebrow")}</p>
          <h1
            id="home-hero-title"
            className={`${ENTER} motion-safe:delay-[140ms] mt-5 max-w-[13em] text-balance text-[36px] font-extrabold leading-[44px] tracking-[-0.02em] text-slate-900 sm:text-[48px] sm:leading-[58px] lg:text-[52px] lg:leading-[62px]`}
          >
            {t.rich("hero.title", {
              accent: (chunks) => <span className={`${styles.heroAccent} text-route`}>{chunks}</span>,
            })}
          </h1>
          <p className={`${ENTER} motion-safe:delay-[280ms] mt-6 max-w-[32em] text-base leading-[28px] text-slate-600`}>
            {t("hero.lead")}
          </p>
          <div className={`${ENTER} motion-safe:delay-[420ms] mt-8 flex flex-col gap-4 sm:flex-row sm:items-center`}>
            <Button asChild size="lg" className="w-full duration-[350ms] sm:w-auto">
              <Link href={getPublicCourseCatalogPath()}>
                {t("hero.explore")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {isSignedIn ? (
              <Button asChild variant="link" size="lg" className="self-start px-1 duration-[350ms]">
                <Link href="/learn">{t("hero.continue")}</Link>
              </Button>
            ) : (
              <Button asChild variant="link" size="lg" className="self-start px-1 duration-[350ms]">
                <Link href="/register">{t("hero.signUp")}</Link>
              </Button>
            )}
          </div>
          <ul className={`${ENTER} motion-safe:delay-[560ms] mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600`}>
            <HeroFact>{t("hero.factTrial")}</HeroFact>
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

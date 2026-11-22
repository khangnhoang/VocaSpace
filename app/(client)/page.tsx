import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";
import { getHomeContent } from "@/lib/homepage/content";
import PublicCourseHighlights from "./_components/PublicCourseHighlights";
import HomeFooter from "./_components/home/HomeFooter";
import HomeHero from "./_components/home/HomeHero";
import HomeHowItWorks from "./_components/home/HomeHowItWorks";
import HomeTeacherSection from "./_components/home/HomeTeacherSection";
import HomeTestimonials from "./_components/home/HomeTestimonials";
import { getHomeViewer } from "./_components/home/home-data";
import { HOME_CONTAINER } from "./_components/home/home-layout";
import { PublicCourseGridSkeleton } from "./courses/_components/PublicCourseStates";

export default async function Home() {
  const viewer = await getHomeViewer();
  const content = getHomeContent();
  const t = await getTranslations("home");

  // `home` và `flashcard` chỉ cho HeroPractice (client); `flashcard` cho nhãn đánh giá (U2 H2).
  return (
    <ClientNamespaces namespaces={["home", "flashcard"]}>
      <div className="flex w-full flex-col bg-slate-50">
        <HomeHero isSignedIn={viewer.isSignedIn} />
        <HomeHowItWorks />
        <Suspense
          fallback={
            <section className={`${HOME_CONTAINER} py-12 sm:py-16`}>
              <PublicCourseGridSkeleton count={4} label={t("highlights.loading")} />
            </section>
          }
        >
          <PublicCourseHighlights />
        </Suspense>
        <HomeTestimonials testimonials={content.testimonials} />
        <HomeTeacherSection isTeacher={viewer.isTeacher} />
        <HomeFooter socialLinks={content.socialLinks} />
      </div>
    </ClientNamespaces>
  );
}

import { useTranslations } from "next-intl";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";
import { cn } from "@/lib/utils";
import { HOME_CONTAINER, HOME_EYEBROW, HOME_SECTION_TITLE } from "./home-layout";
import StepsRail from "./StepsRail";

const STEPS = [
  { titleKey: "how.step1Title", bodyKey: "how.step1Body" },
  { titleKey: "how.step2Title", bodyKey: "how.step2Body" },
  { titleKey: "how.step3Title", bodyKey: "how.step3Body" },
] as const;

export default function HomeHowItWorks() {
  const t = useTranslations("home");
  const flashcardText = useTranslations("flashcard");
  return (
    <section aria-labelledby="home-how-title" className="border-y border-slate-200 bg-white py-12 sm:py-16">
      <div className={HOME_CONTAINER}>
        <p className={HOME_EYEBROW}>{t("how.eyebrow")}</p>
        <h2 id="home-how-title" className={cn("mt-2", HOME_SECTION_TITLE)}>
          {t("how.title")}
        </h2>
        <StepsRail className="mt-8 grid grid-cols-1 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <li key={step.titleKey} className={cn("relative pl-7 md:pl-0 md:pr-8", !isLast && "pb-8 md:pb-0")}>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    data-steps-connector={index}
                    className={cn(
                      "absolute -bottom-1.5 left-[5px] top-5 w-0.5 origin-top [--steps-rail-start:1_0] md:bottom-auto md:left-3 md:right-0 md:top-[5px] md:h-0.5 md:w-auto md:origin-left md:[--steps-rail-start:0_1]",
                      index === 0 ? "bg-recall" : "bg-route-line",
                    )}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-1.5 size-3 rounded-full border-2 md:static md:block",
                    isLast ? "border-route bg-route ring-[3px] ring-route-quiet" : "border-recall bg-recall",
                  )}
                />
                <h3 className="text-lg font-bold leading-[26px] text-slate-900 md:mt-5">{t(step.titleKey)}</h3>
                <p className="mt-2 max-w-[28em] text-sm leading-[22px] text-slate-600">{t(step.bodyKey)}</p>
                {index === 1 && (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {FLASHCARD_RATINGS.map(({ labelKey, className }) => (
                      <span
                        key={labelKey}
                        className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold leading-4", className)}
                      >
                        {flashcardText(labelKey)}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </StepsRail>
      </div>
    </section>
  );
}

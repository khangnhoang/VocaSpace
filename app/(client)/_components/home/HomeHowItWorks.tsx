import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";
import { cn } from "@/lib/utils";
import { HOME_CONTAINER, HOME_EYEBROW, HOME_SECTION_TITLE } from "./home-layout";
import StepsRail from "./StepsRail";

const STEPS = [
  {
    title: "Học bằng thẻ",
    body: "Mỗi chủ đề là một bộ thẻ có nghĩa, phiên âm và câu ví dụ, do giáo viên soạn theo mục tiêu thi.",
  },
  {
    title: "Tự đánh giá mức nhớ",
    body: "Sau mỗi thẻ bạn chọn một mức. Không có đúng sai, chỉ có bạn nhớ tới đâu.",
  },
  {
    title: "Ôn đúng lúc sắp quên",
    body: "Từ khó quay lại sớm, từ đã chắc giãn ra xa. Mỗi ngày bạn chỉ ôn những thẻ đến hạn.",
  },
] as const;

export default function HomeHowItWorks() {
  return (
    <section aria-labelledby="home-how-title" className="border-y border-slate-200 bg-white py-12 sm:py-16">
      <div className={HOME_CONTAINER}>
        <p className={HOME_EYEBROW}>Cách học</p>
        <h2 id="home-how-title" className={cn("mt-2", HOME_SECTION_TITLE)}>
          Ba bước để từ mới thành từ của bạn
        </h2>
        <StepsRail className="mt-8 grid grid-cols-1 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <li key={step.title} className={cn("relative pl-7 md:pl-0 md:pr-8", !isLast && "pb-8 md:pb-0")}>
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
                <h3 className="text-lg font-bold leading-[26px] text-slate-900 md:mt-5">{step.title}</h3>
                <p className="mt-2 max-w-[28em] text-sm leading-[22px] text-slate-600">{step.body}</p>
                {index === 1 && (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {FLASHCARD_RATINGS.map(({ label, className }) => (
                      <span
                        key={label}
                        className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold leading-4", className)}
                      >
                        {label}
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

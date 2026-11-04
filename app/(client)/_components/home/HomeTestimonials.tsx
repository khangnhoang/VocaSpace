import { CalendarCheck } from "lucide-react";
import type { HomeTestimonial } from "@/lib/homepage/content";
import { cn } from "@/lib/utils";
import { HOME_CONTAINER, HOME_EYEBROW, HOME_SECTION_TITLE } from "./home-layout";

type HomeTestimonialsProps = {
  testimonials: readonly HomeTestimonial[];
};

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function HomeTestimonials({ testimonials }: HomeTestimonialsProps) {
  if (testimonials.length === 0) return null;

  return (
    <section aria-labelledby="home-testimonials-title" className="pb-12 sm:pb-16">
      <div className={HOME_CONTAINER}>
        <p className={HOME_EYEBROW}>Học viên</p>
        <h2 id="home-testimonials-title" className={cn("mt-2", HOME_SECTION_TITLE)}>
          Học viên nói gì về VocaSpace
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((item) => (
            <li key={item.id}>
              <figure className="flex h-full flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6">
                <blockquote className="text-base leading-[26px] text-slate-900">
                  <span aria-hidden="true" className="mb-1 block text-[40px] font-extrabold leading-6 text-route-line">
                    “
                  </span>
                  {item.quote}
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-route-quiet font-bold text-route"
                  >
                    {initialsOf(item.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-5 text-slate-900">{item.name}</span>
                    <span className="block text-xs leading-4 text-slate-500">Học viên · {item.courseTitle}</span>
                  </span>
                </figcaption>
                {item.proof && (
                  <p className="flex items-center gap-2 border-t border-slate-200 pt-4 text-xs font-semibold leading-4 text-recall">
                    <CalendarCheck aria-hidden="true" className="size-4 shrink-0" />
                    {item.proof}
                  </p>
                )}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

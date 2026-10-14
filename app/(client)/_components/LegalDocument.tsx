import type { ReactNode } from "react";

// Ngày cập nhật dùng chung cho /privacy và /terms. Commit cuối trước khi merge đặt lại thành ngày merge (A4b G3).
export const LEGAL_LAST_UPDATED = "14/10/2026";

export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-gray-700 shadow-sm md:p-10 [&_p]:mt-3 [&_p]:leading-7 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:leading-7 [&_a]:text-blue-600 [&_a]:underline-offset-2 [&_a]:underline [&_strong]:font-semibold [&_strong]:text-gray-900">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">{title}</h1>
        <p className="!mt-2 text-sm text-gray-500">{`Cập nhật lần cuối: ${LEGAL_LAST_UPDATED}`}</p>
        {children}
      </article>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

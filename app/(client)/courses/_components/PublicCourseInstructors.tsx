import Image from "next/image";
import { Award, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

type PublicInstructor = NonNullable<PublicCourseDetail["owner"]>;

type PublicCourseInstructorsProps = {
  owner: PublicCourseDetail["owner"];
  collaborators: PublicCourseDetail["collaborators"];
};

function InstructorAvatar({ instructor }: { instructor: PublicInstructor }) {
  const t = useTranslations("courses");
  const displayName = instructor.full_name || t("detail.instructors.defaultName");

  return (
    <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-bold text-blue-600 ring-1 ring-blue-100">
      {instructor.avatar_url ? (
        <Image
          src={instructor.avatar_url}
          alt={t("detail.instructors.avatarAlt", { name: displayName })}
          fill
          sizes="56px"
          className="object-cover"
        />
      ) : instructor.full_name ? (
        <span aria-hidden="true">{instructor.full_name.charAt(0)}</span>
      ) : (
        <UserRound aria-hidden="true" className="size-6" />
      )}
    </div>
  );
}

function InstructorDetails({ instructor }: { instructor: PublicInstructor }) {
  const t = useTranslations("courses");
  return (
    <div className="min-w-0">
      <h4 className="break-words text-base font-bold text-gray-900">
        {instructor.full_name || t("detail.instructors.defaultName")}
      </h4>
      <p className="mt-1 text-sm leading-6 text-gray-600">
        {instructor.bio || t("detail.instructors.bioMissing")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
        {instructor.experience_years !== null && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1">
            {t("detail.instructors.experience", { years: instructor.experience_years })}
          </span>
        )}
        {instructor.certifications && (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
            <Award aria-hidden="true" className="size-3.5" />
            <span className="break-words">{instructor.certifications}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function PublicCourseInstructors({
  owner,
  collaborators,
}: PublicCourseInstructorsProps) {
  const t = useTranslations("courses");
  return (
    <section aria-labelledby="public-course-instructors-title">
      <h2
        id="public-course-instructors-title"
        className="text-2xl font-extrabold text-gray-900"
      >
        {t("detail.instructors.title")}
      </h2>

      <div className="mt-4 space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-blue-600">
            {t("detail.instructors.owner")}
          </h3>
          {owner ? (
            <div className="mt-4 flex items-start gap-4">
              <InstructorAvatar instructor={owner} />
              <InstructorDetails instructor={owner} />
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {t("detail.instructors.ownerMissing")}
            </p>
          )}
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">
            {t("detail.instructors.collaborators")}
          </h3>
          {collaborators.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              {t("detail.instructors.collaboratorsNone")}
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {collaborators.map((collaborator) => (
                <li
                  key={collaborator.id}
                  className="flex items-start gap-3 rounded-xl bg-gray-50 p-4"
                >
                  <InstructorAvatar instructor={collaborator} />
                  <InstructorDetails instructor={collaborator} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

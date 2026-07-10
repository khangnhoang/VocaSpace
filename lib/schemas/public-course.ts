import { z } from "zod";

const rawPostgresPriceSchema = z.union([
  z.number(),
  z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/),
]);

const rawPostgresEnrollmentCountSchema = z.union([
  z.number(),
  z.string().trim().regex(/^(?:0|[1-9]\d*)$/),
]);

const publicPriceSchema = rawPostgresPriceSchema
  .transform((value) => Number(value))
  .pipe(z.number().finite().nonnegative());

const publicEnrollmentCountSchema = rawPostgresEnrollmentCountSchema
  .transform((value) => Number(value))
  .pipe(z.number().int().nonnegative().safe());

export const publicCourseSlugSchema = z
  .string()
  .trim()
  .min(3)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const publicInstructorSchema = z
  .object({
    id: z.uuid(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    bio: z.string().nullable(),
    experience_years: z.number().int().nullable(),
    certifications: z.string().nullable(),
  })
  .strict();

const publicTopicRpcSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: publicCourseSlugSchema,
    order_index: z.number().int().nonnegative().safe(),
  })
  .strict();

const publicChapterRpcSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    order_index: z.number().int().nonnegative().safe(),
    topics: z.array(publicTopicRpcSchema),
  })
  .strict();

export const publicCourseCatalogItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: publicCourseSlugSchema,
    thumbnail_url: z.string().nullable(),
    price: publicPriceSchema,
    created_at: z.iso.datetime({ offset: true }),
    enrollment_count: publicEnrollmentCountSchema,
  })
  .strict();

export const publicCourseCatalogRpcSchema = z.array(
  publicCourseCatalogItemSchema,
);

export const publicCourseDetailRpcSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    slug: publicCourseSlugSchema,
    description: z.string().nullable(),
    thumbnail_url: z.string().nullable(),
    price: publicPriceSchema,
    created_at: z.iso.datetime({ offset: true }),
    enrollment_count: publicEnrollmentCountSchema,
    owner: publicInstructorSchema.nullable(),
    collaborators: z.array(publicInstructorSchema),
    syllabus: z.array(publicChapterRpcSchema),
  })
  .strict();

const publicTopicSchema = publicTopicRpcSchema.extend({
  is_temporary_preview: z.boolean(),
});

const publicChapterSchema = publicChapterRpcSchema.extend({
  topics: z.array(publicTopicSchema),
});

export const publicCourseDetailSchema = publicCourseDetailRpcSchema.extend({
  syllabus: z.array(publicChapterSchema),
  is_enrolled: z.boolean(),
});

export type PublicCourseCatalogItem = z.output<
  typeof publicCourseCatalogItemSchema
>;
export type PublicCourseDetailRpc = z.output<
  typeof publicCourseDetailRpcSchema
>;
export type PublicCourseDetail = z.output<typeof publicCourseDetailSchema>;

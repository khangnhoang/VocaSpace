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
  .pipe(z.number().nonnegative());

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
    is_preview: z.boolean(),
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

const publicCountSchema = z.number().int().nonnegative().safe();

// U2: read model của trang /courses; get_public_course_catalog giữ nguyên cho trang chủ và sitemap.
export const publicCourseCatalogListingItemSchema = publicCourseCatalogItemSchema
  .extend({
    recent_enrollment_count: publicEnrollmentCountSchema,
    topic_count: publicCountSchema,
    card_count: publicCountSchema,
    preview_topic_slug: publicCourseSlugSchema.nullable(),
    instructor_name: z.string().nullable(),
    description_excerpt: z.string().nullable(),
  })
  .strict();

export const publicCourseCatalogListingRpcSchema = z.array(
  publicCourseCatalogListingItemSchema,
);

export const PUBLIC_CATALOG_SORTS = [
  "popular",
  "trending",
  "newest",
  "az",
  "price-asc",
  "price-desc",
] as const;
export const PUBLIC_CATALOG_SEARCH_MAX_LENGTH = 100;

// Search param có thể lặp (?q=a&q=b); lấy giá trị đầu tiên như trình duyệt và URLSearchParams.get.
const firstSearchParam = (value: unknown) => (Array.isArray(value) ? value[0] : value);

// U2 AC5: tham số URL của /courses là input không tin cậy; giá trị sai quay về mặc định thay vì làm hỏng trang.
export const publicCourseCatalogQuerySchema = z.object({
  q: z.preprocess(
    firstSearchParam,
    z
      .string()
      .transform((value) => value.trim().slice(0, PUBLIC_CATALOG_SEARCH_MAX_LENGTH))
      .catch(""),
  ).default(""),
  gia: z.preprocess(firstSearchParam, z.enum(["free", "paid"]).optional().catch(undefined)),
  "hoc-thu": z.preprocess(firstSearchParam, z.literal("1").optional().catch(undefined)),
  "sap-xep": z.preprocess(firstSearchParam, z.enum(PUBLIC_CATALOG_SORTS).optional().catch(undefined)),
  trang: z.preprocess(
    firstSearchParam,
    z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  ),
});

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
    is_preview_suspended: z.boolean(),
    owner: publicInstructorSchema.nullable(),
    collaborators: z.array(publicInstructorSchema),
    syllabus: z.array(publicChapterRpcSchema),
  })
  .strict();

// LF3 AC10: tiến độ của học viên đã ghi danh, suy ra từ buildLearnCourseProgressProjection; null với khách và học viên chưa ghi danh.
export const publicCourseLearnerProgressSchema = z
  .object({
    completed_topic_ids: z.array(z.uuid()),
    next_topic_slug: publicCourseSlugSchema.nullable(),
  })
  .strict();

export const publicCourseDetailSchema = publicCourseDetailRpcSchema.extend({
  is_enrolled: z.boolean(),
  learner_progress: publicCourseLearnerProgressSchema.nullable(),
});

export type PublicCourseCatalogItem = z.output<
  typeof publicCourseCatalogItemSchema
>;
export type PublicCourseCatalogListingItem = z.output<
  typeof publicCourseCatalogListingItemSchema
>;
export type PublicCatalogSort = (typeof PUBLIC_CATALOG_SORTS)[number];
export type PublicCourseCatalogQueryRaw = z.input<typeof publicCourseCatalogQuerySchema>;
export type PublicCourseDetailRpc = z.output<
  typeof publicCourseDetailRpcSchema
>;
export type PublicCourseLearnerProgress = z.output<
  typeof publicCourseLearnerProgressSchema
>;
export type PublicCourseDetail = z.output<typeof publicCourseDetailSchema>;

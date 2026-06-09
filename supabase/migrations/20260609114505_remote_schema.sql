


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."course_member_role" AS ENUM (
    'previewer',
    'editor',
    'co_owner',
    'owner'
);


ALTER TYPE "public"."course_member_role" OWNER TO "postgres";


CREATE TYPE "public"."discount_type" AS ENUM (
    'fixed',
    'percentage'
);


ALTER TYPE "public"."discount_type" OWNER TO "postgres";


CREATE TYPE "public"."item_status" AS ENUM (
    'draft',
    'pending',
    'published'
);


ALTER TYPE "public"."item_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'creating',
    'pending',
    'paid',
    'failed',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'teacher',
    'student'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_modify_content_by_topic"("target_topic_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_course_id uuid;
BEGIN
  SELECT course_id
  INTO v_course_id
  FROM public.topics t
  WHERE t.id = target_topic_id;

  IF v_course_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.has_course_management_access(v_course_id);
END;
$$;


ALTER FUNCTION "public"."can_modify_content_by_topic"("target_topic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_modify_exercise_child"("target_exercise_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_course_id uuid;
BEGIN
  SELECT course_id
  INTO v_course_id
  FROM public.exercises e
  WHERE e.id = target_exercise_id;

  IF v_course_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.has_course_management_access(v_course_id);
END;
$$;


ALTER FUNCTION "public"."can_modify_exercise_child"("target_exercise_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_modify_question_option"("target_question_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_course_id uuid;
BEGIN
  SELECT course_id
  INTO v_course_id
  FROM public.questions q
  WHERE q.id = target_question_id;

  IF v_course_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.has_course_management_access(v_course_id);
END;
$$;


ALTER FUNCTION "public"."can_modify_question_option"("target_question_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_modify_topic"("target_chapter_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_course_id uuid;
BEGIN
  SELECT course_id
  INTO v_course_id
  FROM public.chapters ch
  WHERE ch.id = target_chapter_id;

  IF v_course_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.has_course_management_access(v_course_id);
END;
$$;


ALTER FUNCTION "public"."can_modify_topic"("target_chapter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_course_basic"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_status text;
  v_removed_at timestamp with time zone;
  v_is_collaborator boolean;
  v_user_role text;
BEGIN
  -- 1. Lấy trạng thái khóa học
  SELECT status, removed_at INTO v_status, v_removed_at
  FROM public.courses
  WHERE id = target_course_id;

  -- Khắc phục góp ý 1: Dùng FOUND biến native của PL/pgSQL, chặn đứng data bug
  IF NOT FOUND THEN
    RETURN false; 
  END IF;

  -- 2. Nếu không đăng nhập: Chỉ được xem nếu đã PUBLISHED và CHƯA bị xóa
  IF auth.uid() IS NULL THEN
    RETURN (v_status = 'published' AND v_removed_at IS NULL);
  END IF;

  -- 3. Đã đăng nhập: Kiểm tra quyền tối cao (Admin hệ thống)
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role = 'admin' THEN 
    RETURN true; 
  END IF;

  -- 4. CHỐT CHẶN THÙNG RÁC: Nếu khóa học đã bị xóa mềm
  -- Ngắt luồng sớm tại đây, đảm bảo chỉ quét bảng collaborators ĐÚNG 1 LẦN
  IF v_removed_at IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.course_collaborators cc
      WHERE cc.course_id = target_course_id 
        AND cc.user_id = auth.uid()
        AND cc.role IN ('owner', 'co_owner')
    );
  END IF;

  -- 5. Nếu khóa học CHƯA bị xóa mềm (Trạng thái Active bình thường)
  SELECT EXISTS (
    SELECT 1 FROM public.course_collaborators cc
    WHERE cc.course_id = target_course_id 
      AND cc.user_id = auth.uid()
      AND cc.role IN ('owner', 'co_owner', 'editor', 'previewer')
  ) INTO v_is_collaborator;

  IF v_status = 'published' THEN
    RETURN true;
  ELSE
    RETURN v_is_collaborator;
  END IF;
END;
$$;


ALTER FUNCTION "public"."can_view_course_basic"("target_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_payments"("p_limit" integer DEFAULT 100) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_expired_count INTEGER := 0;
BEGIN
  /*
    Expire các payment đã quá hạn.

    Chỉ xử lý payment còn ở creating/pending.
    Nhờ vậy function idempotent:
    - Chạy lần 1: creating/pending -> expired, release discount reservation
    - Chạy lần 2: payment đã expired rồi nên không đụng nữa
  */

  WITH target_payments AS (
    SELECT id
    FROM payments
    WHERE status IN ('creating', 'pending')
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    ORDER BY expires_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  expired_payments AS (
    UPDATE payments p
    SET
      status = 'expired'
    FROM target_payments tp
    WHERE p.id = tp.id
    RETURNING p.id, p.discount_id
  ),
  discount_release AS (
    UPDATE discounts d
    SET
      reserved_count = GREATEST(d.reserved_count - x.release_count, 0)
    FROM (
      SELECT
        discount_id,
        COUNT(*)::INTEGER AS release_count
      FROM expired_payments
      WHERE discount_id IS NOT NULL
      GROUP BY discount_id
    ) x
    WHERE d.id = x.discount_id
    RETURNING d.id
  )
  SELECT COUNT(*)::INTEGER
  INTO v_expired_count
  FROM expired_payments;

  RETURN v_expired_count;
END;
$$;


ALTER FUNCTION "public"."expire_stale_payments"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name, avatar_url, username, dob, gender)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'phone', 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username',
    (new.raw_user_meta_data->>'dob')::date, 
    new.raw_user_meta_data->>'gender'
  );
  return new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_payment_success"("p_gateway" "text", "p_gateway_order_id" "text", "p_gateway_transaction_id" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_payment_id     payments.id%TYPE;
  v_current_status payments.status%TYPE;
  v_user_id        payments.user_id%TYPE;
  v_course_id      payments.course_id%TYPE;
  v_discount_id    payments.discount_id%TYPE;
  v_metadata       payments.gateway_metadata%TYPE;
BEGIN
  /*
    1. LOCK & LOOKUP PAYMENT

    Lock dòng payment theo gateway + gateway_order_id để chống duplicate webhook /
    concurrent webhook cùng xử lý một đơn.
  */
  SELECT
    p.id,
    p.status,
    p.user_id,
    p.course_id,
    p.discount_id,
    p.gateway_metadata
  INTO
    v_payment_id,
    v_current_status,
    v_user_id,
    v_course_id,
    v_discount_id,
    v_metadata
  FROM payments p
  WHERE p.gateway = p_gateway
    AND p.gateway_order_id = p_gateway_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'PAYMENT_NOT_FOUND';
  END IF;

  /*
    2. IDEMPOTENCY GUARD

    Nếu webhook PayOS bắn lại sau khi payment đã paid,
    tuyệt đối không update discount/enrollment lần nữa.
  */
  IF v_current_status = 'paid' THEN
    RETURN 'IDEMPOTENT_SUCCESS';
  END IF;

  /*
    3. STATUS GUARD

    Chỉ xử lý đơn còn trong luồng thanh toán.
    Các trạng thái cancelled / expired / failed không được chuyển ngược thành paid.
  */
  IF v_current_status NOT IN ('creating', 'pending') THEN
    RETURN 'INVALID_STATUS';
  END IF;

  /*
    4. MERGE GATEWAY METADATA
  */
  v_metadata =
    COALESCE(v_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'gateway_transaction_id',
      p_gateway_transaction_id
    );

  /*
    5. UPDATE PAYMENT -> PAID
  */
  UPDATE payments
  SET
    status = 'paid',
    gateway_metadata = v_metadata,
    updated_at = NOW()
  WHERE id = v_payment_id;

  /*
    6. CONSUME DISCOUNT RESERVATION

    Nếu payment có dùng discount:
    - reserved_count giảm 1 vì slot giữ chỗ đã kết thúc.
    - uses_count tăng 1 vì mã đã được dùng thành công.

    Dùng GREATEST để tránh reserved_count âm trong trường hợp data legacy
    hoặc payment cũ chưa từng reserve.
  */
  IF v_discount_id IS NOT NULL THEN
    UPDATE discounts
    SET
      reserved_count = GREATEST(reserved_count - 1, 0),
      uses_count = uses_count + 1,
      updated_at = NOW()
    WHERE id = v_discount_id;
  END IF;

  /*
    7. GRANT ENROLLMENT
  */
  INSERT INTO enrollments (
    user_id,
    course_id,
    enrolled_at
  )
  VALUES (
    v_user_id,
    v_course_id,
    NOW()
  )
  ON CONFLICT (user_id, course_id) DO NOTHING;

  RETURN 'SUCCESS';
END;
$$;


ALTER FUNCTION "public"."handle_payment_success"("p_gateway" "text", "p_gateway_order_id" "text", "p_gateway_transaction_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_course_content_read_access"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_role text;
  v_status text;
  v_removed_at timestamp with time zone;
BEGIN
  SELECT status, removed_at INTO v_status, v_removed_at
  FROM public.courses
  WHERE id = target_course_id;

  -- Khóa học cha bị xóa mềm -> Đóng băng toàn bộ tài nguyên con trực thuộc
  IF v_removed_at IS NOT NULL THEN
    IF auth.uid() IS NULL THEN RETURN false; END IF;
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    RETURN (v_user_role = 'admin');
  END IF;

  -- Xem tài nguyên bài học/đề thi bắt buộc phải có tài khoản đăng nhập
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Đặc quyền kiểm thử: Admin, Giáo viên quản trị, và Previewer được xem trước không cần mua/enroll
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role = 'admin' THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_collaborators cc
    WHERE cc.course_id = target_course_id 
      AND cc.user_id = auth.uid()
      AND cc.role IN ('owner', 'co_owner', 'editor', 'previewer')
  ) THEN
    RETURN true;
  END IF;

  -- Đối với học viên thông thường: Khóa học bắt buộc phải PUBLISHED mới được kiểm tra phân quyền truy cập
  IF v_status != 'published' THEN
    RETURN false;
  END IF;

  -- CHỐT CHẶN KHÓA CỔNG: Phải tồn tại một bản ghi hợp lệ trong bảng enrollments
  RETURN EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = target_course_id AND e.user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."has_course_content_read_access"("target_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_course_management_access"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_role text;
  v_has_access boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  
  -- Quyền tối cao hệ thống
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Phân loại nghiệp vụ: Chỉ có tài khoản giáo viên mới được kiểm tra tiếp
  IF v_user_role != 'teacher' THEN
    RETURN false;
  END IF;

  -- Quét kiểm tra quyền hạn nội bộ (Loại bỏ hoàn toàn vai trò 'previewer' khỏi luồng ghi dữ liệu)
  SELECT EXISTS (
    SELECT 1 
    FROM public.course_collaborators cc
    WHERE cc.course_id = target_course_id 
      AND cc.user_id = auth.uid()
      AND cc.role IN ('owner', 'co_owner', 'editor')
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;


ALTER FUNCTION "public"."has_course_management_access"("target_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role = 'admin'::public.user_role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_course_owner_or_co_owner"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN 
    RETURN false; 
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.course_collaborators cc
    WHERE cc.course_id = target_course_id 
      AND cc.user_id = auth.uid() 
      AND cc.role IN ('owner', 'co_owner') -- Chuỗi chuẩn gạch dưới
  );
END;
$$;


ALTER FUNCTION "public"."is_course_owner_or_co_owner"("target_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_discount_usage"("p_discount_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_discount_id UUID;
BEGIN
  /*
    Atomic reserve discount slot.

    Chỉ reserve nếu:
    - discount tồn tại
    - chưa bị soft delete
    - còn lượt sử dụng:
      max_uses IS NULL OR uses_count + reserved_count < max_uses

    updated_at không cần set thủ công vì bảng discounts đã có trigger:
    set_updated_at_discounts -> handle_updated_at()
  */
  UPDATE discounts
  SET
    reserved_count = reserved_count + 1
  WHERE id = p_discount_id
    AND removed_at IS NULL
    AND (
      max_uses IS NULL
      OR uses_count + reserved_count < max_uses
    )
  RETURNING id INTO v_discount_id;

  IF v_discount_id IS NULL THEN
    RETURN 'DISCOUNT_USAGE_EXHAUSTED';
  END IF;

  RETURN 'SUCCESS';
END;
$$;


ALTER FUNCTION "public"."reserve_discount_usage"("p_discount_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "front_content" "jsonb" NOT NULL,
    "back_content" "jsonb" NOT NULL,
    "audio_url" "text",
    "image_url" "text",
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."course_member_role" DEFAULT 'previewer'::"public"."course_member_role" NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."course_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "price" numeric DEFAULT 0,
    "status" "public"."item_status" DEFAULT 'draft'::"public"."item_status",
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "type" "public"."discount_type" NOT NULL,
    "value" numeric NOT NULL,
    "max_discount_amount" numeric,
    "min_course_price" numeric DEFAULT 0,
    "max_uses" integer,
    "uses_count" integer DEFAULT 0,
    "start_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone,
    "course_id" "uuid" NOT NULL,
    "reserved_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "check_uses_limit" CHECK (("uses_count" <= "max_uses")),
    CONSTRAINT "discounts_max_discount_amount_check" CHECK (("max_discount_amount" >= (0)::numeric)),
    CONSTRAINT "discounts_max_uses_check" CHECK (("max_uses" > 0)),
    CONSTRAINT "discounts_min_course_price_check" CHECK (("min_course_price" >= (0)::numeric)),
    CONSTRAINT "discounts_reserved_count_check" CHECK (("reserved_count" >= 0)),
    CONSTRAINT "discounts_usage_not_exceed_max" CHECK ((("max_uses" IS NULL) OR (("uses_count" + "reserved_count") <= "max_uses"))),
    CONSTRAINT "discounts_uses_count_check" CHECK (("uses_count" >= 0)),
    CONSTRAINT "discounts_value_check" CHECK (("value" > (0)::numeric))
);


ALTER TABLE "public"."discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "part_type" "text" NOT NULL,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone,
    "course_id" "uuid" NOT NULL
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "discount_id" "uuid",
    "amount_original" numeric NOT NULL,
    "amount_discount" numeric DEFAULT 0 NOT NULL,
    "amount_final" numeric NOT NULL,
    "currency" character varying(3) DEFAULT 'VND'::character varying NOT NULL,
    "status" "public"."payment_status" DEFAULT 'creating'::"public"."payment_status" NOT NULL,
    "gateway" "text" NOT NULL,
    "gateway_order_id" "text" NOT NULL,
    "gateway_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "payments_amount_discount_check" CHECK (("amount_discount" >= (0)::numeric)),
    CONSTRAINT "payments_amount_final_check" CHECK (("amount_final" >= (0)::numeric)),
    CONSTRAINT "payments_amount_original_check" CHECK (("amount_original" >= (0)::numeric))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."payos_order_code_seq"
    START WITH 100000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."payos_order_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "phone" "text",
    "full_name" "text",
    "avatar_url" "text",
    "role" "public"."user_role" DEFAULT 'student'::"public"."user_role",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone,
    "username" "text",
    "dob" "date",
    "gender" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "passage_text" "text",
    "audio_url" "text",
    "image_url" "text",
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."question_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "label" "text",
    "is_correct" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."question_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "exercise_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "explanation" "text",
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone,
    "course_id" "uuid" NOT NULL,
    CONSTRAINT "chk_question_parent" CHECK ((("group_id" IS NOT NULL) OR ("exercise_id" IS NOT NULL))),
    CONSTRAINT "questions_parent_check" CHECK (("exercise_id" IS NOT NULL))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_profiles" (
    "id" "uuid" NOT NULL,
    "bio" "text",
    "experience_years" integer,
    "certifications" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."teacher_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."item_status" DEFAULT 'draft'::"public"."item_status",
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "removed_at" timestamp with time zone,
    "slug" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "chapter_id" "uuid",
    "course_id" "uuid" NOT NULL
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_flashcards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "ease_factor" numeric DEFAULT 2.5,
    "interval_days" integer DEFAULT 0,
    "next_review_date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "fsrs_meta" "jsonb"
);


ALTER TABLE "public"."user_flashcards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_question_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "selected_option_id" "uuid" NOT NULL,
    "is_correct" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_question_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_topic_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "is_flashcard_completed" boolean DEFAULT false,
    "is_exercise_completed" boolean DEFAULT false,
    "is_topic_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_topic_progress" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_collaborators"
    ADD CONSTRAINT "collaborators_user_course_unique" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."course_collaborators"
    ADD CONSTRAINT "course_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_course_unique" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."question_groups"
    ADD CONSTRAINT "question_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_options"
    ADD CONSTRAINT "question_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."course_collaborators"
    ADD CONSTRAINT "unique_course_user" UNIQUE ("course_id", "user_id");



ALTER TABLE ONLY "public"."user_flashcards"
    ADD CONSTRAINT "unique_user_card" UNIQUE ("user_id", "card_id");



ALTER TABLE ONLY "public"."user_flashcards"
    ADD CONSTRAINT "user_flashcards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_question_answers"
    ADD CONSTRAINT "user_question_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_question_answers"
    ADD CONSTRAINT "user_question_answers_user_id_question_id_key" UNIQUE ("user_id", "question_id");



ALTER TABLE ONLY "public"."user_topic_progress"
    ADD CONSTRAINT "user_topic_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_topic_progress"
    ADD CONSTRAINT "utp_user_topic_unique" UNIQUE ("user_id", "topic_id");



CREATE UNIQUE INDEX "discounts_code_active_idx" ON "public"."discounts" USING "btree" ("code") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_cards_active" ON "public"."cards" USING "btree" ("id") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_cards_topic_id" ON "public"."cards" USING "btree" ("topic_id");



CREATE INDEX "idx_chapters_active" ON "public"."chapters" USING "btree" ("id") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_courses_active" ON "public"."courses" USING "btree" ("id") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_enrollments_user_course" ON "public"."enrollments" USING "btree" ("user_id", "course_id");



CREATE INDEX "idx_exercises_course_active" ON "public"."exercises" USING "btree" ("course_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_exercises_topic_id" ON "public"."exercises" USING "btree" ("topic_id");



CREATE INDEX "idx_question_groups_exercise_id" ON "public"."question_groups" USING "btree" ("exercise_id");



CREATE INDEX "idx_question_options_question_id" ON "public"."question_options" USING "btree" ("question_id");



CREATE INDEX "idx_questions_course_active" ON "public"."questions" USING "btree" ("course_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_questions_exercise_id" ON "public"."questions" USING "btree" ("exercise_id");



CREATE INDEX "idx_questions_group_id" ON "public"."questions" USING "btree" ("group_id");



CREATE INDEX "idx_topics_active" ON "public"."topics" USING "btree" ("id") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_topics_chapter_id" ON "public"."topics" USING "btree" ("chapter_id");



CREATE INDEX "idx_topics_course_active" ON "public"."topics" USING "btree" ("course_id") WHERE ("removed_at" IS NULL);



CREATE INDEX "idx_user_flashcards_user_id" ON "public"."user_flashcards" USING "btree" ("user_id");



CREATE INDEX "payments_course_id_idx" ON "public"."payments" USING "btree" ("course_id");



CREATE UNIQUE INDEX "payments_gateway_order_idx" ON "public"."payments" USING "btree" ("gateway", "gateway_order_id");



CREATE INDEX "payments_user_id_idx" ON "public"."payments" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_active_payment" ON "public"."payments" USING "btree" ("user_id", "course_id") WHERE ("status" = ANY (ARRAY['creating'::"public"."payment_status", 'pending'::"public"."payment_status"]));



CREATE OR REPLACE TRIGGER "set_updated_at_cards" BEFORE UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_courses" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_discounts" BEFORE UPDATE ON "public"."discounts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_exercises" BEFORE UPDATE ON "public"."exercises" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_payments" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_question_groups" BEFORE UPDATE ON "public"."question_groups" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_question_options" BEFORE UPDATE ON "public"."question_options" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_questions" BEFORE UPDATE ON "public"."questions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_topics" BEFORE UPDATE ON "public"."topics" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_collaborators"
    ADD CONSTRAINT "collab_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_collaborators"
    ADD CONSTRAINT "collab_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_options"
    ADD CONSTRAINT "opt_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "q_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "q_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."question_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_groups"
    ADD CONSTRAINT "qg_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."user_flashcards"
    ADD CONSTRAINT "uf_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_flashcards"
    ADD CONSTRAINT "uf_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_question_answers"
    ADD CONSTRAINT "uqa_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id");



ALTER TABLE ONLY "public"."user_question_answers"
    ADD CONSTRAINT "uqa_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id");



ALTER TABLE ONLY "public"."user_question_answers"
    ADD CONSTRAINT "uqa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_topic_progress"
    ADD CONSTRAINT "utp_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id");



ALTER TABLE ONLY "public"."user_topic_progress"
    ADD CONSTRAINT "utp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Cards - Staff Insert" ON "public"."cards" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_modify_content_by_topic"("topic_id"));



CREATE POLICY "Cards - Staff Soft Delete" ON "public"."cards" FOR UPDATE TO "authenticated" USING ("public"."can_modify_content_by_topic"("topic_id")) WITH CHECK ("public"."can_modify_content_by_topic"("topic_id"));



CREATE POLICY "Cards - Staff Update" ON "public"."cards" FOR UPDATE TO "authenticated" USING ("public"."can_modify_content_by_topic"("topic_id")) WITH CHECK ("public"."can_modify_content_by_topic"("topic_id"));



CREATE POLICY "Chapters - Staff Insert" ON "public"."chapters" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Chapters - Staff Select Deleted" ON "public"."chapters" FOR SELECT TO "authenticated" USING ((("removed_at" IS NOT NULL) AND "public"."has_course_management_access"("course_id")));



CREATE POLICY "Chapters - Staff Soft Delete" ON "public"."chapters" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Chapters - Staff Update" ON "public"."chapters" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Collaborators - Staff Delete" ON "public"."course_collaborators" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id")));



CREATE POLICY "Collaborators - Staff Insert" ON "public"."course_collaborators" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id")));



CREATE POLICY "Collaborators - Staff Update" ON "public"."course_collaborators" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id"))) WITH CHECK (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id")));



CREATE POLICY "Courses - Staff Update Secured" ON "public"."courses" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("id"))) WITH CHECK (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("id")));



CREATE POLICY "Discounts - Staff Insert" ON "public"."discounts" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id")));



CREATE POLICY "Discounts - Staff Update" ON "public"."discounts" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id"))) WITH CHECK (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id")));



CREATE POLICY "Exercises - Staff Insert" ON "public"."exercises" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Exercises - Staff Select Deleted" ON "public"."exercises" FOR SELECT TO "authenticated" USING ((("removed_at" IS NOT NULL) AND "public"."has_course_management_access"("course_id")));



CREATE POLICY "Exercises - Staff Soft Delete" ON "public"."exercises" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Exercises - Staff Update" ON "public"."exercises" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Groups - Staff Insert" ON "public"."question_groups" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_modify_exercise_child"("exercise_id"));



CREATE POLICY "Groups - Staff Soft Delete" ON "public"."question_groups" FOR UPDATE TO "authenticated" USING ("public"."can_modify_exercise_child"("exercise_id")) WITH CHECK ("public"."can_modify_exercise_child"("exercise_id"));



CREATE POLICY "Groups - Staff Update" ON "public"."question_groups" FOR UPDATE TO "authenticated" USING ("public"."can_modify_exercise_child"("exercise_id")) WITH CHECK ("public"."can_modify_exercise_child"("exercise_id"));



CREATE POLICY "Insert courses v3" ON "public"."courses" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR ("public"."get_my_role"() = 'teacher'::"public"."user_role")));



CREATE POLICY "Options - Staff Insert" ON "public"."question_options" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_modify_question_option"("question_id"));



CREATE POLICY "Options - Staff Soft Delete" ON "public"."question_options" FOR UPDATE TO "authenticated" USING ("public"."can_modify_question_option"("question_id")) WITH CHECK ("public"."can_modify_question_option"("question_id"));



CREATE POLICY "Options - Staff Update" ON "public"."question_options" FOR UPDATE TO "authenticated" USING ("public"."can_modify_question_option"("question_id")) WITH CHECK ("public"."can_modify_question_option"("question_id"));



CREATE POLICY "Profiles - Owner Delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Profiles - Owner Update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Profiles - Public Active Select" ON "public"."profiles" FOR SELECT USING (("removed_at" IS NULL));



CREATE POLICY "Questions - Staff Insert" ON "public"."questions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Questions - Staff Select Deleted" ON "public"."questions" FOR SELECT TO "authenticated" USING ((("removed_at" IS NOT NULL) AND "public"."has_course_management_access"("course_id")));



CREATE POLICY "Questions - Staff Soft Delete" ON "public"."questions" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Questions - Staff Update" ON "public"."questions" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Restrict hard delete for discounts" ON "public"."discounts" FOR DELETE USING (false);



CREATE POLICY "Select cards credential bound" ON "public"."cards" FOR SELECT USING ((("removed_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."topics" "t"
  WHERE (("t"."id" = "cards"."topic_id") AND "public"."has_course_content_read_access"("t"."course_id"))))));



CREATE POLICY "Select chapters credential bound" ON "public"."chapters" FOR SELECT USING ((("removed_at" IS NULL) AND "public"."has_course_content_read_access"("course_id")));



CREATE POLICY "Select courses dynamic filter" ON "public"."courses" FOR SELECT USING ("public"."can_view_course_basic"("id"));



CREATE POLICY "Select discounts active" ON "public"."discounts" FOR SELECT USING (("removed_at" IS NULL));



CREATE POLICY "Select exercises credential bound" ON "public"."exercises" FOR SELECT USING ((("removed_at" IS NULL) AND "public"."has_course_content_read_access"("course_id")));



CREATE POLICY "Select question_groups credential bound" ON "public"."question_groups" FOR SELECT USING ((("removed_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."exercises" "e"
  WHERE (("e"."id" = "question_groups"."exercise_id") AND "public"."has_course_content_read_access"("e"."course_id"))))));



CREATE POLICY "Select question_options credential bound" ON "public"."question_options" FOR SELECT USING ((("removed_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."questions" "q"
  WHERE (("q"."id" = "question_options"."question_id") AND "public"."has_course_content_read_access"("q"."course_id"))))));



CREATE POLICY "Select questions credential bound" ON "public"."questions" FOR SELECT USING ((("removed_at" IS NULL) AND "public"."has_course_content_read_access"("course_id")));



CREATE POLICY "Select topics credential bound" ON "public"."topics" FOR SELECT USING ((("removed_at" IS NULL) AND "public"."has_course_content_read_access"("course_id")));



CREATE POLICY "Staff can view course payments" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."is_course_owner_or_co_owner"("course_id")));



CREATE POLICY "Topics - Staff Insert" ON "public"."topics" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Topics - Staff Select Deleted" ON "public"."topics" FOR SELECT TO "authenticated" USING ((("removed_at" IS NOT NULL) AND "public"."has_course_management_access"("course_id")));



CREATE POLICY "Topics - Staff Soft Delete" ON "public"."topics" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "Topics - Staff Update" ON "public"."topics" FOR UPDATE TO "authenticated" USING ("public"."has_course_management_access"("course_id")) WITH CHECK ("public"."has_course_management_access"("course_id"));



CREATE POLICY "User_answers - Auth Insert" ON "public"."user_question_answers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "User_answers - Auth Select" ON "public"."user_question_answers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User_answers - Auth Update" ON "public"."user_question_answers" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "User_flashcards - Auth Insert" ON "public"."user_flashcards" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "User_flashcards - Auth Select" ON "public"."user_flashcards" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User_flashcards - Auth Update" ON "public"."user_flashcards" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "User_progress - Auth Insert" ON "public"."user_topic_progress" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "User_progress - Auth Select" ON "public"."user_topic_progress" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User_progress - Auth Update" ON "public"."user_topic_progress" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own enrollments" ON "public"."enrollments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own payments" ON "public"."payments" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "View collaborators" ON "public"."course_collaborators" FOR SELECT TO "authenticated" USING ("public"."can_view_course_basic"("course_id"));



ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_flashcards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_question_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_topic_progress" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "public"."can_modify_content_by_topic"("target_topic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_modify_content_by_topic"("target_topic_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_modify_content_by_topic"("target_topic_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_modify_content_by_topic"("target_topic_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_modify_exercise_child"("target_exercise_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_modify_exercise_child"("target_exercise_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_modify_exercise_child"("target_exercise_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_modify_exercise_child"("target_exercise_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_modify_question_option"("target_question_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_modify_question_option"("target_question_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_modify_question_option"("target_question_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_modify_question_option"("target_question_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_modify_topic"("target_chapter_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_modify_topic"("target_chapter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_modify_topic"("target_chapter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_modify_topic"("target_chapter_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_course_basic"("target_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_course_basic"("target_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_course_basic"("target_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_course_basic"("target_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_stale_payments"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."expire_stale_payments"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_stale_payments"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_payment_success"("p_gateway" "text", "p_gateway_order_id" "text", "p_gateway_transaction_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_payment_success"("p_gateway" "text", "p_gateway_order_id" "text", "p_gateway_transaction_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_payment_success"("p_gateway" "text", "p_gateway_order_id" "text", "p_gateway_transaction_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_course_content_read_access"("target_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_course_content_read_access"("target_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_course_content_read_access"("target_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_course_content_read_access"("target_course_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_course_management_access"("target_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_course_management_access"("target_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_course_management_access"("target_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_course_management_access"("target_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_course_owner_or_co_owner"("target_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_course_owner_or_co_owner"("target_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_course_owner_or_co_owner"("target_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_course_owner_or_co_owner"("target_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_discount_usage"("p_discount_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_discount_usage"("p_discount_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_discount_usage"("p_discount_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";
























GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."chapters" TO "anon";
GRANT ALL ON TABLE "public"."chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."chapters" TO "service_role";



GRANT ALL ON TABLE "public"."course_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."course_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."course_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."discounts" TO "anon";
GRANT ALL ON TABLE "public"."discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."discounts" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payos_order_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payos_order_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payos_order_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."question_groups" TO "anon";
GRANT ALL ON TABLE "public"."question_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."question_groups" TO "service_role";



GRANT ALL ON TABLE "public"."question_options" TO "anon";
GRANT ALL ON TABLE "public"."question_options" TO "authenticated";
GRANT ALL ON TABLE "public"."question_options" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_profiles" TO "anon";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."topics" TO "anon";
GRANT ALL ON TABLE "public"."topics" TO "authenticated";
GRANT ALL ON TABLE "public"."topics" TO "service_role";



GRANT ALL ON TABLE "public"."user_flashcards" TO "anon";
GRANT ALL ON TABLE "public"."user_flashcards" TO "authenticated";
GRANT ALL ON TABLE "public"."user_flashcards" TO "service_role";



GRANT ALL ON TABLE "public"."user_question_answers" TO "anon";
GRANT ALL ON TABLE "public"."user_question_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_question_answers" TO "service_role";



GRANT ALL ON TABLE "public"."user_topic_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_topic_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_topic_progress" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow insert and select avatars for all users 1oj01fe_0"
  on "storage"."objects"
  as permissive
  for select
  to anon, authenticated
using ((bucket_id = 'avatars'::text));



  create policy "Allow insert and select avatars for all users 1oj01fe_1"
  on "storage"."objects"
  as permissive
  for insert
  to anon, authenticated
with check ((bucket_id = 'avatars'::text));



  create policy "Owner or Admin Delete Thumbnails"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'course_thumbnails'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))))));



  create policy "Public View Thumbnails"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'course_thumbnails'::text));



  create policy "Teacher and Admin Upload Thumbnails"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'course_thumbnails'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::public.user_role, 'admin'::public.user_role])))))));




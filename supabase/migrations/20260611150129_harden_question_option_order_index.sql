-- Harden question_options.order_index now that write paths maintain zero-based option order.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.question_options
    WHERE order_index < 0
  ) THEN
    RAISE EXCEPTION 'question_options.order_index contains negative values; resolve before hardening order_index';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.question_options
    WHERE order_index IS NOT NULL
      AND removed_at IS NULL
    GROUP BY question_id, order_index
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'question_options contains duplicate active non-null (question_id, order_index) pairs; resolve before hardening order_index';
  END IF;
END $$;

-- Deterministically backfill any legacy NULL values for all rows in affected questions.
WITH affected_questions AS (
  SELECT DISTINCT question_id
  FROM public.question_options
  WHERE order_index IS NULL
),
ranked_options AS (
  SELECT
    qo.id,
    row_number() OVER (
      PARTITION BY qo.question_id
      ORDER BY
        qo.order_index NULLS LAST,
        qo.label NULLS LAST,
        qo.created_at,
        qo.id
    ) - 1 AS new_order_index
  FROM public.question_options qo
  INNER JOIN affected_questions aq
    ON aq.question_id = qo.question_id
)
UPDATE public.question_options qo
SET order_index = ranked_options.new_order_index
FROM ranked_options
WHERE qo.id = ranked_options.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.question_options
    WHERE order_index IS NULL
  ) THEN
    RAISE EXCEPTION 'question_options.order_index still contains NULL values after backfill';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.question_options
    WHERE order_index < 0
  ) THEN
    RAISE EXCEPTION 'question_options.order_index contains negative values; resolve before hardening order_index';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.question_options
    WHERE removed_at IS NULL
    GROUP BY question_id, order_index
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'question_options contains duplicate active (question_id, order_index) pairs; resolve before creating unique index';
  END IF;
END $$;

ALTER TABLE public.question_options
ALTER COLUMN order_index SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.question_options'::regclass
      AND conname = 'question_options_order_index_nonnegative_check'
  ) THEN
    ALTER TABLE public.question_options
    ADD CONSTRAINT question_options_order_index_nonnegative_check
    CHECK (order_index >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS question_options_question_id_order_index_active_unique_idx
ON public.question_options (question_id, order_index)
WHERE removed_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n
      ON n.oid = c.relnamespace
    INNER JOIN pg_index i
      ON i.indexrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'question_options_question_id_order_index_idx'
      AND i.indrelid = 'public.question_options'::regclass
      AND NOT i.indisunique
  ) THEN
    EXECUTE 'DROP INDEX public.question_options_question_id_order_index_idx';
  END IF;
END $$;

-- Keep option reordering compatible with the unique active (question_id, order_index) contract.
CREATE OR REPLACE FUNCTION public.sync_question_with_options(
  p_question_id uuid,
  p_content text,
  p_explanation text,
  p_options jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question record;
  v_clean_content text;
  v_option jsonb;
  v_option_id uuid;
  v_option_content text;
  v_option_order integer := 0;
  v_option_order_offset integer := 0;
  v_clean_option_count integer := 0;
  v_correct_option_count integer := 0;
  v_payload_ids uuid[] := array[]::uuid[];
  v_label text;
  v_label_index integer;
  v_updated_option_id uuid;
  v_deleted_count integer := 0;
  v_updated_count integer := 0;
  v_inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT q.id, q.exercise_id, q.course_id, q.removed_at
  INTO v_question
  FROM public.questions q
  WHERE q.id = p_question_id
  FOR UPDATE;

  IF NOT found OR v_question.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND';
  END IF;

  IF NOT public.can_modify_question_option(p_question_id) THEN
    RAISE EXCEPTION 'QUESTION_EDIT_FORBIDDEN';
  END IF;

  v_clean_content := nullif(btrim(coalesce(p_content, '')), '');
  IF v_clean_content IS NULL THEN
    RAISE EXCEPTION 'QUESTION_CONTENT_REQUIRED';
  END IF;

  FOR v_option IN
    SELECT value
    FROM jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  LOOP
    v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
    CONTINUE WHEN v_option_content IS NULL;

    v_clean_option_count := v_clean_option_count + 1;
    IF coalesce((v_option->>'is_correct')::boolean, false) THEN
      v_correct_option_count := v_correct_option_count + 1;
    END IF;

    IF nullif(v_option->>'id', '') IS NOT NULL THEN
      v_option_id := (v_option->>'id')::uuid;

      IF v_option_id = ANY(v_payload_ids) THEN
        RAISE EXCEPTION 'OPTION_DUPLICATE';
      END IF;

      v_payload_ids := array_append(v_payload_ids, v_option_id);
    END IF;
  END LOOP;

  IF v_clean_option_count < 2 THEN
    RAISE EXCEPTION 'QUESTION_REQUIRES_TWO_OPTIONS';
  END IF;

  IF v_correct_option_count < 1 THEN
    RAISE EXCEPTION 'QUESTION_REQUIRES_CORRECT_OPTION';
  END IF;

  UPDATE public.questions
  SET
    content = v_clean_content,
    explanation = nullif(btrim(coalesce(p_explanation, '')), '')
  WHERE id = p_question_id;

  UPDATE public.question_options qo
  SET removed_at = now()
  WHERE qo.question_id = p_question_id
    AND qo.removed_at IS NULL
    AND NOT (qo.id = ANY(v_payload_ids));

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  SELECT coalesce(max(qo.order_index), 0) + v_clean_option_count + 1
  INTO v_option_order_offset
  FROM public.question_options qo
  WHERE qo.question_id = p_question_id
    AND qo.removed_at IS NULL
    AND qo.id = ANY(v_payload_ids);

  UPDATE public.question_options qo
  SET order_index = qo.order_index + v_option_order_offset
  WHERE qo.question_id = p_question_id
    AND qo.removed_at IS NULL
    AND qo.id = ANY(v_payload_ids);

  FOR v_option IN
    SELECT value
    FROM jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  LOOP
    v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
    CONTINUE WHEN v_option_content IS NULL;

    v_label := '';
    v_label_index := v_option_order;
    LOOP
      v_label := chr(65 + (v_label_index % 26)) || v_label;
      v_label_index := floor(v_label_index / 26)::integer - 1;
      EXIT WHEN v_label_index < 0;
    END LOOP;

    IF nullif(v_option->>'id', '') IS NOT NULL THEN
      v_option_id := (v_option->>'id')::uuid;

      UPDATE public.question_options
      SET
        content = v_option_content,
        is_correct = coalesce((v_option->>'is_correct')::boolean, false),
        label = v_label,
        order_index = v_option_order
      WHERE id = v_option_id
        AND question_id = p_question_id
        AND removed_at IS NULL
      RETURNING id INTO v_updated_option_id;

      IF v_updated_option_id IS NULL THEN
        RAISE EXCEPTION 'OPTION_NOT_FOUND';
      END IF;

      v_updated_count := v_updated_count + 1;
    ELSE
      INSERT INTO public.question_options (
        question_id,
        content,
        label,
        is_correct,
        order_index
      )
      VALUES (
        p_question_id,
        v_option_content,
        v_label,
        coalesce((v_option->>'is_correct')::boolean, false),
        v_option_order
      );

      v_inserted_count := v_inserted_count + 1;
    END IF;

    v_option_order := v_option_order + 1;
    v_updated_option_id := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'question_id', p_question_id,
    'deleted_options', v_deleted_count,
    'updated_options', v_updated_count,
    'inserted_options', v_inserted_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_question_with_options(uuid, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.sync_question_with_options(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_question_with_options(uuid, text, text, jsonb) TO service_role;

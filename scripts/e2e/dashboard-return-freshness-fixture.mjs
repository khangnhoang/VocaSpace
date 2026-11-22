import { randomUUID } from "node:crypto";
import {
  exerciseAuthoringFixtureFor,
  prepareExerciseAuthoringFixture,
} from "./exercise-authoring-fixture.mjs";
import {
  deleteCardsByIds,
  deleteCardsByTopicId,
  deleteExerciseTreeByIds,
} from "./support/cleanup-learning-content.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";
import { assertIsolatedRuntime } from "./support/worker-scope.mjs";

const flashcardWordPrefix = "E2E Return Freshness Flashcard";

export async function prepareDashboardReturnFreshnessFixture(scope, env = process.env) {
  assertIsolatedRuntime(env);
  const base = await prepareExerciseAuthoringFixture(scope, env);
  const supabase = createSupabaseAdmin(env);
  const word = `${flashcardWordPrefix} ${new Date().toISOString()} ${randomUUID()}`;

  await removeLearningContentFromFixtureTopic(supabase, scope);

  return {
    ...base,
    E2E_FLASHCARD_WORD: word,
    E2E_FLASHCARD_TRANSLATION: "return freshness fixture",
    E2E_TOPIC_TITLE: "Local Test Topic",
  };
}

export async function getActiveFixtureFlashcardCount(scope, env = process.env) {
  assertIsolatedRuntime(env);
  const supabase = createSupabaseAdmin(env);
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", exerciseAuthoringFixtureFor(scope).topicId)
    .is("removed_at", null);

  if (error) {
    throw new Error(`Cannot count active flashcards for dashboard freshness fixture: ${error.message}`);
  }

  return count ?? 0;
}

export async function cleanupDashboardReturnFreshnessFixture(scope, env = process.env) {
  assertIsolatedRuntime(env);
  const supabase = createSupabaseAdmin(env);
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, front_content")
    .eq("topic_id", exerciseAuthoringFixtureFor(scope).topicId);

  if (error) {
    throw new Error(`Cannot find dashboard freshness flashcards: ${error.message}`);
  }

  const cardIds =
    cards
      ?.filter((card) => card.front_content?.word?.startsWith(flashcardWordPrefix))
      .map((card) => card.id) ?? [];

  if (cardIds.length === 0) return;

  await deleteCardsByIds(supabase, cardIds, "Cannot clean dashboard freshness flashcards");
}

async function removeLearningContentFromFixtureTopic(supabase, scope) {
  // Topic này thuộc riêng worker nên xóa toàn bộ nội dung của nó không ảnh hưởng file đang chạy ở worker khác.
  const topicId = exerciseAuthoringFixtureFor(scope).topicId;

  // Fixture phải bắt đầu từ topic không có nội dung học tập để dashboard tự sinh lỗi thật từ database.
  await deleteCardsByTopicId(supabase, topicId, "Cannot clear fixture flashcards");

  const { data: exercises, error: exerciseFindError } = await supabase
    .from("exercises")
    .select("id")
    .eq("topic_id", topicId);

  if (exerciseFindError) {
    throw new Error(`Cannot find fixture exercises: ${exerciseFindError.message}`);
  }

  const exerciseIds = exercises?.map((exercise) => exercise.id) ?? [];
  await deleteExerciseTreeByIds(supabase, exerciseIds, "fixture");
}

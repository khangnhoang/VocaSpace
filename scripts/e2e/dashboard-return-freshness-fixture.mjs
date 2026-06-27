import { randomUUID } from "node:crypto";
import {
  exerciseAuthoringFixture,
  prepareExerciseAuthoringFixture,
} from "./exercise-authoring-fixture.mjs";
import {
  deleteCardsByIds,
  deleteCardsByTopicId,
  deleteExerciseTreeByIds,
} from "./support/cleanup-learning-content.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

const flashcardWordPrefix = "E2E Return Freshness Flashcard";

export async function prepareDashboardReturnFreshnessFixture(env = process.env) {
  const base = await prepareExerciseAuthoringFixture(env);
  const supabase = createSupabaseAdmin(env);
  const word = `${flashcardWordPrefix} ${new Date().toISOString()} ${randomUUID()}`;

  await removeLearningContentFromFixtureTopic(supabase);

  return {
    ...base,
    E2E_FLASHCARD_WORD: word,
    E2E_FLASHCARD_TRANSLATION: "return freshness fixture",
    E2E_TOPIC_TITLE: "Local Test Topic",
  };
}

export async function getActiveFixtureFlashcardCount(env = process.env) {
  const supabase = createSupabaseAdmin(env);
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", exerciseAuthoringFixture.topicId)
    .is("removed_at", null);

  if (error) {
    throw new Error(`Cannot count active flashcards for dashboard freshness fixture: ${error.message}`);
  }

  return count ?? 0;
}

export async function cleanupDashboardReturnFreshnessFixture(env = process.env) {
  const supabase = createSupabaseAdmin(env);
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, front_content")
    .eq("topic_id", exerciseAuthoringFixture.topicId);

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

async function removeLearningContentFromFixtureTopic(supabase) {
  const topicId = exerciseAuthoringFixture.topicId;

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

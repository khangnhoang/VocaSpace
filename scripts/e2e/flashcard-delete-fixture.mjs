import { randomUUID } from "node:crypto";
import {
  exerciseAuthoringFixture,
  prepareExerciseAuthoringFixture,
} from "./exercise-authoring-fixture.mjs";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";

export async function prepareFlashcardDeleteFixture(env = process.env) {
  const base = await prepareExerciseAuthoringFixture(env);
  const supabase = createSupabaseAdmin(env);
  const word = `E2E Delete Flashcard ${new Date().toISOString()} ${randomUUID()}`;

  await cleanupOldFlashcards(supabase);

  const { data, error } = await supabase
    .from("cards")
    .insert({
      topic_id: exerciseAuthoringFixture.topicId,
      front_content: { word, pos: "n", phonetic: "" },
      back_content: { translation: "disposable flashcard", explanation: "" },
      order_index: 1,
      removed_at: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Cannot create flashcard delete fixture: ${error?.message}`);
  }

  return {
    ...base,
    E2E_FLASHCARD_ID: data.id,
    E2E_FLASHCARD_WORD: word,
  };
}

export async function getFlashcardRemovedAt(cardId, env = process.env) {
  const supabase = createSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("cards")
    .select("id, removed_at")
    .eq("id", cardId)
    .single();

  if (error || !data) {
    throw new Error(`Cannot read flashcard delete fixture: ${error?.message}`);
  }

  return data.removed_at;
}

export async function cleanupFlashcardDeleteFixtures(env = process.env) {
  const supabase = createSupabaseAdmin(env);
  await cleanupOldFlashcards(supabase);
}

async function cleanupOldFlashcards(supabase) {
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, front_content")
    .eq("topic_id", exerciseAuthoringFixture.topicId);

  if (error) throw new Error(`Cannot find old flashcard delete fixtures: ${error.message}`);

  const cardIds =
    cards
      ?.filter((card) => card.front_content?.word?.startsWith("E2E Delete Flashcard"))
      .map((card) => card.id) ?? [];
  if (cardIds.length === 0) return;

  const { error: deleteError } = await supabase.from("cards").delete().in("id", cardIds);
  if (deleteError) {
    throw new Error(`Cannot delete old flashcard delete fixtures: ${deleteError.message}`);
  }
}

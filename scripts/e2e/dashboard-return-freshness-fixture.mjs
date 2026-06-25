import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  exerciseAuthoringFixture,
  prepareExerciseAuthoringFixture,
} from "./exercise-authoring-fixture.mjs";

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

  const { error: deleteError } = await supabase.from("cards").delete().in("id", cardIds);
  if (deleteError) {
    throw new Error(`Cannot clean dashboard freshness flashcards: ${deleteError.message}`);
  }
}

function createSupabaseAdmin(env) {
  return createClient(
    requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function removeLearningContentFromFixtureTopic(supabase) {
  const topicId = exerciseAuthoringFixture.topicId;

  // Fixture phải bắt đầu từ topic không có nội dung học tập để dashboard tự sinh lỗi thật từ database.
  const { error: cardDeleteError } = await supabase
    .from("cards")
    .delete()
    .eq("topic_id", topicId);

  if (cardDeleteError) {
    throw new Error(`Cannot clear fixture flashcards: ${cardDeleteError.message}`);
  }

  const { data: exercises, error: exerciseFindError } = await supabase
    .from("exercises")
    .select("id")
    .eq("topic_id", topicId);

  if (exerciseFindError) {
    throw new Error(`Cannot find fixture exercises: ${exerciseFindError.message}`);
  }

  const exerciseIds = exercises?.map((exercise) => exercise.id) ?? [];
  if (exerciseIds.length === 0) return;

  const { data: questions, error: questionFindError } = await supabase
    .from("questions")
    .select("id")
    .in("exercise_id", exerciseIds);

  if (questionFindError) {
    throw new Error(`Cannot find fixture questions: ${questionFindError.message}`);
  }

  const questionIds = questions?.map((question) => question.id) ?? [];
  if (questionIds.length > 0) {
    const { error: optionDeleteError } = await supabase
      .from("question_options")
      .delete()
      .in("question_id", questionIds);

    if (optionDeleteError) {
      throw new Error(`Cannot clear fixture question options: ${optionDeleteError.message}`);
    }
  }

  const { error: questionDeleteError } = await supabase
    .from("questions")
    .delete()
    .in("exercise_id", exerciseIds);

  if (questionDeleteError) {
    throw new Error(`Cannot clear fixture questions: ${questionDeleteError.message}`);
  }

  const { error: groupDeleteError } = await supabase
    .from("question_groups")
    .delete()
    .in("exercise_id", exerciseIds);

  if (groupDeleteError) {
    throw new Error(`Cannot clear fixture question groups: ${groupDeleteError.message}`);
  }

  const { error: exerciseDeleteError } = await supabase
    .from("exercises")
    .delete()
    .in("id", exerciseIds);

  if (exerciseDeleteError) {
    throw new Error(`Cannot clear fixture exercises: ${exerciseDeleteError.message}`);
  }
}

function requiredEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

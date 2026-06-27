export async function deleteCardsByIds(supabase, cardIds, failureMessage) {
  if (cardIds.length === 0) return;

  const { error } = await supabase.from("cards").delete().in("id", cardIds);
  if (error) {
    throw new Error(`${failureMessage}: ${error.message}`);
  }
}

export async function deleteCardsByTopicId(supabase, topicId, failureMessage) {
  const { error } = await supabase.from("cards").delete().eq("topic_id", topicId);
  if (error) {
    throw new Error(`${failureMessage}: ${error.message}`);
  }
}

export async function deleteExerciseTreeByIds(supabase, exerciseIds, failureContext) {
  if (exerciseIds.length === 0) return;

  const { data: questions, error: questionFindError } = await supabase
    .from("questions")
    .select("id")
    .in("exercise_id", exerciseIds);

  if (questionFindError) {
    throw new Error(`Cannot find ${failureContext} questions: ${questionFindError.message}`);
  }

  const questionIds = questions?.map((question) => question.id) ?? [];
  if (questionIds.length > 0) {
    const { error: optionDeleteError } = await supabase
      .from("question_options")
      .delete()
      .in("question_id", questionIds);

    if (optionDeleteError) {
      throw new Error(`Cannot delete ${failureContext} question options: ${optionDeleteError.message}`);
    }
  }

  const { error: questionDeleteError } = await supabase
    .from("questions")
    .delete()
    .in("exercise_id", exerciseIds);

  if (questionDeleteError) {
    throw new Error(`Cannot delete ${failureContext} questions: ${questionDeleteError.message}`);
  }

  const { error: groupDeleteError } = await supabase
    .from("question_groups")
    .delete()
    .in("exercise_id", exerciseIds);

  if (groupDeleteError) {
    throw new Error(`Cannot delete ${failureContext} question groups: ${groupDeleteError.message}`);
  }

  const { error: exerciseDeleteError } = await supabase
    .from("exercises")
    .delete()
    .in("id", exerciseIds);

  if (exerciseDeleteError) {
    throw new Error(`Cannot delete ${failureContext} exercises: ${exerciseDeleteError.message}`);
  }
}

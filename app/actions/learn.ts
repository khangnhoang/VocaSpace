// app/actions/learn.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { ChapterSyllabus, Flashcard, Exercise } from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/type";
import { FlashcardSchema, ExerciseSchema } from "@/lib/schemas/learn";
import z from "zod";

// ==========================================
// 1. LẤY CẤU TRÚC CHƯƠNG VÀ BÀI HỌC CỦA KHÓA HỌC
// ==========================================
export async function getCourseSyllabus(courseSlug: string) {
  const supabase = await createClient();

  // 1. Tìm courseId từ slug
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title")
    .eq("slug", courseSlug)
    .is("removed_at", null)
    .single();

  if (courseError || !course) return { error: "Khóa học không tồn tại!" };

  // 2. Lấy toàn bộ Chapters và Topics bên trong
  // Sắp xếp theo order_index để đảm bảo đúng thứ tự học
  const { data: syllabus, error: syllabusError } = await supabase
    .from("chapters")
    .select(`
      id, title, order_index,
      topics (
        id, title, slug, status, order_index
      )
    `)
    .eq("course_id", course.id)
    .is("removed_at", null)
    .is("topics.removed_at", null)
    .eq("topics.status", "published") // Chỉ học viên mới thấy topic đã publish
    .order("order_index", { ascending: true });

  if (syllabusError) return { error: syllabusError.message };

  // Cần sắp xếp lại topics bên trong mỗi chapter (do Supabase không hỗ trợ order lồng nhau trực tiếp)
  const sortedSyllabus: ChapterSyllabus[] = (syllabus as unknown as ChapterSyllabus[]).map(chap => ({
    ...chap,
    topics: chap.topics.sort((a, b) => a.order_index - b.order_index)
  }));

  return { courseTitle: course.title, syllabus: sortedSyllabus };
}

// ==========================================
// 2. LẤY NỘI DUNG CỦA 1 BÀI HỌC (FLASHCARDS HOẶC EXERCISES)
// ==========================================
export async function getTopicContent(topicSlug: string) {
  const supabase = await createClient();

  // 1. Tìm Topic ID
  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id, title")
    .eq("slug", topicSlug)
    .single();

  if (topicError || !topic) return { error: "Bài học không tồn tại!" };

  // 2. Lấy Flashcards
  const { data: flashcards, error: cardsError } = await supabase
    .from("cards")
    .select("id, front_content, back_content, audio_url, image_url")
    .eq("topic_id", topic.id)
    .is("removed_at", null)
    .order("order_index", { ascending: true });

  if (cardsError) return { error: cardsError.message };

  // 3. Lấy Exercises (kèm groups, questions, options)
  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select(`
      id, title, part_type, order_index,
      groups:question_groups (
        id, passage_text, audio_url, image_url, order_index,
        questions (
          id, content, explanation, order_index,
          options:question_options (
            id, content, is_correct
          )
        )
      )
    `)
    .eq("topic_id", topic.id)
    .order("order_index", { ascending: true });

  if (exercisesError) return { error: exercisesError.message };

  // 2. Xác thực dữ liệu Flashcards bằng Zod
const validatedFlashcards = z.array(FlashcardSchema).safeParse(flashcards);

// 3. Xác thực dữ liệu Exercises bằng Zod
const validatedExercises = z.array(ExerciseSchema).safeParse(exercises);

// Kiểm tra kết quả xác thực
if (!validatedFlashcards.success) {
    console.error("Flashcard Schema Error:", validatedFlashcards.error.format());
    return { error: `Dữ liệu thẻ bài không hợp lệ: ${validatedFlashcards.error.issues[0].message}` };
}

if (!validatedExercises.success) {
    console.error("Exercise Schema Error:", validatedExercises.error.format());
    return { error: `Dữ liệu bài tập không hợp lệ: ${validatedExercises.error.issues[0].message}` };
}

// Trả về dữ liệu đã được xác thực (Dữ liệu lúc này đã chuẩn Type)
return { 
  topicTitle: topic?.title, 
  flashcards: validatedFlashcards.data, 
  exercises: validatedExercises.data
  };
}
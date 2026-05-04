// app/(client)/learn/[course-slug]/[topic-slug]/_components/type.ts

export interface Flashcard {
  id: string;
  front_content: {
    word: string;
    pos?: string;
    phonetic?: string;
  };
  back_content: {
    translation: string;
    example_en?: string;
    example_vi?: string;
    mnemonics?: string;
  };
  audio_url?: string;
  image_url?: string;
}

export interface QuestionOption {
  id: string;
  content: string;
  is_correct: boolean;
}

export interface Question {
  id: string;
  content: string;
  explanation?: string;
  order_index: number;
  options: QuestionOption[];
}

export interface QuestionGroup {
  id: string;
  passage_text?: string;
  audio_url?: string;
  image_url?: string;
  order_index: number;
  questions: Question[];
}

export interface Exercise {
  id: string;
  title: string;
  part_type: string;
  order_index: number;
  groups: QuestionGroup[];
}

export interface TopicSyllabus {
  id: string;
  title: string;
  slug: string;
  status: string;
  order_index: number;
  chapterId?: string; // Dùng cho FlatLesson
}

export interface ChapterSyllabus {
  id: string;
  title: string;
  order_index: number;
  topics: TopicSyllabus[];
}
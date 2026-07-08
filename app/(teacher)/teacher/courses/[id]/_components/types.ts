// File: app/(teacher)/teacher/courses/[id]/_components/types.ts

export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export interface Topic {
  id: string;
  chapter_id: string;
  title: string;
  status: "draft" | "pending" | "published";
  order_index: number;
  created_at: string;
}

export type MoveDirection = "up" | "down";

export type ChapterMoveRequest = {
  chapterId: string;
  direction: MoveDirection;
};

export type TopicMoveRequest = {
  topicId: string;
  direction: MoveDirection;
};

export type OrderingPendingState =
  | null
  | {
      type: "chapter" | "topic";
      id: string;
      direction: MoveDirection;
    };

export interface Card {
  id: string;
  topic_id: string;
  front_content: {
    word: string;
    pos?: string;
    phonetic?: string;
  };
  back_content: {
    translation: string;
    explanation?: string;
    example?: string;
    exampleTranslation?: string;
    hint?: string;
  };
  order_index: number;
  created_at: string;
}

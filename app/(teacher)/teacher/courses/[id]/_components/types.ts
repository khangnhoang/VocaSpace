// File: app/(teacher)/teacher/courses/[id]/_components/types.ts

export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  canManage: boolean;
  /** Số bài học chưa xóa; không có khi không đọc được (UI bỏ qua, không hiển thị 0). */
  topicCount?: number;
}

export interface Topic {
  id: string;
  chapter_id: string;
  title: string;
  status: "draft" | "pending" | "published";
  order_index: number;
  created_at: string;
  canEditContent: boolean;
  canManageStructure: boolean;
  canDeleteTopic: boolean;
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

/**
 * Thả bài học tới vị trí bất kỳ: đặt ngay trước `beforeTopicId`, hoặc cuối chương khi là null.
 * Neo theo bài học (không theo chỉ số) và kèm thứ tự bài học client đã thấy lúc kéo, để server
 * từ chối khi danh sách đã đổi dưới chân (TOPIC_ORDER_STALE, A5).
 */
export type TopicDropRequest = {
  topicId: string;
  beforeTopicId: string | null;
  expectedTopicIds: string[];
};

export type OrderingPendingState =
  | null
  | {
      type: "chapter";
      id: string;
      direction: MoveDirection;
    }
  | {
      type: "topic";
      id: string;
      /** `drop` là thao tác kéo-thả: không có nút nào để hiện spinner. */
      direction: MoveDirection | "drop";
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

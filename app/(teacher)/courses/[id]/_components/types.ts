// File: app/(teacher)/courses/[id]/_components/types.ts

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

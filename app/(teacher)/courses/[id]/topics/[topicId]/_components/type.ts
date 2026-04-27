// Bổ sung vào cuối file types.ts

export interface ExerciseOption {
  id: string;
  content: string;
  is_correct: boolean;
}

export interface ExerciseQuestion {
  id: string;
  content: string;
  explanation?: string;
  options: ExerciseOption[];
}

export interface ExerciseGroup {
  id: string;
  passage_text?: string;
  audio_url?: string;
  image_url?: string;
  questions: ExerciseQuestion[];
}

export interface Exercise {
  id: string;
  title: string;
  part_type: string;
  order_index: number;
  groups: ExerciseGroup[]; // Mảng chứa tầng 2
}
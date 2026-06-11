export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cards: {
        Row: {
          audio_url: string | null
          back_content: Json
          created_at: string
          front_content: Json
          id: string
          image_url: string | null
          order_index: number | null
          removed_at: string | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          back_content: Json
          created_at?: string
          front_content: Json
          id?: string
          image_url?: string | null
          order_index?: number | null
          removed_at?: string | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          back_content?: Json
          created_at?: string
          front_content?: Json
          id?: string
          image_url?: string | null
          order_index?: number | null
          removed_at?: string | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_index: number | null
          removed_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_index?: number | null
          removed_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number | null
          removed_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_collaborators: {
        Row: {
          added_by: string | null
          course_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["course_member_role"]
          user_id: string
        }
        Insert: {
          added_by?: string | null
          course_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["course_member_role"]
          user_id: string
        }
        Update: {
          added_by?: string | null
          course_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["course_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number | null
          price: number | null
          reject_message: string | null
          removed_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: Database["public"]["Enums"]["item_status"] | null
          submitted_at: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          price?: number | null
          reject_message?: string | null
          removed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          status?: Database["public"]["Enums"]["item_status"] | null
          submitted_at?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          price?: number | null
          reject_message?: string | null
          removed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["item_status"] | null
          submitted_at?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          code: string
          course_id: string
          created_at: string
          expires_at: string | null
          id: string
          max_discount_amount: number | null
          max_uses: number | null
          min_course_price: number | null
          removed_at: string | null
          reserved_count: number
          start_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          uses_count: number | null
          value: number
        }
        Insert: {
          code: string
          course_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_discount_amount?: number | null
          max_uses?: number | null
          min_course_price?: number | null
          removed_at?: string | null
          reserved_count?: number
          start_at?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          uses_count?: number | null
          value: number
        }
        Update: {
          code?: string
          course_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_discount_amount?: number | null
          max_uses?: number | null
          min_course_price?: number | null
          removed_at?: string | null
          reserved_count?: number
          start_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          uses_count?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          course_id: string
          created_at: string
          id: string
          order_index: number | null
          part_type: string
          removed_at: string | null
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          order_index?: number | null
          part_type: string
          removed_at?: string | null
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number | null
          part_type?: string
          removed_at?: string | null
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_discount: number
          amount_final: number
          amount_original: number
          course_id: string
          created_at: string
          currency: string
          discount_id: string | null
          expires_at: string | null
          gateway: string
          gateway_metadata: Json
          gateway_order_id: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_discount?: number
          amount_final: number
          amount_original: number
          course_id: string
          created_at?: string
          currency?: string
          discount_id?: string | null
          expires_at?: string | null
          gateway: string
          gateway_metadata?: Json
          gateway_order_id: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_discount?: number
          amount_final?: number
          amount_original?: number
          course_id?: string
          created_at?: string
          currency?: string
          discount_id?: string | null
          expires_at?: string | null
          gateway?: string
          gateway_metadata?: Json
          gateway_order_id?: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dob: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          removed_at: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          phone?: string | null
          removed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          removed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      question_groups: {
        Row: {
          audio_url: string | null
          created_at: string
          exercise_id: string
          id: string
          image_url: string | null
          order_index: number | null
          passage_text: string | null
          removed_at: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          exercise_id: string
          id?: string
          image_url?: string | null
          order_index?: number | null
          passage_text?: string | null
          removed_at?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          exercise_id?: string
          id?: string
          image_url?: string | null
          order_index?: number | null
          passage_text?: string | null
          removed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qg_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          content: string
          created_at: string
          id: string
          is_correct: boolean | null
          label: string | null
          order_index: number
          question_id: string
          removed_at: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          label?: string | null
          order_index: number
          question_id: string
          removed_at?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          label?: string | null
          order_index?: number
          question_id?: string
          removed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opt_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          content: string
          course_id: string
          created_at: string
          exercise_id: string
          explanation: string | null
          group_id: string | null
          id: string
          order_index: number | null
          removed_at: string | null
          updated_at: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          exercise_id: string
          explanation?: string | null
          group_id?: string | null
          id?: string
          order_index?: number | null
          removed_at?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          exercise_id?: string
          explanation?: string | null
          group_id?: string | null
          id?: string
          order_index?: number | null
          removed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "q_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "q_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "question_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          bio: string | null
          certifications: string | null
          created_at: string
          experience_years: number | null
          id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          certifications?: string | null
          created_at?: string
          experience_years?: number | null
          id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          certifications?: string | null
          created_at?: string
          experience_years?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          chapter_id: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number | null
          removed_at: string | null
          slug: string
          status: Database["public"]["Enums"]["item_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          removed_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["item_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number | null
          removed_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["item_status"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flashcards: {
        Row: {
          card_id: string
          created_at: string
          ease_factor: number | null
          fsrs_meta: Json | null
          id: string
          interval_days: number | null
          next_review_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          ease_factor?: number | null
          fsrs_meta?: Json | null
          id?: string
          interval_days?: number | null
          next_review_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          ease_factor?: number | null
          fsrs_meta?: Json | null
          id?: string
          interval_days?: number | null
          next_review_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uf_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uf_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_question_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_option_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uqa_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uqa_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uqa_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_topic_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_exercise_completed: boolean | null
          is_flashcard_completed: boolean | null
          is_topic_completed: boolean | null
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_exercise_completed?: boolean | null
          is_flashcard_completed?: boolean | null
          is_topic_completed?: boolean | null
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_exercise_completed?: boolean | null
          is_flashcard_completed?: boolean | null
          is_topic_completed?: boolean | null
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utp_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_modify_content_by_topic: {
        Args: { target_topic_id: string }
        Returns: boolean
      }
      can_modify_exercise_child: {
        Args: { target_exercise_id: string }
        Returns: boolean
      }
      can_modify_question_option: {
        Args: { target_question_id: string }
        Returns: boolean
      }
      can_modify_topic: {
        Args: { target_chapter_id: string }
        Returns: boolean
      }
      can_view_course_basic: {
        Args: { target_course_id: string }
        Returns: boolean
      }
      create_exercise_with_content: {
        Args: { p_payload: Json; p_topic_id: string }
        Returns: Json
      }
      expire_stale_payments: { Args: { p_limit?: number }; Returns: number }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      handle_payment_success: {
        Args: {
          p_gateway: string
          p_gateway_order_id: string
          p_gateway_transaction_id?: string
        }
        Returns: string
      }
      has_course_content_read_access: {
        Args: { target_course_id: string }
        Returns: boolean
      }
      has_course_management_access: {
        Args: { target_course_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_course_owner_or_co_owner: {
        Args: { target_course_id: string }
        Returns: boolean
      }
      reserve_discount_usage: {
        Args: { p_discount_id: string }
        Returns: string
      }
      soft_delete_exercise_cascade: {
        Args: { p_exercise_id: string }
        Returns: Json
      }
      sync_question_with_options: {
        Args: {
          p_content: string
          p_explanation: string
          p_options: Json
          p_question_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      course_member_role: "previewer" | "editor" | "co_owner" | "owner"
      discount_type: "fixed" | "percentage"
      item_status: "draft" | "pending" | "published"
      payment_status:
        | "creating"
        | "pending"
        | "paid"
        | "failed"
        | "expired"
        | "cancelled"
      user_role: "admin" | "teacher" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      course_member_role: ["previewer", "editor", "co_owner", "owner"],
      discount_type: ["fixed", "percentage"],
      item_status: ["draft", "pending", "published"],
      payment_status: [
        "creating",
        "pending",
        "paid",
        "failed",
        "expired",
        "cancelled",
      ],
      user_role: ["admin", "teacher", "student"],
    },
  },
} as const

export type UserRole = Enums<"user_role">
export type ItemStatus = Enums<"item_status">
export type CourseMemberRole = Enums<"course_member_role">
export type DiscountType = Enums<"discount_type">
export type PaymentStatus = Enums<"payment_status">

export type Profile = Tables<"profiles">
export type TeacherProfile = Tables<"teacher_profiles">
export type Course = Tables<"courses">
export type CourseRow = Tables<"courses">
export type Chapter = Tables<"chapters">
export type Topic = Tables<"topics">
export type CourseCollaborator = Tables<"course_collaborators">
export type Card = Tables<"cards">
export type Enrollment = Tables<"enrollments">
export type Exercise = Tables<"exercises">
export type QuestionGroup = Tables<"question_groups">
export type Question = Tables<"questions">
export type QuestionOption = Tables<"question_options">
export type UserFlashcard = Tables<"user_flashcards">
export type UserTopicProgress = Tables<"user_topic_progress">
export type UserQuestionAnswer = Tables<"user_question_answers">
export type Discount = Tables<"discounts">
export type Payment = Tables<"payments">

export type CourseInsert = TablesInsert<"courses">
export type CourseUpdate = TablesUpdate<"courses">
export type ChapterInsert = TablesInsert<"chapters">
export type TopicInsert = TablesInsert<"topics">
export type CardInsert = TablesInsert<"cards">
export type ExerciseInsert = TablesInsert<"exercises">
export type QuestionInsert = TablesInsert<"questions">
export type EnrollmentInsert = TablesInsert<"enrollments">
export type DiscountInsert = TablesInsert<"discounts">
export type PaymentInsert = TablesInsert<"payments">

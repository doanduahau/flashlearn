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
      card_review_events: {
        Row: {
          flashcard_id: string
          id: string
          is_correct: boolean | null
          quiz_question_id: string | null
          quiz_session_id: string | null
          reviewed_at: string
          source: string
          user_id: string
        }
        Insert: {
          flashcard_id: string
          id?: string
          is_correct?: boolean | null
          quiz_question_id?: string | null
          quiz_session_id?: string | null
          reviewed_at: string
          source: string
          user_id: string
        }
        Update: {
          flashcard_id?: string
          id?: string
          is_correct?: boolean | null
          quiz_question_id?: string | null
          quiz_session_id?: string | null
          reviewed_at?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_review_events_quiz_question_id_fkey"
            columns: ["quiz_question_id"]
            isOneToOne: true
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_review_events_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_learning_records: {
        Row: {
          completed_quiz_count: number
          correct_answers: number
          first_completed_at: string
          last_completed_at: string
          local_date: string
          questions_answered: number
          timezone: string
          user_id: string
        }
        Insert: {
          completed_quiz_count?: number
          correct_answers?: number
          first_completed_at: string
          last_completed_at: string
          local_date: string
          questions_answered?: number
          timezone: string
          user_id: string
        }
        Update: {
          completed_quiz_count?: number
          correct_answers?: number
          first_completed_at?: string
          last_completed_at?: string
          local_date?: string
          questions_answered?: number
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          source_filename: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          source_filename?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          source_filename?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          front: string
          id: string
          position: number
          set_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          id?: string
          position?: number
          set_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          id?: string
          position?: number
          set_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_user_set_fk"
            columns: ["user_id", "set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          timezone: string
          timezone_changed_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string
          timezone_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
          timezone_changed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          answered_at: string | null
          choices: Json
          correct_answer: string
          correct_choice_index: number
          flashcard_id: string | null
          id: string
          is_correct: boolean | null
          position: number
          prompt: string
          selected_choice_index: number | null
          session_id: string
          source_flashcard_id: string | null
          user_id: string
        }
        Insert: {
          answered_at?: string | null
          choices: Json
          correct_answer: string
          correct_choice_index: number
          flashcard_id?: string | null
          id?: string
          is_correct?: boolean | null
          position: number
          prompt: string
          selected_choice_index?: number | null
          session_id: string
          source_flashcard_id?: string | null
          user_id: string
        }
        Update: {
          answered_at?: string | null
          choices?: Json
          correct_answer?: string
          correct_choice_index?: number
          flashcard_id?: string | null
          id?: string
          is_correct?: boolean | null
          position?: number
          prompt?: string
          selected_choice_index?: number | null
          session_id?: string
          source_flashcard_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          actual_question_count: number
          completed_at: string | null
          correct_answer_count: number
          id: string
          mode: string
          requested_question_count: number
          source_all: boolean
          source_collection_ids: string[]
          source_set_ids: string[]
          started_at: string
          user_id: string
        }
        Insert: {
          actual_question_count: number
          completed_at?: string | null
          correct_answer_count?: number
          id?: string
          mode: string
          requested_question_count: number
          source_all?: boolean
          source_collection_ids?: string[]
          source_set_ids?: string[]
          started_at?: string
          user_id: string
        }
        Update: {
          actual_question_count?: number
          completed_at?: string | null
          correct_answer_count?: number
          id?: string
          mode?: string
          requested_question_count?: number
          source_all?: boolean
          source_collection_ids?: string[]
          source_set_ids?: string[]
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      special_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          flashcard_id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          flashcard_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          flashcard_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_collection_items_collection_fk"
            columns: ["user_id", "collection_id"]
            isOneToOne: false
            referencedRelation: "special_collections"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "special_collection_items_flashcard_fk"
            columns: ["user_id", "flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      special_collections: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_flashcard: {
        Args: { p_back: string; p_front: string; p_set_id: string }
        Returns: {
          flashcard_id: string
          position: number
        }[]
      }
      create_quiz_session: {
        Args: {
          p_all: boolean
          p_collection_ids: string[]
          p_mode: string
          p_question_count: number
          p_set_ids: string[]
        }
        Returns: string
      }
      create_special_collection: {
        Args: { p_color?: string; p_icon?: string; p_name: string }
        Returns: string
      }
      get_learning_statistics: { Args: never; Returns: Json }
      import_flashcard_set: {
        Args: { p_cards: Json; p_name: string }
        Returns: {
          imported_count: number
          set_id: string
        }[]
      }
      move_flashcard_set: {
        Args: { p_direction: string; p_set_id: string }
        Returns: undefined
      }
      set_card_collections: {
        Args: { p_card_id: string; p_collection_ids: string[] }
        Returns: string
      }
      submit_quiz_answer: {
        Args: { p_question_id: string; p_selected_choice_index: number }
        Returns: {
          completed: boolean
          is_correct: boolean
          session_id: string
        }[]
      }
      update_profile: {
        Args: { p_display_name: string; p_timezone: string }
        Returns: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          timezone: string
          timezone_changed_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const


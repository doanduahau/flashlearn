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
      card_learning_schedule: {
        Row: {
          algorithm: string
          created_at: string
          difficulty: number
          due: string
          flashcard_id: string
          id: string
          implementation: string
          lapses: number
          last_processed_review_event_id: string
          last_processed_reviewed_at: string
          last_review: string
          learning_steps: number
          parameter_set: string
          processed_event_count: number
          projection_revision: number
          reps: number
          scheduled_days: number
          stability: number
          state: number
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm: string
          created_at?: string
          difficulty: number
          due: string
          flashcard_id: string
          id?: string
          implementation: string
          lapses?: number
          last_processed_review_event_id: string
          last_processed_reviewed_at: string
          last_review: string
          learning_steps?: number
          parameter_set: string
          processed_event_count: number
          projection_revision?: number
          reps?: number
          scheduled_days?: number
          stability: number
          state: number
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm?: string
          created_at?: string
          difficulty?: number
          due?: string
          flashcard_id?: string
          id?: string
          implementation?: string
          lapses?: number
          last_processed_review_event_id?: string
          last_processed_reviewed_at?: string
          last_review?: string
          learning_steps?: number
          parameter_set?: string
          processed_event_count?: number
          projection_revision?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_learning_schedule_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_review_events: {
        Row: {
          flashcard_id: string
          fsrs_rating: number | null
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
          fsrs_rating?: number | null
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
          fsrs_rating?: number | null
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
      catalog_cards: {
        Row: {
          back: string
          catalog_set_id: string
          created_at: string
          front: string
          id: string
          position: number
          updated_at: string
        }
        Insert: {
          back: string
          catalog_set_id: string
          created_at?: string
          front: string
          id?: string
          position: number
          updated_at?: string
        }
        Update: {
          back?: string
          catalog_set_id?: string
          created_at?: string
          front?: string
          id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_cards_catalog_set_id_fkey"
            columns: ["catalog_set_id"]
            isOneToOne: false
            referencedRelation: "catalog_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_sets: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_starter: boolean
          language_back: string
          language_front: string
          level: string | null
          published_at: string | null
          slug: string
          starter_order: number | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_starter?: boolean
          language_back: string
          language_front: string
          level?: string | null
          published_at?: string | null
          slug: string
          starter_order?: number | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_starter?: boolean
          language_back?: string
          language_front?: string
          level?: string | null
          published_at?: string | null
          slug?: string
          starter_order?: number | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_sets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
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
      entitlement_overrides: {
        Row: {
          boolean_value: boolean | null
          created_at: string
          created_by: string | null
          entitlement_key: string
          expires_at: string | null
          id: string
          integer_value: number | null
          reason: string
          text_value: string | null
          user_id: string
          value_type: string
        }
        Insert: {
          boolean_value?: boolean | null
          created_at?: string
          created_by?: string | null
          entitlement_key: string
          expires_at?: string | null
          id?: string
          integer_value?: number | null
          reason: string
          text_value?: string | null
          user_id: string
          value_type: string
        }
        Update: {
          boolean_value?: boolean | null
          created_at?: string
          created_by?: string | null
          entitlement_key?: string
          expires_at?: string | null
          id?: string
          integer_value?: number | null
          reason?: string
          text_value?: string | null
          user_id?: string
          value_type?: string
        }
        Relationships: []
      }
      flashcard_coverage: {
        Row: {
          appearance_count: number
          covered_at: string
          flashcard_id: string
          mode: string
          user_id: string
        }
        Insert: {
          appearance_count?: number
          covered_at?: string
          flashcard_id: string
          mode: string
          user_id: string
        }
        Update: {
          appearance_count?: number
          covered_at?: string
          flashcard_id?: string
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_coverage_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_import_commits: {
        Row: {
          ai_used: boolean
          created_at: string
          idempotency_key: string
          imported_count: number
          set_id: string
          source_bytes: number
          source_chars: number
          source_type: string
          user_id: string
        }
        Insert: {
          ai_used: boolean
          created_at?: string
          idempotency_key: string
          imported_count: number
          set_id: string
          source_bytes: number
          source_chars: number
          source_type: string
          user_id: string
        }
        Update: {
          ai_used?: boolean
          created_at?: string
          idempotency_key?: string
          imported_count?: number
          set_id?: string
          source_bytes?: number
          source_chars?: number
          source_type?: string
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
          share_classroom_enabled: boolean
          share_token: string | null
          sort_order: number
          source_catalog_set_id: string | null
          source_catalog_version: number | null
          source_filename: string | null
          source_share_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          share_classroom_enabled?: boolean
          share_token?: string | null
          sort_order?: number
          source_catalog_set_id?: string | null
          source_catalog_version?: number | null
          source_filename?: string | null
          source_share_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          share_classroom_enabled?: boolean
          share_token?: string | null
          sort_order?: number
          source_catalog_set_id?: string | null
          source_catalog_version?: number | null
          source_filename?: string | null
          source_share_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_sets_source_catalog_set_id_fkey"
            columns: ["source_catalog_set_id"]
            isOneToOne: false
            referencedRelation: "catalog_sets"
            referencedColumns: ["id"]
          },
        ]
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
      learning_coverage_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          did_reset: boolean
          id: string
          mode: string
          quiz_session_id: string | null
          scope_card_ids: string[]
          session_card_ids: string[]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          did_reset?: boolean
          id?: string
          mode: string
          quiz_session_id?: string | null
          scope_card_ids: string[]
          session_card_ids: string[]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          did_reset?: boolean
          id?: string
          mode?: string
          quiz_session_id?: string | null
          scope_card_ids?: string[]
          session_card_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_coverage_sessions_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: true
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_storage_floors: {
        Row: {
          captured_at: string
          cards: number
          collections: number
          regular_sets: number
          user_id: string
        }
        Insert: {
          captured_at?: string
          cards: number
          collections: number
          regular_sets: number
          user_id: string
        }
        Update: {
          captured_at?: string
          cards?: number
          collections?: number
          regular_sets?: number
          user_id?: string
        }
        Relationships: []
      }
      match_attempts: {
        Row: {
          completed_at: string | null
          correct_pair_count: number
          elapsed_ms: number
          id: string
          incorrect_attempt_count: number
          source_all: boolean
          source_collection_ids: string[]
          source_set_ids: string[]
          started_at: string
          total_pairs: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct_pair_count: number
          elapsed_ms: number
          id?: string
          incorrect_attempt_count: number
          source_all?: boolean
          source_collection_ids?: string[]
          source_set_ids?: string[]
          started_at?: string
          total_pairs: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct_pair_count?: number
          elapsed_ms?: number
          id?: string
          incorrect_attempt_count?: number
          source_all?: boolean
          source_collection_ids?: string[]
          source_set_ids?: string[]
          started_at?: string
          total_pairs?: number
          user_id?: string
        }
        Relationships: []
      }
      mode_answer_events: {
        Row: {
          answered_at: string
          flashcard_id: string
          id: string
          is_correct: boolean
          mode: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          flashcard_id: string
          id?: string
          is_correct: boolean
          mode: string
          user_id: string
        }
        Update: {
          answered_at?: string
          flashcard_id?: string
          id?: string
          is_correct?: boolean
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mode_answer_events_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          push_enabled: boolean
          review_enabled: boolean
          review_time: string
          streak_enabled: boolean
          streak_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          push_enabled?: boolean
          review_enabled?: boolean
          review_time?: string
          streak_enabled?: boolean
          streak_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          push_enabled?: boolean
          review_enabled?: boolean
          review_time?: string
          streak_enabled?: boolean
          streak_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          boolean_value: boolean | null
          created_at: string
          effective_version: number
          entitlement_key: string
          integer_value: number | null
          plan_id: string
          text_value: string | null
          updated_at: string
          value_type: string
        }
        Insert: {
          boolean_value?: boolean | null
          created_at?: string
          effective_version?: number
          entitlement_key: string
          integer_value?: number | null
          plan_id: string
          text_value?: string | null
          updated_at?: string
          value_type: string
        }
        Update: {
          boolean_value?: boolean | null
          created_at?: string
          effective_version?: number
          entitlement_key?: string
          integer_value?: number | null
          plan_id?: string
          text_value?: string | null
          updated_at?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      processing_job_outputs: {
        Row: {
          created_at: string
          expires_at: string
          job_id: string
          output_kind: string
          payload: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string
          job_id: string
          output_kind: string
          payload: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          job_id?: string
          output_kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "processing_job_outputs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_job_reservations: {
        Row: {
          created_at: string
          job_id: string
          purpose: string
          reservation_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          purpose: string
          reservation_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          purpose?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_job_reservations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_job_reservations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "quota_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          correlation_id: string
          created_at: string
          error_code: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          input_characters: number
          job_kind: string
          last_heartbeat_at: string
          output_items: number
          physical_call_limit: number
          physical_calls: number
          plan_id: string | null
          provider: string | null
          provider_input_tokens: number
          provider_output_tokens: number
          provider_request_id: string | null
          reservation_id: string | null
          source_type: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          correlation_id: string
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          input_characters?: number
          job_kind: string
          last_heartbeat_at?: string
          output_items?: number
          physical_call_limit?: number
          physical_calls?: number
          plan_id?: string | null
          provider?: string | null
          provider_input_tokens?: number
          provider_output_tokens?: number
          provider_request_id?: string | null
          reservation_id?: string | null
          source_type?: string | null
          started_at?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          correlation_id?: string
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          input_characters?: number
          job_kind?: string
          last_heartbeat_at?: string
          output_items?: number
          physical_call_limit?: number
          physical_calls?: number
          plan_id?: string | null
          provider?: string | null
          provider_input_tokens?: number
          provider_output_tokens?: number
          provider_request_id?: string | null
          reservation_id?: string | null
          source_type?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "quota_reservations"
            referencedColumns: ["id"]
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
      push_notifications_log: {
        Row: {
          id: string
          kind: string
          local_date: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          local_date: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          local_date?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
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
          origin: string
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
          origin?: string
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
          origin?: string
          requested_question_count?: number
          source_all?: boolean
          source_collection_ids?: string[]
          source_set_ids?: string[]
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quota_reservations: {
        Row: {
          actual_amount: number | null
          correlation_id: string
          created_at: string
          expires_at: string
          finalized_at: string | null
          id: string
          idempotency_key: string
          period_id: string | null
          refund_reason: string | null
          refunded_at: string | null
          requested_amount: number
          status: string
          updated_at: string
          usage_key: string
          user_id: string
        }
        Insert: {
          actual_amount?: number | null
          correlation_id: string
          created_at?: string
          expires_at: string
          finalized_at?: string | null
          id?: string
          idempotency_key: string
          period_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          requested_amount: number
          status: string
          updated_at?: string
          usage_key: string
          user_id: string
        }
        Update: {
          actual_amount?: number | null
          correlation_id?: string
          created_at?: string
          expires_at?: string
          finalized_at?: string | null
          id?: string
          idempotency_key?: string
          period_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          requested_amount?: number
          status?: string
          updated_at?: string
          usage_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quota_reservations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "usage_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      quota_runtime_settings: {
        Row: {
          singleton: boolean
          storage_enforcement_mode: string
          updated_at: string
        }
        Insert: {
          singleton?: boolean
          storage_enforcement_mode: string
          updated_at?: string
        }
        Update: {
          singleton?: boolean
          storage_enforcement_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      runner_personal_bests: {
        Row: {
          best_ms: number
          created_at: string
          difficulty: string
          question_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_ms: number
          created_at?: string
          difficulty: string
          question_count: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_ms?: number
          created_at?: string
          difficulty?: string
          question_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      runner_sessions: {
        Row: {
          coverage_session_id: string
          created_at: string
          difficulty: string
          id: string
          user_id: string
        }
        Insert: {
          coverage_session_id: string
          created_at?: string
          difficulty: string
          id?: string
          user_id: string
        }
        Update: {
          coverage_session_id?: string
          created_at?: string
          difficulty?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_sessions_user_coverage_fk"
            columns: ["user_id", "coverage_session_id"]
            isOneToOne: false
            referencedRelation: "learning_coverage_sessions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      shared_set_memberships: {
        Row: {
          clone_set_id: string
          id: string
          joined_at: string
          member_user_id: string
          set_id: string
        }
        Insert: {
          clone_set_id: string
          id?: string
          joined_at?: string
          member_user_id: string
          set_id: string
        }
        Update: {
          clone_set_id?: string
          id?: string
          joined_at?: string
          member_user_id?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_set_memberships_clone_set_id_fkey"
            columns: ["clone_set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_set_memberships_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
        ]
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
      starter_provisioning_states: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          installed_count: number
          last_attempt_at: string | null
          last_error_code: string | null
          onboarding_announced_at: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          installed_count?: number
          last_attempt_at?: string | null
          last_error_code?: string | null
          onboarding_announced_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          installed_count?: number
          last_attempt_at?: string | null
          last_error_code?: string | null
          onboarding_announced_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_quota_observations: {
        Row: {
          current_value: number
          enforcement_mode: string
          first_observed_at: string
          last_observed_at: string
          limit_value: number
          observed_hour: string
          occurrence_count: number
          operation: string
          resource_key: string
          user_id: string
        }
        Insert: {
          current_value: number
          enforcement_mode: string
          first_observed_at?: string
          last_observed_at?: string
          limit_value: number
          observed_hour: string
          occurrence_count?: number
          operation: string
          resource_key: string
          user_id: string
        }
        Update: {
          current_value?: number
          enforcement_mode?: string
          first_observed_at?: string
          last_observed_at?: string
          limit_value?: number
          observed_hour?: string
          occurrence_count?: number
          operation?: string
          resource_key?: string
          user_id?: string
        }
        Relationships: []
      }
      typing_ai_job_results: {
        Row: {
          correct: boolean
          created_at: string
          item_id: string
          job_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          item_id: string
          job_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          item_id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_ai_job_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_attempts: {
        Row: {
          completed_at: string | null
          correct_questions: number
          elapsed_ms: number
          id: string
          source_all: boolean
          source_collection_ids: string[]
          source_set_ids: string[]
          started_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct_questions: number
          elapsed_ms: number
          id?: string
          source_all?: boolean
          source_collection_ids?: string[]
          source_set_ids?: string[]
          started_at?: string
          total_questions: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct_questions?: number
          elapsed_ms?: number
          id?: string
          source_all?: boolean
          source_collection_ids?: string[]
          source_set_ids?: string[]
          started_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      usage_ledger: {
        Row: {
          amount: number
          created_at: string
          entry_type: string
          id: string
          idempotency_key: string
          period_id: string | null
          reservation_id: string | null
          usage_key: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entry_type: string
          id?: string
          idempotency_key: string
          period_id?: string | null
          reservation_id?: string | null
          usage_key: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_type?: string
          id?: string
          idempotency_key?: string
          period_id?: string | null
          reservation_id?: string | null
          usage_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_ledger_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "usage_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_ledger_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "quota_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_periods: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_kind: string
          period_start: string
          plan_id: string
          usage_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_kind: string
          period_start: string
          plan_id: string
          usage_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_kind?: string
          period_start?: string
          plan_id?: string
          usage_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_periods_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_catalog_installs: {
        Row: {
          catalog_set_id: string
          catalog_version: number
          created_at: string
          id: string
          idempotency_key: string
          installed_set_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_set_id: string
          catalog_version: number
          created_at?: string
          id?: string
          idempotency_key: string
          installed_set_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          catalog_set_id?: string
          catalog_version?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          installed_set_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_catalog_installs_catalog_set_id_fkey"
            columns: ["catalog_set_id"]
            isOneToOne: false
            referencedRelation: "catalog_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_catalog_installs_installed_set_id_fkey"
            columns: ["installed_set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_ends_at: string | null
          id: string
          plan_id: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          plan_id: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          plan_id?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
      add_flashcard_with_quota: {
        Args: { p_back: string; p_front: string; p_set_id: string }
        Returns: {
          flashcard_id: string
          position: number
        }[]
      }
      assert_storage_totals: { Args: { p_user_id: string }; Returns: undefined }
      begin_processing_job_phase: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: {
          concurrent_limit: number
          job_status: string
        }[]
      }
      claim_starter_onboarding_banner: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      clone_shared_set: {
        Args: { p_token: string; p_user_id: string }
        Returns: {
          already_exists: boolean
          new_set_id: string
        }[]
      }
      clone_shared_set_with_quota: {
        Args: { p_token: string; p_user_id: string }
        Returns: {
          already_exists: boolean
          new_set_id: string
        }[]
      }
      commit_flashcard_import: {
        Args: {
          p_ai_used: boolean
          p_cards: Json
          p_idempotency_key: string
          p_name: string
          p_source_bytes: number
          p_source_chars: number
          p_source_type: string
        }
        Returns: {
          already_exists: boolean
          imported_count: number
          set_id: string
        }[]
      }
      complete_learning_coverage_session: {
        Args: { p_session_id: string }
        Returns: {
          completed_at: string
          did_reset: boolean
        }[]
      }
      create_learning_coverage_session: {
        Args: {
          p_mode: string
          p_quiz_session_id?: string
          p_scope_card_ids: string[]
          p_session_card_ids: string[]
          p_user_id: string
        }
        Returns: string
      }
      create_owned_quiz_session_from_card_ids: {
        Args: { p_card_ids: string[]; p_user_id: string }
        Returns: string
      }
      create_owned_quiz_session_from_card_ids_new_cards: {
        Args: { p_card_ids: string[]; p_user_id: string }
        Returns: string
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
      create_quiz_session_from_card_ids: {
        Args: { p_card_ids: string[] }
        Returns: string
      }
      create_quiz_session_prioritized: {
        Args: {
          p_card_ids: string[]
          p_question_count: number
          p_scope_card_ids: string[]
          p_user_id: string
        }
        Returns: string
      }
      create_runner_session: {
        Args: {
          p_difficulty: string
          p_scope_card_ids: string[]
          p_session_card_ids: string[]
          p_user_id: string
        }
        Returns: string
      }
      create_set_share_token: {
        Args: { p_set_id: string; p_user_id: string }
        Returns: string
      }
      create_special_collection: {
        Args: { p_color?: string; p_icon?: string; p_name: string }
        Returns: string
      }
      create_special_collection_with_quota: {
        Args: { p_name: string }
        Returns: string
      }
      finalize_usage: {
        Args: { p_actual_amount: number; p_reservation_id: string }
        Returns: {
          actual_amount: number | null
          correlation_id: string
          created_at: string
          expires_at: string
          finalized_at: string | null
          id: string
          idempotency_key: string
          period_id: string | null
          refund_reason: string | null
          refunded_at: string | null
          requested_amount: number
          status: string
          updated_at: string
          usage_key: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "quota_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_processing_job: {
        Args: {
          p_error_code?: string
          p_job_id: string
          p_output_items?: number
          p_provider_input_tokens?: number
          p_provider_output_tokens?: number
          p_status: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_dashboard_counts: {
        Args: never
        Returns: {
          due_count: number
          untouched_count: number
        }[]
      }
      get_due_review_card_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_effective_entitlement: {
        Args: { p_entitlement_key: string; p_user_id: string }
        Returns: Json
      }
      get_effective_plan: { Args: { p_user_id: string }; Returns: string }
      get_learning_statistics: { Args: never; Returns: Json }
      get_my_storage_quota_status: {
        Args: never
        Returns: {
          enforcement_mode: string
          has_recent_warning: boolean
          last_warning_at: string
        }[]
      }
      get_quiz_scope_sets: {
        Args: {
          p_all: boolean
          p_collection_ids: string[]
          p_set_ids: string[]
        }
        Returns: {
          appearance_counts: Json
          total: number
          wrong_ids: string[]
        }[]
      }
      get_set_members_with_stats: {
        Args: { p_set_id: string; p_user_id: string }
        Returns: {
          accuracy: number
          avatar_url: string
          correct_questions: number
          display_name: string
          joined_at: string
          last_activity_at: string
          member_user_id: string
          rank: number
          total_questions: number
        }[]
      }
      get_shared_set_by_token: {
        Args: { p_token: string }
        Returns: {
          card_count: number
          created_at: string
          description: string
          name: string
          owner_display_name: string
          set_id: string
          share_classroom_enabled: boolean
        }[]
      }
      get_shared_set_cards: {
        Args: { p_token: string }
        Returns: {
          back: string
          card_id: string
          front: string
          position: number
        }[]
      }
      get_starter_backfill_batch: {
        Args: {
          p_after_created_at?: string
          p_after_user_id?: string
          p_limit?: number
        }
        Returns: {
          missing_starter_cards: number
          missing_starter_sets: number
          provisioning_status: string
          user_created_at: string
          user_id: string
        }[]
      }
      import_flashcard_set: {
        Args: { p_cards: Json; p_name: string }
        Returns: {
          imported_count: number
          set_id: string
        }[]
      }
      install_catalog_set: {
        Args: {
          p_catalog_set_id: string
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: {
          already_exists: boolean
          card_count: number
          catalog_version: number
          set_id: string
        }[]
      }
      install_catalog_set_for_user: {
        Args: {
          p_catalog_set_id: string
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: {
          already_exists: boolean
          card_count: number
          catalog_version: number
          set_id: string
        }[]
      }
      link_processing_job_reservation: {
        Args: {
          p_job_id: string
          p_purpose: string
          p_reservation_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      load_new_card_candidates: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          flashcard_id: string
          total: number
        }[]
      }
      load_runner_candidate_eligibility: {
        Args: { p_card_ids: string[] }
        Returns: {
          eligible: boolean
          flashcard_id: string
        }[]
      }
      load_runner_session_questions: {
        Args: { p_runner_session_id: string }
        Returns: {
          choices: Json
          correct_answer: string
          flashcard_id: string
          front: string
        }[]
      }
      move_flashcard_set: {
        Args: { p_direction: string; p_set_id: string }
        Returns: undefined
      }
      pause_processing_job: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: undefined
      }
      provision_starter_sets: {
        Args: { p_user_id: string }
        Returns: {
          attempts: number
          created_sets: number
          existing_sets: number
          missing_sets: number
          provisioning_status: string
        }[]
      }
      provision_starter_sets_with_quota: {
        Args: { p_user_id: string }
        Returns: {
          attempts: number
          created_sets: number
          existing_sets: number
          missing_sets: number
          provisioning_status: string
        }[]
      }
      reconcile_stale_processing_jobs: {
        Args: never
        Returns: {
          expired_without_provider: number
          requires_review: number
        }[]
      }
      record_daily_activity: {
        Args: {
          p_correct_answers: number
          p_mode: string
          p_questions_answered: number
          p_user_id: string
        }
        Returns: undefined
      }
      record_mode_answers: {
        Args: { p_answers: Json; p_mode: string; p_user_id: string }
        Returns: undefined
      }
      record_processing_job_call: {
        Args: {
          p_input_characters: number
          p_job_id: string
          p_user_id: string
        }
        Returns: number
      }
      record_processing_job_tokens: {
        Args: {
          p_job_id: string
          p_provider_input_tokens: number
          p_provider_output_tokens: number
          p_user_id: string
        }
        Returns: undefined
      }
      record_storage_quota_observation: {
        Args: {
          p_current_value: number
          p_limit_value: number
          p_mode: string
          p_operation: string
          p_resource_key: string
          p_user_id: string
        }
        Returns: undefined
      }
      refund_usage: {
        Args: { p_reason: string; p_reservation_id: string }
        Returns: {
          actual_amount: number | null
          correlation_id: string
          created_at: string
          expires_at: string
          finalized_at: string | null
          id: string
          idempotency_key: string
          period_id: string | null
          refund_reason: string | null
          refunded_at: string | null
          requested_amount: number
          status: string
          updated_at: string
          usage_key: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "quota_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_set_membership: {
        Args: {
          p_clone_set_id: string
          p_member_user_id: string
          p_token: string
        }
        Returns: string
      }
      reserve_usage: {
        Args: {
          p_correlation_id: string
          p_idempotency_key: string
          p_requested_amount: number
          p_usage_key: string
          p_user_id: string
        }
        Returns: {
          allowed: boolean
          remaining: number
          reservation_id: string
          reservation_status: string
        }[]
      }
      revoke_set_share_token: {
        Args: { p_set_id: string; p_user_id: string }
        Returns: undefined
      }
      save_match_attempt: {
        Args: {
          p_correct_pair_count: number
          p_elapsed_ms: number
          p_incorrect_attempt_count: number
          p_source_all: boolean
          p_source_collection_ids: string[]
          p_source_set_ids: string[]
          p_total_pairs: number
          p_user_id: string
        }
        Returns: string
      }
      save_typing_attempt: {
        Args: {
          p_correct_questions: number
          p_elapsed_ms: number
          p_source_all: boolean
          p_source_collection_ids: string[]
          p_source_set_ids: string[]
          p_total_questions: number
          p_user_id: string
        }
        Returns: string
      }
      set_card_collections: {
        Args: { p_card_id: string; p_collection_ids: string[] }
        Returns: string
      }
      set_set_classroom_enabled: {
        Args: { p_enabled: boolean; p_set_id: string; p_user_id: string }
        Returns: undefined
      }
      start_processing_job: {
        Args: {
          p_correlation_id: string
          p_idempotency_key: string
          p_job_kind: string
          p_source_type: string
          p_user_id: string
        }
        Returns: {
          job_id: string
          job_status: string
          physical_call_limit: number
          replayed: boolean
        }[]
      }
      storage_enforcement_mode: { Args: never; Returns: string }
      store_typing_ai_job_results: {
        Args: { p_job_id: string; p_results: Json; p_user_id: string }
        Returns: undefined
      }
      submit_quiz_answer: {
        Args: { p_question_id: string; p_selected_choice_index: number }
        Returns: {
          completed: boolean
          flashcard_id: string
          is_correct: boolean
          review_event_id: string
          session_id: string
        }[]
      }
      submit_runner_best_time: {
        Args: { p_elapsed_ms: number; p_runner_session_id: string }
        Returns: {
          is_new_best: boolean
          result_best_ms: number
          result_question_count: number
        }[]
      }
      update_flashcard_with_quota: {
        Args: {
          p_back: string
          p_card_id: string
          p_front: string
          p_set_id: string
        }
        Returns: string
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
      upsert_card_learning_schedule: {
        Args: {
          p_algorithm: string
          p_difficulty: number
          p_due: string
          p_expected_projection_revision: number
          p_flashcard_id: string
          p_implementation: string
          p_lapses: number
          p_last_processed_review_event_id: string
          p_last_processed_reviewed_at: string
          p_last_review: string
          p_learning_steps: number
          p_parameter_set: string
          p_processed_event_count: number
          p_reps: number
          p_scheduled_days: number
          p_stability: number
          p_state: number
          p_user_id: string
        }
        Returns: number
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


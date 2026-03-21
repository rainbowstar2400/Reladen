// apps/web/lib/supabase/types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      consult_answers: {
        Row: {
          decidedat: string | null
          deleted: boolean
          id: string
          selectedchoiceid: string | null
          updated_at: string
        }
        Insert: {
          decidedat?: string | null
          deleted?: boolean
          id: string
          selectedchoiceid?: string | null
          updated_at?: string
        }
        Update: {
          decidedat?: string | null
          deleted?: boolean
          id?: string
          selectedchoiceid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          deleted: boolean
          id: string
          kind: string
          owner_id: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          deleted?: boolean
          id?: string
          kind: string
          owner_id?: string | null
          payload: Json
          updated_at: string
        }
        Update: {
          deleted?: boolean
          id?: string
          kind?: string
          owner_id?: string | null
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      feelings: {
        Row: {
          deleted: boolean
          from_id: string
          id: string
          label: Database["public"]["Enums"]["feeling_label"]
          owner_id: string | null
          score: number
          to_id: string
          updated_at: string
        }
        Insert: {
          deleted?: boolean
          from_id: string
          id?: string
          label?: Database["public"]["Enums"]["feeling_label"]
          owner_id?: string | null
          score?: number
          to_id: string
          updated_at?: string
        }
        Update: {
          deleted?: boolean
          from_id?: string
          id?: string
          label?: Database["public"]["Enums"]["feeling_label"]
          owner_id?: string | null
          score?: number
          to_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      nicknames: {
        Row: {
          deleted: boolean
          from_id: string
          id: string
          nickname: string
          owner_id: string | null
          to_id: string
          updated_at: string
        }
        Insert: {
          deleted?: boolean
          from_id: string
          id?: string
          nickname: string
          owner_id?: string | null
          to_id: string
          updated_at?: string
        }
        Update: {
          deleted?: boolean
          from_id?: string
          id?: string
          nickname?: string
          owner_id?: string | null
          to_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          linked_event_id: string
          occurred_at: string
          owner_id: string | null
          participants: Json | null
          priority: number
          snippet: string | null
          status: string
          thread_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          id?: string
          linked_event_id: string
          occurred_at: string
          owner_id?: string | null
          participants?: Json | null
          priority?: number
          snippet?: string | null
          status?: string
          thread_id?: string | null
          type: string
          updated_at: string
        }
        Update: {
          id?: string
          linked_event_id?: string
          occurred_at?: string
          owner_id?: string | null
          participants?: Json | null
          priority?: number
          snippet?: string | null
          status?: string
          thread_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      offscreen_knowledge: {
        Row: {
          about: string
          deleted: boolean
          fact: string
          id: string
          learned_at: string
          learned_by: string
          owner_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          about: string
          deleted?: boolean
          fact: string
          id?: string
          learned_at?: string
          learned_by: string
          owner_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          about?: string
          deleted?: boolean
          fact?: string
          id?: string
          learned_at?: string
          learned_by?: string
          owner_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      presets: {
        Row: {
          category: Database["public"]["Enums"]["preset_category"]
          deleted: boolean
          description: string | null
          example: string | null
          id: string
          is_managed: boolean
          label: string
          owner_id: string | null
          speech_profile_data: Json | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["preset_category"]
          deleted?: boolean
          description?: string | null
          example?: string | null
          id?: string
          is_managed?: boolean
          label: string
          owner_id?: string | null
          speech_profile_data?: Json | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["preset_category"]
          deleted?: boolean
          description?: string | null
          example?: string | null
          id?: string
          is_managed?: boolean
          label?: string
          owner_id?: string | null
          speech_profile_data?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      recent_events: {
        Row: {
          character_id: string
          deleted: boolean
          fact: string
          generated_at: string
          id: string
          owner_id: string | null
          shared_with: Json
          updated_at: string
        }
        Insert: {
          character_id: string
          deleted?: boolean
          fact: string
          generated_at?: string
          id?: string
          owner_id?: string | null
          shared_with?: Json
          updated_at?: string
        }
        Update: {
          character_id?: string
          deleted?: boolean
          fact?: string
          generated_at?: string
          id?: string
          owner_id?: string | null
          shared_with?: Json
          updated_at?: string
        }
        Relationships: []
      }
      relations: {
        Row: {
          a_id: string
          b_id: string
          deleted: boolean
          id: string
          owner_id: string | null
          type: Database["public"]["Enums"]["relation_type"]
          updated_at: string
        }
        Insert: {
          a_id: string
          b_id: string
          deleted?: boolean
          id?: string
          owner_id?: string | null
          type?: Database["public"]["Enums"]["relation_type"]
          updated_at?: string
        }
        Update: {
          a_id?: string
          b_id?: string
          deleted?: boolean
          id?: string
          owner_id?: string | null
          type?: Database["public"]["Enums"]["relation_type"]
          updated_at?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          age: number | null
          birthday: string | null
          deleted: boolean
          first_person: string | null
          gender: string | null
          id: string
          interests: Json | null
          mbti: string | null
          name: string
          occupation: string | null
          owner_id: string | null
          sleep_profile: Json | null
          speech_preset: string | null
          traits: Json | null
          trust_to_player: number
          updated_at: string
        }
        Insert: {
          age?: number | null
          birthday?: string | null
          deleted?: boolean
          first_person?: string | null
          gender?: string | null
          id?: string
          interests?: Json | null
          mbti?: string | null
          name: string
          occupation?: string | null
          owner_id?: string | null
          sleep_profile?: Json | null
          speech_preset?: string | null
          traits?: Json | null
          trust_to_player?: number
          updated_at?: string
        }
        Update: {
          age?: number | null
          birthday?: string | null
          deleted?: boolean
          first_person?: string | null
          gender?: string | null
          id?: string
          interests?: Json | null
          mbti?: string | null
          name?: string
          occupation?: string | null
          owner_id?: string | null
          sleep_profile?: Json | null
          speech_preset?: string | null
          traits?: Json | null
          trust_to_player?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "residents_first_person_presets_id_fk"
            columns: ["first_person"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_occupation_presets_id_fk"
            columns: ["occupation"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_speech_preset_presets_id_fk"
            columns: ["speech_preset"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_snippets: {
        Row: {
          deleted: boolean
          id: string
          occurred_at: string
          owner_id: string | null
          participant_a: string
          participant_b: string
          source: string
          text: string
          updated_at: string
        }
        Insert: {
          deleted?: boolean
          id?: string
          occurred_at?: string
          owner_id?: string | null
          participant_a: string
          participant_b: string
          source?: string
          text: string
          updated_at?: string
        }
        Update: {
          deleted?: boolean
          id?: string
          occurred_at?: string
          owner_id?: string | null
          participant_a?: string
          participant_b?: string
          source?: string
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      topic_threads: {
        Row: {
          deleted: boolean
          id: string
          last_event_id: string | null
          owner_id: string | null
          participants: Json
          status: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          deleted?: boolean
          id?: string
          last_event_id?: string | null
          owner_id?: string | null
          participants: Json
          status?: string
          topic?: string | null
          updated_at: string
        }
        Update: {
          deleted?: boolean
          id?: string
          last_event_id?: string | null
          owner_id?: string | null
          participants?: Json
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      world_states: {
        Row: {
          deleted: boolean
          id: string
          owner_id: string | null
          updated_at: string
          weather_comment: Json | null
          weather_current: Json
          weather_quiet_hours: Json
        }
        Insert: {
          deleted?: boolean
          id?: string
          owner_id?: string | null
          updated_at?: string
          weather_comment?: Json | null
          weather_current: Json
          weather_quiet_hours: Json
        }
        Update: {
          deleted?: boolean
          id?: string
          owner_id?: string | null
          updated_at?: string
          weather_comment?: Json | null
          weather_current?: Json
          weather_quiet_hours?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      feeling_label:
        | "none"
        | "dislike"
        | "curious"
        | "maybe_like"
        | "like"
        | "love"
        | "awkward"
        | "maybe_dislike"
      hook_intent: "invite" | "share" | "complain" | "consult" | "reflect"
      preset_category: "speech" | "occupation" | "first_person"
      relation_type:
        | "none"
        | "friend"
        | "best_friend"
        | "lover"
        | "family"
        | "acquaintance"
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
  public: {
    Enums: {
      feeling_label: [
        "none",
        "dislike",
        "curious",
        "maybe_like",
        "like",
        "love",
        "awkward",
        "maybe_dislike",
      ],
      hook_intent: ["invite", "share", "complain", "consult", "reflect"],
      preset_category: ["speech", "occupation", "first_person"],
      relation_type: [
        "none",
        "friend",
        "best_friend",
        "lover",
        "family",
        "acquaintance",
      ],
    },
  },
} as const

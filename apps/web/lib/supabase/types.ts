// apps/web/lib/supabase/types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      beliefs: {
        Row: {
          deleted: boolean;
          id: string;
          person_knowledge: Json;
          resident_id: string;
          updated_at: string;
          world_facts: Json;
        };
        Insert: {
          deleted?: boolean;
          id?: string;
          person_knowledge?: Json;
          resident_id: string;
          updated_at: string;
          world_facts?: Json;
        };
        Update: {
          deleted?: boolean;
          id?: string;
          person_knowledge?: Json;
          resident_id?: string;
          updated_at?: string;
          world_facts?: Json;
        };
        Relationships: [];
      };
      consult_answers: {
        Row: {
          decided_at: string;
          deleted: boolean;
          id: string;
          owner_id: string | null;
          selected_choice_id: string | null;
          updated_at: string;
        };
        Insert: {
          decided_at: string;
          deleted?: boolean;
          id?: string;
          owner_id?: string | null;
          selected_choice_id?: string | null;
          updated_at: string;
        };
        Update: {
          decided_at?: string;
          deleted?: boolean;
          id?: string;
          owner_id?: string | null;
          selected_choice_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          deleted: boolean;
          id: string;
          kind: string;
          owner_id: string | null;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          deleted?: boolean;
          id?: string;
          kind: string;
          owner_id?: string | null;
          payload: Json;
          updated_at: string;
        };
        Update: {
          deleted?: boolean;
          id?: string;
          kind?: string;
          owner_id?: string | null;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      feelings: {
        Row: {
          deleted: boolean;
          from_id: string;
          id: string;
          label: Database['public']['Enums']['feeling_label'];
          owner_id: string | null;
          score: number;
          to_id: string;
          updated_at: string;
        };
        Insert: {
          deleted?: boolean;
          from_id: string;
          id?: string;
          label?: Database['public']['Enums']['feeling_label'];
          owner_id?: string | null;
          score?: number;
          to_id: string;
          updated_at?: string;
        };
        Update: {
          deleted?: boolean;
          from_id?: string;
          id?: string;
          label?: Database['public']['Enums']['feeling_label'];
          owner_id?: string | null;
          score?: number;
          to_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      nicknames: {
        Row: {
          deleted: boolean;
          from_id: string;
          id: string;
          nickname: string;
          owner_id: string | null;
          to_id: string;
          updated_at: string;
        };
        Insert: {
          deleted?: boolean;
          from_id: string;
          id?: string;
          nickname: string;
          owner_id?: string | null;
          to_id: string;
          updated_at?: string;
        };
        Update: {
          deleted?: boolean;
          from_id?: string;
          id?: string;
          nickname?: string;
          owner_id?: string | null;
          to_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          linked_event_id: string;
          occurred_at: string;
          participants: [string, string] | null;
          priority: number;
          snippet: string | null;
          status: 'unread' | 'read' | 'archived';
          thread_id: string | null;
          type: 'conversation' | 'consult' | 'system';
          updated_at: string;
        };
        Insert: {
          id?: string;
          linked_event_id: string;
          occurred_at: string;
          participants?: [string, string] | null;
          priority?: number;
          snippet?: string | null;
          status?: 'unread' | 'read' | 'archived';
          thread_id?: string | null;
          type: 'conversation' | 'consult' | 'system';
          updated_at: string;
        };
        Update: {
          id?: string;
          linked_event_id?: string;
          occurred_at?: string;
          participants?: [string, string] | null;
          priority?: number;
          snippet?: string | null;
          status?: 'unread' | 'read' | 'archived';
          thread_id?: string | null;
          type?: 'conversation' | 'consult' | 'system';
          updated_at?: string;
        };
        Relationships: [];
      };
      presets: {
        Row: {
          category: Database['public']['Enums']['preset_category'];
          deleted: boolean;
          description: string | null;
          id: string;
          is_managed: boolean;
          label: string;
          owner_id: string | null;
          updated_at: string;
        };
        Insert: {
          category: Database['public']['Enums']['preset_category'];
          deleted?: boolean;
          description?: string | null;
          id?: string;
          is_managed?: boolean;
          label: string;
          owner_id?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: Database['public']['Enums']['preset_category'];
          deleted?: boolean;
          description?: string | null;
          id?: string;
          is_managed?: boolean;
          label?: string;
          owner_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      relations: {
        Row: {
          a_id: string;
          b_id: string;
          deleted: boolean;
          id: string;
          owner_id: string | null;
          type: Database['public']['Enums']['relation_type'];
          updated_at: string;
        };
        Insert: {
          a_id: string;
          b_id: string;
          deleted?: boolean;
          id?: string;
          owner_id?: string | null;
          type?: Database['public']['Enums']['relation_type'];
          updated_at?: string;
        };
        Update: {
          a_id?: string;
          b_id?: string;
          deleted?: boolean;
          id?: string;
          owner_id?: string | null;
          type?: Database['public']['Enums']['relation_type'];
          updated_at?: string;
        };
        Relationships: [];
      };
      residents: {
        Row: {
          age: number | null;
          birthday: string | null;
          deleted: boolean;
          first_person: string | null;
          gender: string | null;
          id: string;
          interests: Json | null;
          mbti: string | null;
          name: string;
          occupation: string | null;
          owner_id: string | null;
          sleep_profile: Json | null;
          speech_preset: string | null;
          traits: Json | null;
          updated_at: string;
        };
        Insert: {
          age?: number | null;
          birthday?: string | null;
          deleted?: boolean;
          first_person?: string | null;
          gender?: string | null;
          id?: string;
          interests?: Json | null;
          mbti?: string | null;
          name: string;
          occupation?: string | null;
          owner_id?: string | null;
          sleep_profile?: Json | null;
          speech_preset?: string | null;
          traits?: Json | null;
          updated_at?: string;
        };
        Update: {
          age?: number | null;
          birthday?: string | null;
          deleted?: boolean;
          first_person?: string | null;
          gender?: string | null;
          id?: string;
          interests?: Json | null;
          mbti?: string | null;
          name?: string;
          occupation?: string | null;
          owner_id?: string | null;
          sleep_profile?: Json | null;
          speech_preset?: string | null;
          traits?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            columns: ['speech_preset'];
            foreignKeyName: 'residents_speech_preset_presets_id_fk';
            referencedColumns: ['id'];
            referencedRelation: 'presets';
          },
          {
            columns: ['occupation'];
            foreignKeyName: 'residents_occupation_presets_id_fk';
            referencedColumns: ['id'];
            referencedRelation: 'presets';
          },
          {
            columns: ['first_person'];
            foreignKeyName: 'residents_first_person_presets_id_fk';
            referencedColumns: ['id'];
            referencedRelation: 'presets';
          }
        ];
      };
      topic_threads: {
        Row: {
          deleted: boolean;
          id: string;
          last_event_id: string | null;
          owner_id: string | null;
          participants: [string, string];
          status: 'ongoing' | 'paused' | 'done';
          topic: string | null;
          updated_at: string;
        };
        Insert: {
          deleted?: boolean;
          id?: string;
          last_event_id?: string | null;
          owner_id?: string | null;
          participants: [string, string];
          status?: 'ongoing' | 'paused' | 'done';
          topic?: string | null;
          updated_at: string;
        };
        Update: {
          deleted?: boolean;
          id?: string;
          last_event_id?: string | null;
          owner_id?: string | null;
          participants?: [string, string];
          status?: 'ongoing' | 'paused' | 'done';
          topic?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      feeling_label:
        | 'none'
        | 'dislike'
        | 'curious'
        | 'maybe_like'
        | 'like'
        | 'love'
        | 'awkward';
      preset_category: 'speech' | 'occupation' | 'first_person';
      relation_type: 'none' | 'friend' | 'best_friend' | 'lover' | 'family';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

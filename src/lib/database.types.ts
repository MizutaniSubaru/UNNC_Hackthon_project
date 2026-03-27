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
      activity_logs: {
        Row: {
          action: string;
          created_at: string | null;
          details_json: Json;
          id: string;
          item_id: string | null;
          item_title: string;
          item_type: string;
          summary: string;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          details_json?: Json;
          id?: string;
          item_id?: string | null;
          item_title: string;
          item_type: string;
          summary: string;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          details_json?: Json;
          id?: string;
          item_id?: string | null;
          item_title?: string;
          item_type?: string;
          summary?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          accent: string;
          key: string;
          label_en: string;
          label_zh: string;
          order_index: number;
        };
        Insert: {
          accent: string;
          key: string;
          label_en: string;
          label_zh: string;
          order_index?: number;
        };
        Update: {
          accent?: string;
          key?: string;
          label_en?: string;
          label_zh?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      items: {
        Row: {
          created_at: string | null;
          due_date: string | null;
          end_at: string | null;
          estimated_minutes: number | null;
          group_key: string;
          id: string;
          is_all_day: boolean;
          location: string | null;
          needs_confirmation: boolean;
          notes: string | null;
          parse_confidence: number | null;
          priority: string;
          source_text: string | null;
          start_at: string | null;
          status: string;
          title: string;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          due_date?: string | null;
          end_at?: string | null;
          estimated_minutes?: number | null;
          group_key?: string;
          id?: string;
          is_all_day?: boolean;
          location?: string | null;
          needs_confirmation?: boolean;
          notes?: string | null;
          parse_confidence?: number | null;
          priority?: string;
          source_text?: string | null;
          start_at?: string | null;
          status?: string;
          title: string;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          due_date?: string | null;
          end_at?: string | null;
          estimated_minutes?: number | null;
          group_key?: string;
          id?: string;
          is_all_day?: boolean;
          location?: string | null;
          needs_confirmation?: boolean;
          notes?: string | null;
          parse_confidence?: number | null;
          priority?: string;
          source_text?: string | null;
          start_at?: string | null;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Database = {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: number | string;
          amount: number;
          category: string;
          description: string;
          created_at: string | null;
        };
        Insert: {
          id?: number | string;
          amount: number;
          category: string;
          description: string;
          created_at?: string | null;
        };
        Update: {
          id?: number | string;
          amount?: number;
          category?: string;
          description?: string;
          created_at?: string | null;
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

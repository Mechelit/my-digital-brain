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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          created_at: string
          iban: string | null
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          iban?: string | null
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          iban?: string | null
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          currency: string
          id: string
          name: string
          notes: string | null
          paid_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          counterparty?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          notes?: string | null
          paid_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          paid_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          ai_description: string | null
          amount: number | null
          bic: string | null
          category: string | null
          created_at: string
          currency: string | null
          due_date: string | null
          external_id: string | null
          free_reference: string | null
          iban: string | null
          id: string
          invoice_date: string | null
          notes: string | null
          paid_at: string | null
          paid_from_account: string | null
          raw_extraction: Json | null
          scan_path: string | null
          source: Database["public"]["Enums"]["invoice_source"]
          status: Database["public"]["Enums"]["invoice_status"]
          structured_reference: string | null
          supplier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_description?: string | null
          amount?: number | null
          bic?: string | null
          category?: string | null
          created_at?: string
          currency?: string | null
          due_date?: string | null
          external_id?: string | null
          free_reference?: string | null
          iban?: string | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_from_account?: string | null
          raw_extraction?: Json | null
          scan_path?: string | null
          source?: Database["public"]["Enums"]["invoice_source"]
          status?: Database["public"]["Enums"]["invoice_status"]
          structured_reference?: string | null
          supplier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_description?: string | null
          amount?: number | null
          bic?: string | null
          category?: string | null
          created_at?: string
          currency?: string | null
          due_date?: string | null
          external_id?: string | null
          free_reference?: string | null
          iban?: string | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_from_account?: string | null
          raw_extraction?: Json | null
          scan_path?: string | null
          source?: Database["public"]["Enums"]["invoice_source"]
          status?: Database["public"]["Enums"]["invoice_status"]
          structured_reference?: string | null
          supplier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_paid_from_account_fkey"
            columns: ["paid_from_account"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_scan_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invoice_id: string | null
          status: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invoice_id?: string | null
          status?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invoice_id?: string | null
          status?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_scan_sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          inbox_alias: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          inbox_alias?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          inbox_alias?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          currency: string
          day_of_month: number
          frequency: Database["public"]["Enums"]["expense_frequency"]
          id: string
          month_of_year: number | null
          name: string
          notes: string | null
          scope: Database["public"]["Enums"]["expense_scope"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          currency?: string
          day_of_month?: number
          frequency?: Database["public"]["Enums"]["expense_frequency"]
          id?: string
          month_of_year?: number | null
          name: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["expense_scope"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          currency?: string
          day_of_month?: number
          frequency?: Database["public"]["Enums"]["expense_frequency"]
          id?: string
          month_of_year?: number | null
          name?: string
          notes?: string | null
          scope?: Database["public"]["Enums"]["expense_scope"]
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
      [_ in never]: never
    }
    Enums: {
      expense_frequency: "monthly" | "quarterly" | "biannual" | "yearly"
      expense_scope: "prive" | "zakelijk"
      invoice_source: "scan" | "upload" | "email" | "mobile_scan"
      invoice_status: "pending" | "confirmed" | "paid" | "archived"
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
      expense_frequency: ["monthly", "quarterly", "biannual", "yearly"],
      expense_scope: ["prive", "zakelijk"],
      invoice_source: ["scan", "upload", "email", "mobile_scan"],
      invoice_status: ["pending", "confirmed", "paid", "archived"],
    },
  },
} as const

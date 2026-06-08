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
      battery_configs: {
        Row: {
          base_component_id: string | null
          bms_component_id: string | null
          id: string
          max_modules: number
          min_modules: number
          module_component_id: string
          name: string
          short: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_component_id?: string | null
          bms_component_id?: string | null
          id: string
          max_modules?: number
          min_modules?: number
          module_component_id: string
          name: string
          short: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_component_id?: string | null
          bms_component_id?: string | null
          id?: string
          max_modules?: number
          min_modules?: number
          module_component_id?: string
          name?: string
          short?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "battery_configs_base_component_id_fkey"
            columns: ["base_component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_configs_bms_component_id_fkey"
            columns: ["bms_component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_configs_module_component_id_fkey"
            columns: ["module_component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      components: {
        Row: {
          category: string
          id: string
          name: string
          side: string
          unit: string
          unit_kwh: number | null
          unit_price_ex_vat: number
          updated_at: string
        }
        Insert: {
          category: string
          id: string
          name: string
          side: string
          unit?: string
          unit_kwh?: number | null
          unit_price_ex_vat?: number
          updated_at?: string
        }
        Update: {
          category?: string
          id?: string
          name?: string
          side?: string
          unit?: string
          unit_kwh?: number | null
          unit_price_ex_vat?: number
          updated_at?: string
        }
        Relationships: []
      }
      price_settings: {
        Row: {
          default_panels: number
          default_wp_panel: number
          gta_ess_pct: number
          gta_pv_pct: number
          id: string
          margin_pct: number
          updated_at: string
          vat_pct: number
        }
        Insert: {
          default_panels?: number
          default_wp_panel?: number
          gta_ess_pct?: number
          gta_pv_pct?: number
          id: string
          margin_pct?: number
          updated_at?: string
          vat_pct?: number
        }
        Update: {
          default_panels?: number
          default_wp_panel?: number
          gta_ess_pct?: number
          gta_pv_pct?: number
          id?: string
          margin_pct?: number
          updated_at?: string
          vat_pct?: number
        }
        Relationships: []
      }
      system_component_lines: {
        Row: {
          component_id: string
          id: string
          qty_kind: string
          qty_value: number
          side: string
          sort_order: number
          system_id: string
          updated_at: string
        }
        Insert: {
          component_id: string
          id?: string
          qty_kind: string
          qty_value?: number
          side: string
          sort_order?: number
          system_id: string
          updated_at?: string
        }
        Update: {
          component_id?: string
          id?: string
          qty_kind?: string
          qty_value?: number
          side?: string
          sort_order?: number
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_component_lines_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_component_lines_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "system_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configs: {
        Row: {
          battery_config_id: string | null
          battery_module_id: string | null
          default_battery_modules: number
          ess_override_inc_vat: number | null
          id: string
          name: string
          pv_override_inc_vat: number | null
          short: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          battery_config_id?: string | null
          battery_module_id?: string | null
          default_battery_modules?: number
          ess_override_inc_vat?: number | null
          id: string
          name: string
          pv_override_inc_vat?: number | null
          short: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          battery_config_id?: string | null
          battery_module_id?: string | null
          default_battery_modules?: number
          ess_override_inc_vat?: number | null
          id?: string
          name?: string
          pv_override_inc_vat?: number | null
          short?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_configs_battery_config_id_fkey"
            columns: ["battery_config_id"]
            isOneToOne: false
            referencedRelation: "battery_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_configs_battery_module_id_fkey"
            columns: ["battery_module_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      system_prices: {
        Row: {
          ess_price: number
          id: string
          name: string
          pv_price: number
          updated_at: string
        }
        Insert: {
          ess_price?: number
          id: string
          name: string
          pv_price?: number
          updated_at?: string
        }
        Update: {
          ess_price?: number
          id?: string
          name?: string
          pv_price?: number
          updated_at?: string
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
  public: {
    Enums: {},
  },
} as const

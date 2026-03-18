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
      building_section_mappings: {
        Row: {
          building_identifier: string
          created_at: string | null
          description: string | null
          id: string
          project_id: string
          section_code: string
          updated_at: string | null
          zone_pattern: string | null
        }
        Insert: {
          building_identifier: string
          created_at?: string | null
          description?: string | null
          id?: string
          project_id: string
          section_code: string
          updated_at?: string | null
          zone_pattern?: string | null
        }
        Update: {
          building_identifier?: string
          created_at?: string | null
          description?: string | null
          id?: string
          project_id?: string
          section_code?: string
          updated_at?: string | null
          zone_pattern?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_section_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      category_item_type_overrides: {
        Row: {
          category_name: string
          created_at: string | null
          id: string
          item_type: string
          labor_code: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          category_name: string
          created_at?: string | null
          id?: string
          item_type: string
          labor_code: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          category_name?: string
          created_at?: string | null
          id?: string
          item_type?: string
          labor_code?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_item_type_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      category_labor_mappings: {
        Row: {
          category_name: string
          created_at: string | null
          id: string
          labor_code: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          category_name: string
          created_at?: string | null
          id?: string
          labor_code: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          category_name?: string
          created_at?: string | null
          id?: string
          labor_code?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_labor_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      category_material_desc_overrides: {
        Row: {
          category_name: string
          created_at: string | null
          id: string
          labor_code: string
          material_description: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          category_name: string
          created_at?: string | null
          id?: string
          labor_code: string
          material_description: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          category_name?: string
          created_at?: string | null
          id?: string
          labor_code?: string
          material_description?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_material_desc_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_codes: {
        Row: {
          category: string
          code: string
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          subcategory: string | null
          units: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          subcategory?: string | null
          units?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          subcategory?: string | null
          units?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estimate_items: {
        Row: {
          cost_code: string | null
          created_at: string | null
          drawing: string | null
          estimator: string | null
          excluded_from_material_budget: boolean | null
          floor: string | null
          hours: number | null
          id: string
          item_name: string | null
          item_type: string | null
          labor_dollars: number | null
          list_price: number | null
          material_cost_code: string | null
          material_desc: string | null
          material_dollars: number | null
          material_spec: string | null
          project_id: string
          quantity: number | null
          report_cat: string | null
          row_number: number
          size: string | null
          source_file: string | null
          symbol: string | null
          system: string | null
          trade: string | null
          updated_at: string | null
          weight: number | null
          zone: string | null
        }
        Insert: {
          cost_code?: string | null
          created_at?: string | null
          drawing?: string | null
          estimator?: string | null
          excluded_from_material_budget?: boolean | null
          floor?: string | null
          hours?: number | null
          id?: string
          item_name?: string | null
          item_type?: string | null
          labor_dollars?: number | null
          list_price?: number | null
          material_cost_code?: string | null
          material_desc?: string | null
          material_dollars?: number | null
          material_spec?: string | null
          project_id: string
          quantity?: number | null
          report_cat?: string | null
          row_number: number
          size?: string | null
          source_file?: string | null
          symbol?: string | null
          system?: string | null
          trade?: string | null
          updated_at?: string | null
          weight?: number | null
          zone?: string | null
        }
        Update: {
          cost_code?: string | null
          created_at?: string | null
          drawing?: string | null
          estimator?: string | null
          excluded_from_material_budget?: boolean | null
          floor?: string | null
          hours?: number | null
          id?: string
          item_name?: string | null
          item_type?: string | null
          labor_dollars?: number | null
          list_price?: number | null
          material_cost_code?: string | null
          material_desc?: string | null
          material_dollars?: number | null
          material_spec?: string | null
          project_id?: string
          quantity?: number | null
          report_cat?: string | null
          row_number?: number
          size?: string | null
          source_file?: string | null
          symbol?: string | null
          system?: string | null
          trade?: string | null
          updated_at?: string | null
          weight?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_projects: {
        Row: {
          created_at: string | null
          dataset_profile_override: string | null
          file_name: string | null
          id: string
          name: string
          source_files: string[] | null
          total_items: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dataset_profile_override?: string | null
          file_name?: string | null
          id?: string
          name: string
          source_files?: string[] | null
          total_items?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dataset_profile_override?: string | null
          file_name?: string | null
          id?: string
          name?: string
          source_files?: string[] | null
          total_items?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      floor_section_mappings: {
        Row: {
          activity_code: string
          created_at: string | null
          floor_pattern: string
          id: string
          project_id: string
          section_code: string
          updated_at: string | null
        }
        Insert: {
          activity_code?: string
          created_at?: string | null
          floor_pattern: string
          id?: string
          project_id: string
          section_code?: string
          updated_at?: string | null
        }
        Update: {
          activity_code?: string
          created_at?: string | null
          floor_pattern?: string
          id?: string
          project_id?: string
          section_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "floor_section_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          from_code: string | null
          id: string
          project_id: string
          system_name: string
          to_code: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_code?: string | null
          id?: string
          project_id: string
          system_name: string
          to_code: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_code?: string | null
          id?: string
          project_id?: string
          system_name?: string
          to_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapping_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mapping_patterns: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string | null
          id: string
          labor_code: string
          last_used_at: string
          system_name_pattern: string
          usage_count: number
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          labor_code: string
          last_used_at?: string
          system_name_pattern: string
          usage_count?: number
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          labor_code?: string
          last_used_at?: string
          system_name_pattern?: string
          usage_count?: number
        }
        Relationships: []
      }
      material_code_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          item_name_contains: string | null
          item_type_contains: string | null
          item_type_equals: string | null
          material_cost_code: string
          material_desc_contains: string | null
          material_spec_contains: string | null
          material_spec_equals: string | null
          name: string
          priority: number | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          item_name_contains?: string | null
          item_type_contains?: string | null
          item_type_equals?: string | null
          material_cost_code: string
          material_desc_contains?: string | null
          material_spec_contains?: string | null
          material_spec_equals?: string | null
          name: string
          priority?: number | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          item_name_contains?: string | null
          item_type_contains?: string | null
          item_type_equals?: string | null
          material_cost_code?: string
          material_desc_contains?: string | null
          material_spec_contains?: string | null
          material_spec_equals?: string | null
          name?: string
          priority?: number | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_code_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_desc_labor_patterns: {
        Row: {
          confidence_score: number | null
          id: string
          labor_code: string
          last_used_at: string
          material_description_pattern: string
          usage_count: number
        }
        Insert: {
          confidence_score?: number | null
          id?: string
          labor_code: string
          last_used_at?: string
          material_description_pattern: string
          usage_count?: number
        }
        Update: {
          confidence_score?: number | null
          id?: string
          labor_code?: string
          last_used_at?: string
          material_description_pattern?: string
          usage_count?: number
        }
        Relationships: []
      }
      material_mapping_patterns: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string | null
          id: string
          item_type_pattern: string
          last_used_at: string
          material_code: string
          material_spec_pattern: string
          usage_count: number
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_type_pattern: string
          last_used_at?: string
          material_code: string
          material_spec_pattern: string
          usage_count?: number
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_type_pattern?: string
          last_used_at?: string
          material_code?: string
          material_spec_pattern?: string
          usage_count?: number
        }
        Relationships: []
      }
      project_small_code_merges: {
        Row: {
          cost_head: string
          created_at: string
          id: string
          merged_act: string
          project_id: string
          reassign_to_head: string | null
          redistribute_adjustments: Json | null
          sec_code: string
        }
        Insert: {
          cost_head: string
          created_at?: string
          id?: string
          merged_act?: string
          project_id: string
          reassign_to_head?: string | null
          redistribute_adjustments?: Json | null
          sec_code?: string
        }
        Update: {
          cost_head?: string
          created_at?: string
          id?: string
          merged_act?: string
          project_id?: string
          reassign_to_head?: string | null
          redistribute_adjustments?: Json | null
          sec_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_small_code_merges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      system_activity_mappings: {
        Row: {
          activity_code: string
          cost_head_filter: string | null
          created_at: string
          description: string | null
          id: string
          project_id: string
          system_pattern: string
          updated_at: string
        }
        Insert: {
          activity_code?: string
          cost_head_filter?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          system_pattern: string
          updated_at?: string
        }
        Update: {
          activity_code?: string
          cost_head_filter?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          system_pattern?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_activity_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      system_mappings: {
        Row: {
          applied_at: string | null
          applied_item_count: number | null
          auto_suggested: string | null
          cost_head: string
          created_at: string | null
          id: string
          is_verified: boolean | null
          item_type: string | null
          project_id: string
          system_name: string
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_item_count?: number | null
          auto_suggested?: string | null
          cost_head: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          item_type?: string | null
          project_id: string
          system_name: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_item_count?: number | null
          auto_suggested?: string | null
          cost_head?: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          item_type?: string | null
          project_id?: string
          system_name?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "estimate_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

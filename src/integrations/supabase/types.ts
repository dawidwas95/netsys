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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_value_json: Json | null
          old_value_json: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value_json?: Json | null
          old_value_json?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value_json?: Json | null
          old_value_json?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_building: string | null
          address_city: string | null
          address_country: string | null
          address_local: string | null
          address_postal_code: string | null
          address_street: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          is_archived: boolean
          last_name: string | null
          nip: string | null
          notes: string | null
          phone: string | null
          regon: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address_building?: string | null
          address_city?: string | null
          address_country?: string | null
          address_local?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          last_name?: string | null
          nip?: string | null
          notes?: string | null
          phone?: string | null
          regon?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address_building?: string | null
          address_city?: string | null
          address_country?: string | null
          address_local?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          last_name?: string | null
          nip?: string | null
          notes?: string | null
          phone?: string | null
          regon?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          asset_tag: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          device_category: Database["public"]["Enums"]["device_category"]
          id: string
          imei: string | null
          ip_address: string | null
          is_archived: boolean
          mac_address: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          operating_system: string | null
          processor: string | null
          purchase_date: string | null
          ram_gb: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["device_status"]
          storage_size_gb: number | null
          storage_type: string | null
          updated_at: string
          updated_by: string | null
          warranty_until: string | null
        }
        Insert: {
          asset_tag?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          device_category?: Database["public"]["Enums"]["device_category"]
          id?: string
          imei?: string | null
          ip_address?: string | null
          is_archived?: boolean
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          operating_system?: string | null
          processor?: string | null
          purchase_date?: string | null
          ram_gb?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage_size_gb?: number | null
          storage_type?: string | null
          updated_at?: string
          updated_by?: string | null
          warranty_until?: string | null
        }
        Update: {
          asset_tag?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          device_category?: Database["public"]["Enums"]["device_category"]
          id?: string
          imei?: string | null
          ip_address?: string | null
          is_archived?: boolean
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          operating_system?: string | null
          processor?: string | null
          purchase_date?: string | null
          ram_gb?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage_size_gb?: number | null
          storage_type?: string | null
          updated_at?: string
          updated_by?: string | null
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_order_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_internal: boolean
          order_id: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean
          order_id: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          accessories_received: string | null
          archive_reason: string | null
          assigned_user_id: string | null
          client_description: string | null
          client_id: string
          closed_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          device_id: string | null
          diagnosis: string | null
          estimated_completion_date: string | null
          extra_cost_net: number | null
          id: string
          intake_channel: Database["public"]["Enums"]["intake_channel"] | null
          internal_notes: string | null
          is_archived: boolean
          is_paid: boolean
          labor_net: number | null
          lock_code: string | null
          order_number: string
          paid_at: string | null
          parts_net: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          priority: Database["public"]["Enums"]["order_priority"]
          problem_description: string | null
          received_at: string
          repair_description: string | null
          reported_at: string | null
          sales_document_number: string | null
          sales_document_type:
            | Database["public"]["Enums"]["sales_document_type"]
            | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["order_status"]
          total_gross: number | null
          total_net: number | null
          updated_at: string
          updated_by: string | null
          visual_condition: string | null
        }
        Insert: {
          accessories_received?: string | null
          archive_reason?: string | null
          assigned_user_id?: string | null
          client_description?: string | null
          client_id: string
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_id?: string | null
          diagnosis?: string | null
          estimated_completion_date?: string | null
          extra_cost_net?: number | null
          id?: string
          intake_channel?: Database["public"]["Enums"]["intake_channel"] | null
          internal_notes?: string | null
          is_archived?: boolean
          is_paid?: boolean
          labor_net?: number | null
          lock_code?: string | null
          order_number: string
          paid_at?: string | null
          parts_net?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          priority?: Database["public"]["Enums"]["order_priority"]
          problem_description?: string | null
          received_at?: string
          repair_description?: string | null
          reported_at?: string | null
          sales_document_number?: string | null
          sales_document_type?:
            | Database["public"]["Enums"]["sales_document_type"]
            | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          updated_by?: string | null
          visual_condition?: string | null
        }
        Update: {
          accessories_received?: string | null
          archive_reason?: string | null
          assigned_user_id?: string | null
          client_description?: string | null
          client_id?: string
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_id?: string | null
          diagnosis?: string | null
          estimated_completion_date?: string | null
          extra_cost_net?: number | null
          id?: string
          intake_channel?: Database["public"]["Enums"]["intake_channel"] | null
          internal_notes?: string | null
          is_archived?: boolean
          is_paid?: boolean
          labor_net?: number | null
          lock_code?: string | null
          order_number?: string
          paid_at?: string | null
          parts_net?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          priority?: Database["public"]["Enums"]["order_priority"]
          problem_description?: string | null
          received_at?: string
          repair_description?: string | null
          reported_at?: string | null
          sales_document_number?: string | null
          sales_document_type?:
            | Database["public"]["Enums"]["sales_document_type"]
            | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          updated_by?: string | null
          visual_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      app_role: "ADMIN" | "MANAGER" | "EMPLOYEE" | "READONLY"
      client_type: "PRIVATE" | "COMPANY"
      device_category:
        | "DESKTOP"
        | "LAPTOP"
        | "PHONE"
        | "TABLET"
        | "PRINTER"
        | "SERVER"
        | "ROUTER"
        | "SWITCH"
        | "AP"
        | "NVR"
        | "CAMERA"
        | "OTHER"
      device_status: "ACTIVE" | "IN_SERVICE" | "RETIRED"
      intake_channel: "PHONE" | "EMAIL" | "IN_PERSON" | "REMOTE" | "OTHER"
      order_priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
      order_status:
        | "NEW"
        | "DIAGNOSIS"
        | "IN_PROGRESS"
        | "WAITING_CLIENT"
        | "READY_FOR_RETURN"
        | "COMPLETED"
        | "ARCHIVED"
        | "CANCELLED"
      payment_method: "CASH" | "CARD" | "TRANSFER"
      sales_document_type: "RECEIPT" | "INVOICE" | "NONE"
      service_type: "COMPUTER_SERVICE" | "PHONE_SERVICE"
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
      app_role: ["ADMIN", "MANAGER", "EMPLOYEE", "READONLY"],
      client_type: ["PRIVATE", "COMPANY"],
      device_category: [
        "DESKTOP",
        "LAPTOP",
        "PHONE",
        "TABLET",
        "PRINTER",
        "SERVER",
        "ROUTER",
        "SWITCH",
        "AP",
        "NVR",
        "CAMERA",
        "OTHER",
      ],
      device_status: ["ACTIVE", "IN_SERVICE", "RETIRED"],
      intake_channel: ["PHONE", "EMAIL", "IN_PERSON", "REMOTE", "OTHER"],
      order_priority: ["LOW", "NORMAL", "HIGH", "URGENT"],
      order_status: [
        "NEW",
        "DIAGNOSIS",
        "IN_PROGRESS",
        "WAITING_CLIENT",
        "READY_FOR_RETURN",
        "COMPLETED",
        "ARCHIVED",
        "CANCELLED",
      ],
      payment_method: ["CASH", "CARD", "TRANSFER"],
      sales_document_type: ["RECEIPT", "INVOICE", "NONE"],
      service_type: ["COMPUTER_SERVICE", "PHONE_SERVICE"],
    },
  },
} as const

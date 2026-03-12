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
          description: string | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_value_json: Json | null
          old_value_json: Json | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value_json?: Json | null
          old_value_json?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_value_json?: Json | null
          old_value_json?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      billing_batch_items: {
        Row: {
          batch_id: string
          id: string
          it_work_entry_id: string
        }
        Insert: {
          batch_id: string
          id?: string
          it_work_entry_id: string
        }
        Update: {
          batch_id?: string
          id?: string
          it_work_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "billing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_batch_items_it_work_entry_id_fkey"
            columns: ["it_work_entry_id"]
            isOneToOne: false
            referencedRelation: "it_work_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_batches: {
        Row: {
          batch_number: string
          billed_at: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          period_from: string
          period_to: string
          total_gross: number
          total_net: number
        }
        Insert: {
          batch_number: string
          billed_at?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          period_from: string
          period_to: string
          total_gross?: number
          total_net?: number
        }
        Update: {
          batch_number?: string
          billed_at?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          period_from?: string
          period_to?: string
          total_gross?: number
          total_net?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_batches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          gross_amount: number | null
          id: string
          payment_method: string | null
          related_order_id: string | null
          source_type: Database["public"]["Enums"]["cash_source_type"]
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["cash_transaction_type"]
          user_id: string | null
          vat_amount: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          gross_amount?: number | null
          id?: string
          payment_method?: string | null
          related_order_id?: string | null
          source_type?: Database["public"]["Enums"]["cash_source_type"]
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["cash_transaction_type"]
          user_id?: string | null
          vat_amount?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          gross_amount?: number | null
          id?: string
          payment_method?: string | null
          related_order_id?: string | null
          source_type?: Database["public"]["Enums"]["cash_source_type"]
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["cash_transaction_type"]
          user_id?: string | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
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
      client_it_documents: {
        Row: {
          category: Database["public"]["Enums"]["it_doc_category"]
          client_id: string
          created_at: string
          created_by: string | null
          dns_servers: string | null
          file_name: string | null
          file_path: string | null
          gateway: string | null
          id: string
          ip_address: string | null
          is_archived: boolean
          license_expires_at: string | null
          license_key: string | null
          notes: string | null
          password_encrypted: string | null
          seats: number | null
          software_name: string | null
          subnet_mask: string | null
          title: string
          updated_at: string
          updated_by: string | null
          url: string | null
          username: string | null
          vlan: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["it_doc_category"]
          client_id: string
          created_at?: string
          created_by?: string | null
          dns_servers?: string | null
          file_name?: string | null
          file_path?: string | null
          gateway?: string | null
          id?: string
          ip_address?: string | null
          is_archived?: boolean
          license_expires_at?: string | null
          license_key?: string | null
          notes?: string | null
          password_encrypted?: string | null
          seats?: number | null
          software_name?: string | null
          subnet_mask?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
          username?: string | null
          vlan?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["it_doc_category"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          dns_servers?: string | null
          file_name?: string | null
          file_path?: string | null
          gateway?: string | null
          id?: string
          ip_address?: string | null
          is_archived?: boolean
          license_expires_at?: string | null
          license_key?: string | null
          notes?: string | null
          password_encrypted?: string | null
          seats?: number | null
          software_name?: string | null
          subnet_mask?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
          username?: string | null
          vlan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_it_documents_client_id_fkey"
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
          business_role: Database["public"]["Enums"]["business_role"]
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
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
          business_role?: Database["public"]["Enums"]["business_role"]
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          business_role?: Database["public"]["Enums"]["business_role"]
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
      comment_reads: {
        Row: {
          comment_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reads_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "service_order_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address_city: string | null
          address_postal_code: string | null
          address_street: string | null
          company_name: string
          email: string | null
          id: string
          logo_url: string | null
          nip: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          company_name?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nip?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          company_name?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          nip?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      customer_messages: {
        Row: {
          created_at: string
          id: string
          is_read_by_client: boolean
          is_read_by_staff: boolean
          message: string
          sender_name: string
          sender_type: string
          sender_user_id: string | null
          service_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read_by_client?: boolean
          is_read_by_staff?: boolean
          message: string
          sender_name?: string
          sender_type: string
          sender_user_id?: string | null
          service_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read_by_client?: boolean
          is_read_by_staff?: boolean
          message?: string
          sender_name?: string
          sender_type?: string
          sender_user_id?: string | null
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_messages_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          asset_tag: string | null
          client_id: string | null
          cpu: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          device_category: Database["public"]["Enums"]["device_category"]
          gpu: string | null
          id: string
          imei: string | null
          ip_address: string | null
          is_archived: boolean
          mac_address: string | null
          manufacturer: string | null
          model: string | null
          motherboard: string | null
          notes: string | null
          operating_system: string | null
          processor: string | null
          psu: string | null
          purchase_date: string | null
          ram_gb: number | null
          ram_type: string | null
          serial_number: string | null
          specification_notes: string | null
          status: Database["public"]["Enums"]["device_status"]
          storage_size_gb: number | null
          storage_type: string | null
          storage1_size: string | null
          storage1_type: string | null
          storage2_size: string | null
          storage2_type: string | null
          updated_at: string
          updated_by: string | null
          warranty_until: string | null
        }
        Insert: {
          asset_tag?: string | null
          client_id?: string | null
          cpu?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          device_category?: Database["public"]["Enums"]["device_category"]
          gpu?: string | null
          id?: string
          imei?: string | null
          ip_address?: string | null
          is_archived?: boolean
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          motherboard?: string | null
          notes?: string | null
          operating_system?: string | null
          processor?: string | null
          psu?: string | null
          purchase_date?: string | null
          ram_gb?: number | null
          ram_type?: string | null
          serial_number?: string | null
          specification_notes?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage_size_gb?: number | null
          storage_type?: string | null
          storage1_size?: string | null
          storage1_type?: string | null
          storage2_size?: string | null
          storage2_type?: string | null
          updated_at?: string
          updated_by?: string | null
          warranty_until?: string | null
        }
        Update: {
          asset_tag?: string | null
          client_id?: string | null
          cpu?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          device_category?: Database["public"]["Enums"]["device_category"]
          gpu?: string | null
          id?: string
          imei?: string | null
          ip_address?: string | null
          is_archived?: boolean
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          motherboard?: string | null
          notes?: string | null
          operating_system?: string | null
          processor?: string | null
          psu?: string | null
          purchase_date?: string | null
          ram_gb?: number | null
          ram_type?: string | null
          serial_number?: string | null
          specification_notes?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage_size_gb?: number | null
          storage_type?: string | null
          storage1_size?: string | null
          storage1_type?: string | null
          storage2_size?: string | null
          storage2_type?: string | null
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
      document_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          document_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          document_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          document_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_items: {
        Row: {
          created_at: string
          description: string | null
          document_id: string
          id: string
          inventory_item_id: string | null
          item_type: string
          name: string
          quantity: number
          related_it_work_id: string | null
          related_order_id: string | null
          sort_order: number
          total_gross: number
          total_net: number
          total_vat: number
          unit: string
          unit_net: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_id: string
          id?: string
          inventory_item_id?: string | null
          item_type?: string
          name: string
          quantity?: number
          related_it_work_id?: string | null
          related_order_id?: string | null
          sort_order?: number
          total_gross?: number
          total_net?: number
          total_vat?: number
          unit?: string
          unit_net?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          document_id?: string
          id?: string
          inventory_item_id?: string | null
          item_type?: string
          name?: string
          quantity?: number
          related_it_work_id?: string | null
          related_order_id?: string | null
          sort_order?: number
          total_gross?: number
          total_net?: number
          total_vat?: number
          unit?: string
          unit_net?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_items_related_it_work_id_fkey"
            columns: ["related_it_work_id"]
            isOneToOne: false
            referencedRelation: "it_work_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_items_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          buyer_building: string | null
          buyer_city: string | null
          buyer_country: string | null
          buyer_email: string | null
          buyer_local: string | null
          buyer_name: string | null
          buyer_nip: string | null
          buyer_phone: string | null
          buyer_postal_code: string | null
          buyer_street: string | null
          client_id: string | null
          contractor_building: string | null
          contractor_city: string | null
          contractor_country: string | null
          contractor_email: string | null
          contractor_local: string | null
          contractor_name: string | null
          contractor_nip: string | null
          contractor_phone: string | null
          contractor_postal_code: string | null
          contractor_street: string | null
          correction_reason: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["document_direction"]
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          due_date: string | null
          gross_amount: number
          id: string
          is_archived: boolean
          issue_date: string
          net_amount: number
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["document_payment_status"]
          received_date: string | null
          related_document_id: string | null
          related_offer_id: string | null
          related_order_id: string | null
          sale_date: string | null
          updated_at: string
          updated_by: string | null
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          buyer_building?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_local?: string | null
          buyer_name?: string | null
          buyer_nip?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          client_id?: string | null
          contractor_building?: string | null
          contractor_city?: string | null
          contractor_country?: string | null
          contractor_email?: string | null
          contractor_local?: string | null
          contractor_name?: string | null
          contractor_nip?: string | null
          contractor_phone?: string | null
          contractor_postal_code?: string | null
          contractor_street?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["document_direction"]
          document_number: string
          document_type?: Database["public"]["Enums"]["document_type"]
          due_date?: string | null
          gross_amount?: number
          id?: string
          is_archived?: boolean
          issue_date?: string
          net_amount?: number
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["document_payment_status"]
          received_date?: string | null
          related_document_id?: string | null
          related_offer_id?: string | null
          related_order_id?: string | null
          sale_date?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          buyer_building?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_local?: string | null
          buyer_name?: string | null
          buyer_nip?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          buyer_street?: string | null
          client_id?: string | null
          contractor_building?: string | null
          contractor_city?: string | null
          contractor_country?: string | null
          contractor_email?: string | null
          contractor_local?: string | null
          contractor_name?: string | null
          contractor_nip?: string | null
          contractor_phone?: string | null
          contractor_postal_code?: string | null
          contractor_street?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["document_direction"]
          document_number?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          due_date?: string | null
          gross_amount?: number
          id?: string
          is_archived?: boolean
          issue_date?: string
          net_amount?: number
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["document_payment_status"]
          received_date?: string | null
          related_document_id?: string | null
          related_offer_id?: string | null
          related_order_id?: string | null
          sale_date?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_related_offer_id_fkey"
            columns: ["related_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string | null
          compatible_models: string[] | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          inventory_number: string | null
          is_active: boolean
          is_archived: boolean
          manufacturer: string | null
          minimum_quantity: number
          model: string | null
          name: string
          notes: string | null
          purchase_net: number
          sale_net: number
          sku: string | null
          stock_quantity: number
          unit: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          category?: string | null
          compatible_models?: string[] | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          inventory_number?: string | null
          is_active?: boolean
          is_archived?: boolean
          manufacturer?: string | null
          minimum_quantity?: number
          model?: string | null
          name: string
          notes?: string | null
          purchase_net?: number
          sale_net?: number
          sku?: string | null
          stock_quantity?: number
          unit?: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          category?: string | null
          compatible_models?: string[] | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          inventory_number?: string | null
          is_active?: boolean
          is_archived?: boolean
          manufacturer?: string | null
          minimum_quantity?: number
          model?: string | null
          name?: string
          notes?: string | null
          purchase_net?: number
          sale_net?: number
          sku?: string | null
          stock_quantity?: number
          unit?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          purchase_net: number | null
          quantity: number
          sale_net: number | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["movement_source"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          purchase_net?: number | null
          quantity: number
          sale_net?: number | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["movement_source"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          purchase_net?: number | null
          quantity?: number
          sale_net?: number | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["movement_source"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          quantity: number
          released_at: string | null
          service_order_id: string
          service_order_item_id: string
          status: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          quantity?: number
          released_at?: string | null
          service_order_id: string
          service_order_item_id: string
          status?: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          quantity?: number
          released_at?: string | null
          service_order_id?: string
          service_order_item_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_service_order_item_id_fkey"
            columns: ["service_order_item_id"]
            isOneToOne: false
            referencedRelation: "service_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      it_work_comments: {
        Row: {
          comment: string
          created_at: string
          entry_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          entry_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          entry_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_work_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "it_work_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      it_work_entries: {
        Row: {
          amount_gross: number
          amount_net: number
          assigned_user_id: string | null
          billable_hours: number
          billing_batch_id: string | null
          client_id: string
          cost_net: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          device_id: string | null
          entry_number: string
          hourly_rate: number
          id: string
          is_archived: boolean
          notes: string | null
          service_category: Database["public"]["Enums"]["service_category"]
          status: Database["public"]["Enums"]["billing_status"]
          updated_at: string
          updated_by: string | null
          work_date: string
          work_hours: number
        }
        Insert: {
          amount_gross?: number
          amount_net?: number
          assigned_user_id?: string | null
          billable_hours?: number
          billing_batch_id?: string | null
          client_id: string
          cost_net?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          device_id?: string | null
          entry_number: string
          hourly_rate?: number
          id?: string
          is_archived?: boolean
          notes?: string | null
          service_category?: Database["public"]["Enums"]["service_category"]
          status?: Database["public"]["Enums"]["billing_status"]
          updated_at?: string
          updated_by?: string | null
          work_date?: string
          work_hours?: number
        }
        Update: {
          amount_gross?: number
          amount_net?: number
          assigned_user_id?: string | null
          billable_hours?: number
          billing_batch_id?: string | null
          client_id?: string
          cost_net?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          device_id?: string | null
          entry_number?: string
          hourly_rate?: number
          id?: string
          is_archived?: boolean
          notes?: string | null
          service_category?: Database["public"]["Enums"]["service_category"]
          status?: Database["public"]["Enums"]["billing_status"]
          updated_at?: string
          updated_by?: string | null
          work_date?: string
          work_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "it_work_entries_billing_batch_id_fkey"
            columns: ["billing_batch_id"]
            isOneToOne: false
            referencedRelation: "billing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_work_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_work_entries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      network_devices: {
        Row: {
          created_at: string
          device_name: string
          device_type: string
          dns_servers: string | null
          document_id: string
          gateway: string | null
          id: string
          ip_address: string | null
          notes: string | null
          password_encrypted: string | null
          sort_order: number
          subnet_mask: string | null
          username: string | null
          vlan: string | null
        }
        Insert: {
          created_at?: string
          device_name: string
          device_type?: string
          dns_servers?: string | null
          document_id: string
          gateway?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          password_encrypted?: string | null
          sort_order?: number
          subnet_mask?: string | null
          username?: string | null
          vlan?: string | null
        }
        Update: {
          created_at?: string
          device_name?: string
          device_type?: string
          dns_servers?: string | null
          document_id?: string
          gateway?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          password_encrypted?: string | null
          sort_order?: number
          subnet_mask?: string | null
          username?: string | null
          vlan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_devices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_it_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          channel: string
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          order_id: string | null
          recipient: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          channel: string
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          subject: string
          updated_at: string
        }
        Insert: {
          body_template?: string
          channel?: string
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          subject?: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          related_comment_id: string | null
          related_order_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          related_comment_id?: string | null
          related_order_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          related_comment_id?: string | null
          related_order_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_comment_id_fkey"
            columns: ["related_comment_id"]
            isOneToOne: false
            referencedRelation: "service_order_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_items: {
        Row: {
          description: string | null
          id: string
          item_type: Database["public"]["Enums"]["offer_item_type"]
          name: string
          offer_id: string
          quantity: number
          sort_order: number
          total_gross: number
          total_net: number
          unit: string
          unit_net: number
          vat_rate: number
        }
        Insert: {
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["offer_item_type"]
          name: string
          offer_id: string
          quantity?: number
          sort_order?: number
          total_gross?: number
          total_net?: number
          unit?: string
          unit_net?: number
          vat_rate?: number
        }
        Update: {
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["offer_item_type"]
          name?: string
          offer_id?: string
          quantity?: number
          sort_order?: number
          total_gross?: number
          total_net?: number
          unit?: string
          unit_net?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          follow_up_date: string | null
          id: string
          is_archived: boolean
          issue_date: string
          notes: string | null
          offer_number: string
          rejected_at: string | null
          status: Database["public"]["Enums"]["offer_status"]
          title: string
          total_gross: number
          total_net: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          follow_up_date?: string | null
          id?: string
          is_archived?: boolean
          issue_date?: string
          notes?: string | null
          offer_number: string
          rejected_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          follow_up_date?: string | null
          id?: string
          is_archived?: boolean
          issue_date?: string
          notes?: string | null
          offer_number?: string
          rejected_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title?: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      order_technicians: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          is_primary: boolean
          order_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_primary?: boolean
          order_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_primary?: boolean
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_technicians_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_templates: {
        Row: {
          config: Json
          created_at: string
          document_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          document_type?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_department: string | null
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
          default_department?: string | null
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
          default_department?: string | null
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
      purchase_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          category: string | null
          client_approval: Database["public"]["Enums"]["client_approval_status"]
          client_approval_changed_at: string | null
          client_approval_changed_by: string | null
          created_at: string
          description: string | null
          estimated_gross: number | null
          estimated_net: number | null
          estimated_vat: number | null
          id: string
          inventory_item_id: string | null
          item_name: string
          manufacturer: string | null
          model: string | null
          order_id: string
          product_url: string | null
          quantity: number
          requested_by: string | null
          requested_by_name: string | null
          status: Database["public"]["Enums"]["purchase_request_status"]
          status_changed_at: string | null
          status_changed_by: string | null
          supplier: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["purchase_request_urgency"]
        }
        Insert: {
          category?: string | null
          client_approval?: Database["public"]["Enums"]["client_approval_status"]
          client_approval_changed_at?: string | null
          client_approval_changed_by?: string | null
          created_at?: string
          description?: string | null
          estimated_gross?: number | null
          estimated_net?: number | null
          estimated_vat?: number | null
          id?: string
          inventory_item_id?: string | null
          item_name: string
          manufacturer?: string | null
          model?: string | null
          order_id: string
          product_url?: string | null
          quantity?: number
          requested_by?: string | null
          requested_by_name?: string | null
          status?: Database["public"]["Enums"]["purchase_request_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          supplier?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["purchase_request_urgency"]
        }
        Update: {
          category?: string | null
          client_approval?: Database["public"]["Enums"]["client_approval_status"]
          client_approval_changed_at?: string | null
          client_approval_changed_by?: string | null
          created_at?: string
          description?: string | null
          estimated_gross?: number | null
          estimated_net?: number | null
          estimated_vat?: number | null
          id?: string
          inventory_item_id?: string | null
          item_name?: string
          manufacturer?: string | null
          model?: string | null
          order_id?: string
          product_url?: string | null
          quantity?: number
          requested_by?: string | null
          requested_by_name?: string | null
          status?: Database["public"]["Enums"]["purchase_request_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          supplier?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["purchase_request_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      service_order_comments: {
        Row: {
          comment: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_internal: boolean
          order_id: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_internal?: boolean
          order_id: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
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
      service_order_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string | null
          item_name_snapshot: string
          item_type: string
          order_id: string
          purchase_net: number
          quantity: number
          sale_net: number
          total_purchase_net: number
          total_sale_net: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          item_name_snapshot: string
          item_type?: string
          order_id: string
          purchase_net?: number
          quantity?: number
          sale_net?: number
          total_purchase_net?: number
          total_sale_net?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          item_name_snapshot?: string
          item_type?: string
          order_id?: string
          purchase_net?: number
          quantity?: number
          sale_net?: number
          total_purchase_net?: number
          total_sale_net?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          order_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          order_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          order_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_photos_order_id_fkey"
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
          action_category: string | null
          appointment_note: string | null
          archive_reason: string | null
          assigned_user_id: string | null
          client_description: string | null
          client_id: string
          client_signature_url: string | null
          client_signed_at: string | null
          closed_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          device_id: string | null
          diagnosis: string | null
          estimated_completion_date: string | null
          estimated_repair_cost_gross: number | null
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
          pickup_code: string | null
          planned_execution_date: string | null
          planned_execution_time: string | null
          priority: Database["public"]["Enums"]["order_priority"]
          problem_description: string | null
          received_at: string
          repair_approval_at: string | null
          repair_approval_note: string | null
          repair_approval_status: Database["public"]["Enums"]["repair_approval_status"]
          repair_description: string | null
          reported_at: string | null
          sales_document_number: string | null
          sales_document_type:
            | Database["public"]["Enums"]["sales_document_type"]
            | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["order_status"]
          status_token: string | null
          technician_signature_url: string | null
          technician_signed_at: string | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
          updated_by: string | null
          visual_condition: string | null
        }
        Insert: {
          accessories_received?: string | null
          action_category?: string | null
          appointment_note?: string | null
          archive_reason?: string | null
          assigned_user_id?: string | null
          client_description?: string | null
          client_id: string
          client_signature_url?: string | null
          client_signed_at?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          device_id?: string | null
          diagnosis?: string | null
          estimated_completion_date?: string | null
          estimated_repair_cost_gross?: number | null
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
          pickup_code?: string | null
          planned_execution_date?: string | null
          planned_execution_time?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          problem_description?: string | null
          received_at?: string
          repair_approval_at?: string | null
          repair_approval_note?: string | null
          repair_approval_status?: Database["public"]["Enums"]["repair_approval_status"]
          repair_description?: string | null
          reported_at?: string | null
          sales_document_number?: string | null
          sales_document_type?:
            | Database["public"]["Enums"]["sales_document_type"]
            | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          status_token?: string | null
          technician_signature_url?: string | null
          technician_signed_at?: string | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          updated_by?: string | null
          visual_condition?: string | null
        }
        Update: {
          accessories_received?: string | null
          action_category?: string | null
          appointment_note?: string | null
          archive_reason?: string | null
          assigned_user_id?: string | null
          client_description?: string | null
          client_id?: string
          client_signature_url?: string | null
          client_signed_at?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          device_id?: string | null
          diagnosis?: string | null
          estimated_completion_date?: string | null
          estimated_repair_cost_gross?: number | null
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
          pickup_code?: string | null
          planned_execution_date?: string | null
          planned_execution_time?: string | null
          priority?: Database["public"]["Enums"]["order_priority"]
          problem_description?: string | null
          received_at?: string
          repair_approval_at?: string | null
          repair_approval_note?: string | null
          repair_approval_status?: Database["public"]["Enums"]["repair_approval_status"]
          repair_description?: string | null
          reported_at?: string | null
          sales_document_number?: string | null
          sales_document_type?:
            | Database["public"]["Enums"]["sales_document_type"]
            | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          status_token?: string | null
          technician_signature_url?: string | null
          technician_signed_at?: string | null
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
      system_events: {
        Row: {
          created_at: string
          entity_id: string
          entity_name: string | null
          entity_type: string
          event_type: string
          id: string
          payload: Json | null
          processed: boolean
          processed_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_name?: string | null
          entity_type: string
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_order_reads: {
        Row: {
          id: string
          last_read_at: string
          order_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          order_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_order_reads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
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
      warehouse_document_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          price_net: number | null
          quantity: number
          sort_order: number
          warehouse_document_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          price_net?: number | null
          quantity?: number
          sort_order?: number
          warehouse_document_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          price_net?: number | null
          quantity?: number
          sort_order?: number
          warehouse_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_document_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_document_items_warehouse_document_id_fkey"
            columns: ["warehouse_document_id"]
            isOneToOne: false
            referencedRelation: "warehouse_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_documents: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          document_date: string
          document_number: string
          document_type: Database["public"]["Enums"]["warehouse_doc_type"]
          id: string
          linked_invoice_id: string | null
          notes: string | null
          related_order_id: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_number?: string
          document_type: Database["public"]["Enums"]["warehouse_doc_type"]
          id?: string
          linked_invoice_id?: string | null
          notes?: string | null
          related_order_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_number?: string
          document_type?: Database["public"]["Enums"]["warehouse_doc_type"]
          id?: string
          linked_invoice_id?: string | null
          notes?: string | null
          related_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_documents_linked_invoice_id_fkey"
            columns: ["linked_invoice_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_documents_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_table_columns: {
        Args: { p_table: string }
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          is_nullable: string
          udt_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "ADMIN"
        | "MANAGER"
        | "EMPLOYEE"
        | "READONLY"
        | "TECHNICIAN"
        | "OFFICE"
        | "KIEROWNIK"
        | "SERWISANT"
      billing_status: "UNBILLED" | "BILLED" | "CANCELLED"
      business_role: "CUSTOMER" | "SUPPLIER" | "CUSTOMER_AND_SUPPLIER"
      cash_source_type: "SERVICE_ORDER" | "MANUAL" | "WITHDRAWAL" | "CORRECTION"
      cash_transaction_type: "IN" | "OUT" | "RESET"
      client_approval_status: "PENDING" | "APPROVED" | "REJECTED"
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
      document_direction: "INCOME" | "EXPENSE"
      document_payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE"
      document_type:
        | "PURCHASE_INVOICE"
        | "SALES_INVOICE"
        | "RECEIPT"
        | "PROFORMA"
        | "CORRECTION"
        | "OTHER"
      intake_channel: "PHONE" | "EMAIL" | "IN_PERSON" | "REMOTE" | "OTHER"
      it_doc_category: "PASSWORD" | "NETWORK" | "LICENSE" | "NOTE"
      movement_source:
        | "PURCHASE"
        | "SERVICE_ORDER"
        | "IT_WORK"
        | "MANUAL"
        | "DOCUMENT"
      movement_type:
        | "IN"
        | "OUT"
        | "ADJUSTMENT"
        | "RESERVATION"
        | "DAMAGE"
        | "INTERNAL_USE"
      offer_item_type: "SERVICE" | "PRODUCT" | "CUSTOM"
      offer_status:
        | "DRAFT"
        | "SENT"
        | "WAITING"
        | "ACCEPTED"
        | "REJECTED"
        | "CANCELLED"
        | "EXPIRED"
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
        | "DIAGNOSIS_QUOTE"
        | "TODO"
        | "WAITING"
      payment_method: "CASH" | "CARD" | "TRANSFER"
      purchase_request_status:
        | "NEW"
        | "TO_ORDER"
        | "ORDERED"
        | "DELIVERED"
        | "CANCELLED"
        | "INSTALLED"
      purchase_request_urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT"
      repair_approval_status:
        | "NONE"
        | "WAITING_FOR_CUSTOMER"
        | "APPROVED_BY_CUSTOMER"
        | "REJECTED_BY_CUSTOMER"
      sales_document_type: "RECEIPT" | "INVOICE" | "NONE"
      service_category:
        | "ADMINISTRATION"
        | "NETWORK"
        | "MONITORING"
        | "ERP"
        | "HELPDESK"
        | "IMPLEMENTATION"
        | "MAINTENANCE"
        | "OTHER"
      service_type: "COMPUTER_SERVICE" | "PHONE_SERVICE"
      warehouse_doc_type: "PZ" | "WZ" | "PW" | "RW" | "CORRECTION"
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
      app_role: [
        "ADMIN",
        "MANAGER",
        "EMPLOYEE",
        "READONLY",
        "TECHNICIAN",
        "OFFICE",
        "KIEROWNIK",
        "SERWISANT",
      ],
      billing_status: ["UNBILLED", "BILLED", "CANCELLED"],
      business_role: ["CUSTOMER", "SUPPLIER", "CUSTOMER_AND_SUPPLIER"],
      cash_source_type: ["SERVICE_ORDER", "MANUAL", "WITHDRAWAL", "CORRECTION"],
      cash_transaction_type: ["IN", "OUT", "RESET"],
      client_approval_status: ["PENDING", "APPROVED", "REJECTED"],
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
      document_direction: ["INCOME", "EXPENSE"],
      document_payment_status: ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"],
      document_type: [
        "PURCHASE_INVOICE",
        "SALES_INVOICE",
        "RECEIPT",
        "PROFORMA",
        "CORRECTION",
        "OTHER",
      ],
      intake_channel: ["PHONE", "EMAIL", "IN_PERSON", "REMOTE", "OTHER"],
      it_doc_category: ["PASSWORD", "NETWORK", "LICENSE", "NOTE"],
      movement_source: [
        "PURCHASE",
        "SERVICE_ORDER",
        "IT_WORK",
        "MANUAL",
        "DOCUMENT",
      ],
      movement_type: [
        "IN",
        "OUT",
        "ADJUSTMENT",
        "RESERVATION",
        "DAMAGE",
        "INTERNAL_USE",
      ],
      offer_item_type: ["SERVICE", "PRODUCT", "CUSTOM"],
      offer_status: [
        "DRAFT",
        "SENT",
        "WAITING",
        "ACCEPTED",
        "REJECTED",
        "CANCELLED",
        "EXPIRED",
      ],
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
        "DIAGNOSIS_QUOTE",
        "TODO",
        "WAITING",
      ],
      payment_method: ["CASH", "CARD", "TRANSFER"],
      purchase_request_status: [
        "NEW",
        "TO_ORDER",
        "ORDERED",
        "DELIVERED",
        "CANCELLED",
        "INSTALLED",
      ],
      purchase_request_urgency: ["LOW", "NORMAL", "HIGH", "URGENT"],
      repair_approval_status: [
        "NONE",
        "WAITING_FOR_CUSTOMER",
        "APPROVED_BY_CUSTOMER",
        "REJECTED_BY_CUSTOMER",
      ],
      sales_document_type: ["RECEIPT", "INVOICE", "NONE"],
      service_category: [
        "ADMINISTRATION",
        "NETWORK",
        "MONITORING",
        "ERP",
        "HELPDESK",
        "IMPLEMENTATION",
        "MAINTENANCE",
        "OTHER",
      ],
      service_type: ["COMPUTER_SERVICE", "PHONE_SERVICE"],
      warehouse_doc_type: ["PZ", "WZ", "PW", "RW", "CORRECTION"],
    },
  },
} as const

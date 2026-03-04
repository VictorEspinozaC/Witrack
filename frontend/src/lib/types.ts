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
      branches: {
        Row: {
          address_notes: string | null
          code: string
          comuna: string | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          region: string | null
          street: string | null
          street_number: string | null
        }
        Insert: {
          address_notes?: string | null
          code: string
          comuna?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          region?: string | null
          street?: string | null
          street_number?: string | null
        }
        Update: {
          address_notes?: string | null
          code?: string
          comuna?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          region?: string | null
          street?: string | null
          street_number?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          address_notes: string | null
          comuna: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          region: string | null
          rut: string | null
          street: string | null
          street_number: string | null
        }
        Insert: {
          address?: string | null
          address_notes?: string | null
          comuna?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          region?: string | null
          rut?: string | null
          street?: string | null
          street_number?: string | null
        }
        Update: {
          address?: string | null
          address_notes?: string | null
          comuna?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          region?: string | null
          rut?: string | null
          street?: string | null
          street_number?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_name: string
          created_at: string | null
          email: string | null
          entity_id: string
          entity_type: string
          id: string
          observations: string | null
          phone: string | null
        }
        Insert: {
          contact_name: string
          created_at?: string | null
          email?: string | null
          entity_id: string
          entity_type: string
          id?: string
          observations?: string | null
          phone?: string | null
        }
        Update: {
          contact_name?: string
          created_at?: string | null
          email?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          observations?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          birth_date: string | null
          created_at: string | null
          id: string
          is_active: boolean
          license_expiry_date: string | null
          name: string
          observations: string | null
          phone: string | null
          rut: string
          supplier_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          license_expiry_date?: string | null
          name: string
          observations?: string | null
          phone?: string | null
          rut: string
          supplier_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          license_expiry_date?: string | null
          name?: string
          observations?: string | null
          phone?: string | null
          rut?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          affected_documents: Json | null
          created_at: string | null
          description: string
          id: string
          photo_url: string | null
          reported_by: string | null
          resolution: string | null
          resolved_at: string | null
          shipment_id: string
          status: string
          type: string
        }
        Insert: {
          affected_documents?: Json | null
          created_at?: string | null
          description: string
          id?: string
          photo_url?: string | null
          reported_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          shipment_id: string
          status?: string
          type: string
        }
        Update: {
          affected_documents?: Json | null
          created_at?: string | null
          description?: string
          id?: string
          photo_url?: string | null
          reported_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          shipment_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      load_photos: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          image_url: string
          shipment_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          shipment_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_photos_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_confirmations: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          files: Json | null
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          schedule_id: string
          status: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          files?: Json | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id: string
          status?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          files?: Json | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id?: string
          status?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_confirmations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_confirmations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_confirmations_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      password_recovery_otp: {
        Row: {
          attempts: number | null
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          otp_code: string
          phone: string | null
          used: boolean | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          otp_code: string
          phone?: string | null
          used?: boolean | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string | null
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_recovery_otp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          permissions: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          permissions?: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          permissions?: Json
        }
        Relationships: []
      }
      schedules: {
        Row: {
          branch_id: string
          cargo_type: string | null
          client_id: string | null
          created_at: string | null
          destination_branch_id: string | null
          destination_type: string | null
          driver_id: string | null
          id: string
          maquila_supplier_id: string | null
          notes: string | null
          operation_type: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string
          supplier_id: string | null
          transport_company: string | null
          transport_supplier_id: string | null
          truck_id: string | null
        }
        Insert: {
          branch_id: string
          cargo_type?: string | null
          client_id?: string | null
          created_at?: string | null
          destination_branch_id?: string | null
          destination_type?: string | null
          driver_id?: string | null
          id?: string
          maquila_supplier_id?: string | null
          notes?: string | null
          operation_type?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string
          supplier_id?: string | null
          transport_company?: string | null
          transport_supplier_id?: string | null
          truck_id?: string | null
        }
        Update: {
          branch_id?: string
          cargo_type?: string | null
          client_id?: string | null
          created_at?: string | null
          destination_branch_id?: string | null
          destination_type?: string | null
          driver_id?: string | null
          id?: string
          maquila_supplier_id?: string | null
          notes?: string | null
          operation_type?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          supplier_id?: string | null
          transport_company?: string | null
          transport_supplier_id?: string | null
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_maquila_supplier_id_fkey"
            columns: ["maquila_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_transport_supplier_id_fkey"
            columns: ["transport_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_log: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          shipment_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          shipment_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          arrival_time: string | null
          branch_id: string
          cargo_type: string | null
          created_at: string | null
          dispatch_documents: Json | null
          dispatch_time: string | null
          driver_id: string
          emision_guia_time: string | null
          espera_salida_time: string | null
          gate_entry_time: string | null
          id: string
          latitude: number | null
          load_end: string | null
          load_start: string | null
          longitude: number | null
          notes: string | null
          ramp_assignment: string | null
          recepcion_time: string | null
          reception_confirmed: boolean | null
          reception_confirmed_at: string | null
          reception_confirmed_by: string | null
          reception_time: string | null
          schedule_id: string | null
          seal_number: string | null
          status: string
          transport_company: string | null
          truck_id: string
          yard_entry_time: string | null
        }
        Insert: {
          arrival_time?: string | null
          branch_id: string
          cargo_type?: string | null
          created_at?: string | null
          dispatch_documents?: Json | null
          dispatch_time?: string | null
          driver_id: string
          emision_guia_time?: string | null
          espera_salida_time?: string | null
          gate_entry_time?: string | null
          id?: string
          latitude?: number | null
          load_end?: string | null
          load_start?: string | null
          longitude?: number | null
          notes?: string | null
          ramp_assignment?: string | null
          recepcion_time?: string | null
          reception_confirmed?: boolean | null
          reception_confirmed_at?: string | null
          reception_confirmed_by?: string | null
          reception_time?: string | null
          schedule_id?: string | null
          seal_number?: string | null
          status: string
          transport_company?: string | null
          truck_id: string
          yard_entry_time?: string | null
        }
        Update: {
          arrival_time?: string | null
          branch_id?: string
          cargo_type?: string | null
          created_at?: string | null
          dispatch_documents?: Json | null
          dispatch_time?: string | null
          driver_id?: string
          emision_guia_time?: string | null
          espera_salida_time?: string | null
          gate_entry_time?: string | null
          id?: string
          latitude?: number | null
          load_end?: string | null
          load_start?: string | null
          longitude?: number | null
          notes?: string | null
          ramp_assignment?: string | null
          recepcion_time?: string | null
          reception_confirmed?: boolean | null
          reception_confirmed_at?: string | null
          reception_confirmed_by?: string | null
          reception_time?: string | null
          schedule_id?: string | null
          seal_number?: string | null
          status?: string
          transport_company?: string | null
          truck_id?: string
          yard_entry_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_reception_confirmed_by_fkey"
            columns: ["reception_confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          address_notes: string | null
          comuna: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          region: string | null
          rut: string | null
          street: string | null
          street_number: string | null
          types: string[]
        }
        Insert: {
          address?: string | null
          address_notes?: string | null
          comuna?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          region?: string | null
          rut?: string | null
          street?: string | null
          street_number?: string | null
          types?: string[]
        }
        Update: {
          address?: string | null
          address_notes?: string | null
          comuna?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          region?: string | null
          rut?: string | null
          street?: string | null
          street_number?: string | null
          types?: string[]
        }
        Relationships: []
      }
      tariffs: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          is_active: boolean
          price: number
          transport_company: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          price?: number
          transport_company: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          price?: number
          transport_company?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tariffs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          observations: string | null
          plate: string
          supplier_id: string | null
          transport_company: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          observations?: string | null
          plate: string
          supplier_id?: string | null
          transport_company?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          observations?: string | null
          plate?: string
          supplier_id?: string | null
          transport_company?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trucks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      yard_config: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          max_trucks_in_yard: number
          max_trucks_per_hour: number
          ramps: Json
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          max_trucks_in_yard?: number
          max_trucks_per_hour?: number
          ramps?: Json
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          max_trucks_in_yard?: number
          max_trucks_per_hour?: number
          ramps?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yard_config_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_has_role: {
        Args: { required_role: string }
        Returns: boolean
      }
      current_user_in_branch: { Args: { bid: string }; Returns: boolean }
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

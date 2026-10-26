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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_name: string
          agent_version: string
          created_at: string
          error_summary: string | null
          finished_at: string | null
          id: string
          input_document_ids: string[]
          organization_id: string
          output_recommendation_ids: string[]
          status: string
        }
        Insert: {
          agent_name: string
          agent_version: string
          created_at?: string
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          input_document_ids?: string[]
          organization_id: string
          output_recommendation_ids?: string[]
          status?: string
        }
        Update: {
          agent_name?: string
          agent_version?: string
          created_at?: string
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          input_document_ids?: string[]
          organization_id?: string
          output_recommendation_ids?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomy_policies: {
        Row: {
          action_kind: string
          approved_at: string | null
          approved_by: string | null
          autonomy_level: number
          created_at: string
          enabled: boolean
          id: string
          max_correction_rate: number
          max_critical_errors: number
          max_reversal_rate: number
          min_acceptance_rate: number
          min_reviewed: number
          organization_id: string
        }
        Insert: {
          action_kind: string
          approved_at?: string | null
          approved_by?: string | null
          autonomy_level?: number
          created_at?: string
          enabled?: boolean
          id?: string
          max_correction_rate?: number
          max_critical_errors?: number
          max_reversal_rate?: number
          min_acceptance_rate?: number
          min_reviewed?: number
          organization_id: string
        }
        Update: {
          action_kind?: string
          approved_at?: string | null
          approved_by?: string | null
          autonomy_level?: number
          created_at?: string
          enabled?: boolean
          id?: string
          max_correction_rate?: number
          max_critical_errors?: number
          max_reversal_rate?: number
          min_acceptance_rate?: number
          min_reviewed?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autonomy_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string | null
          organization_id: string
          owner_id: string | null
          status: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          organization_id: string
          owner_id?: string | null
          status?: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          organization_id?: string
          owner_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          organization_id: string
          provider: Database["public"]["Enums"]["source_provider"]
          provider_account_id: string | null
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id: string
          provider: Database["public"]["Enums"]["source_provider"]
          provider_account_id?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id?: string
          provider?: Database["public"]["Enums"]["source_provider"]
          provider_account_id?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_objectives: {
        Row: {
          created_at: string
          event_id: string
          id: string
          measurement_method: string | null
          name: string
          organization_id: string
          target: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          measurement_method?: string | null
          name: string
          organization_id: string
          target?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          measurement_method?: string | null
          name?: string
          organization_id?: string
          target?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_objectives_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_outcomes: {
        Row: {
          actual: number | null
          created_at: string
          event_id: string
          id: string
          narrative: string | null
          objective_id: string | null
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_evidence_id: string | null
        }
        Insert: {
          actual?: number | null
          created_at?: string
          event_id: string
          id?: string
          narrative?: string | null
          objective_id?: string | null
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_evidence_id?: string | null
        }
        Update: {
          actual?: number | null
          created_at?: string
          event_id?: string
          id?: string
          narrative?: string | null
          objective_id?: string | null
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_evidence_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_outcomes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outcomes_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "event_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outcomes_source_evidence_id_fkey"
            columns: ["source_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          organization_id: string
          starts_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          organization_id: string
          starts_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          starts_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          claim: string
          confidence: number | null
          created_at: string
          extracted_by: string
          id: string
          label: Database["public"]["Enums"]["evidence_label"]
          model_version: string | null
          observed_at: string | null
          organization_id: string
          source_fragment_id: string | null
        }
        Insert: {
          claim: string
          confidence?: number | null
          created_at?: string
          extracted_by: string
          id?: string
          label?: Database["public"]["Enums"]["evidence_label"]
          model_version?: string | null
          observed_at?: string | null
          organization_id: string
          source_fragment_id?: string | null
        }
        Update: {
          claim?: string
          confidence?: number | null
          created_at?: string
          extracted_by?: string
          id?: string
          label?: Database["public"]["Enums"]["evidence_label"]
          model_version?: string | null
          observed_at?: string | null
          organization_id?: string
          source_fragment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_source_fragment_id_fkey"
            columns: ["source_fragment_id"]
            isOneToOne: false
            referencedRelation: "source_fragments"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          id: string
          meeting_at: string | null
          organization_id: string
          source_document_id: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_at?: string | null
          organization_id: string
          source_document_id?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_at?: string | null
          organization_id?: string
          source_document_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          email: string | null
          id: string
          organization_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          organization_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_citations: {
        Row: {
          created_at: string
          evidence_id: string
          recommendation_id: string
        }
        Insert: {
          created_at?: string
          evidence_id: string
          recommendation_id: string
        }
        Update: {
          created_at?: string
          evidence_id?: string
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_citations_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_citations_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_reviews: {
        Row: {
          correction: string | null
          created_at: string
          decision: string
          id: string
          organization_id: string
          recommendation_id: string
          reviewer_id: string
        }
        Insert: {
          correction?: string | null
          created_at?: string
          decision: string
          id?: string
          organization_id: string
          recommendation_id: string
          reviewer_id: string
        }
        Update: {
          correction?: string | null
          created_at?: string
          decision?: string
          id?: string
          organization_id?: string
          recommendation_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_reviews_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          agent_name: string
          agent_version: string
          body: string
          created_at: string
          executed_at: string | null
          id: string
          kind: string
          organization_id: string
          policy_version: string
          reversed_at: string | null
          risk_class: Database["public"]["Enums"]["risk_class"]
          status: Database["public"]["Enums"]["review_status"]
          title: string
          uncertainty: string | null
        }
        Insert: {
          agent_name: string
          agent_version: string
          body: string
          created_at?: string
          executed_at?: string | null
          id?: string
          kind: string
          organization_id: string
          policy_version: string
          reversed_at?: string | null
          risk_class?: Database["public"]["Enums"]["risk_class"]
          status?: Database["public"]["Enums"]["review_status"]
          title: string
          uncertainty?: string | null
        }
        Update: {
          agent_name?: string
          agent_version?: string
          body?: string
          created_at?: string
          executed_at?: string | null
          id?: string
          kind?: string
          organization_id?: string
          policy_version?: string
          reversed_at?: string | null
          risk_class?: Database["public"]["Enums"]["risk_class"]
          status?: Database["public"]["Enums"]["review_status"]
          title?: string
          uncertainty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          connector_account_id: string | null
          content_hash: string
          created_at: string
          extracted_at: string | null
          extraction_status: string
          id: string
          mime_type: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["source_provider"]
          provider_document_id: string | null
          source_created_at: string | null
          source_modified_at: string | null
          source_url: string | null
          storage_path: string | null
          sync_run_id: string | null
          title: string
          version_label: string | null
        }
        Insert: {
          connector_account_id?: string | null
          content_hash: string
          created_at?: string
          extracted_at?: string | null
          extraction_status?: string
          id?: string
          mime_type?: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["source_provider"]
          provider_document_id?: string | null
          source_created_at?: string | null
          source_modified_at?: string | null
          source_url?: string | null
          storage_path?: string | null
          sync_run_id?: string | null
          title: string
          version_label?: string | null
        }
        Update: {
          connector_account_id?: string | null
          content_hash?: string
          created_at?: string
          extracted_at?: string | null
          extraction_status?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          provider?: Database["public"]["Enums"]["source_provider"]
          provider_document_id?: string | null
          source_created_at?: string | null
          source_modified_at?: string | null
          source_url?: string | null
          storage_path?: string | null
          sync_run_id?: string | null
          title?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_connector_account_id_fkey"
            columns: ["connector_account_id"]
            isOneToOne: false
            referencedRelation: "connector_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_documents_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_fragments: {
        Row: {
          content: string
          content_hash: string
          created_at: string
          fragment_type: string
          id: string
          locator: string
          organization_id: string
          source_document_id: string
        }
        Insert: {
          content: string
          content_hash: string
          created_at?: string
          fragment_type: string
          id?: string
          locator: string
          organization_id: string
          source_document_id: string
        }
        Update: {
          content?: string
          content_hash?: string
          created_at?: string
          fragment_type?: string
          id?: string
          locator?: string
          organization_id?: string
          source_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_fragments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_fragments_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          connector_account_id: string | null
          error_summary: string | null
          finished_at: string | null
          id: string
          items_failed: number
          items_imported: number
          items_seen: number
          organization_id: string
          provider: Database["public"]["Enums"]["source_provider"]
          started_at: string
          status: string
        }
        Insert: {
          connector_account_id?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_imported?: number
          items_seen?: number
          organization_id: string
          provider: Database["public"]["Enums"]["source_provider"]
          started_at?: string
          status?: string
        }
        Update: {
          connector_account_id?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_imported?: number
          items_seen?: number
          organization_id?: string
          provider?: Database["public"]["Enums"]["source_provider"]
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_connector_account_id_fkey"
            columns: ["connector_account_id"]
            isOneToOne: false
            referencedRelation: "connector_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_organization_member: {
        Args: { target_org: string; target_role: string; target_user: string }
        Returns: Json
      }
      bootstrap_organization: {
        Args: { org_name: string; org_slug: string }
        Returns: Json
      }
      remove_organization_member: {
        Args: { target_org: string; target_user: string }
        Returns: Json
      }
    }
    Enums: {
      evidence_label: "verified" | "claimed" | "inferred" | "missing"
      review_status:
        | "draft"
        | "proposed"
        | "approved"
        | "rejected"
        | "executed"
        | "reversed"
      risk_class: "low" | "medium" | "high"
      source_provider: "upload" | "google_drive" | "zoom"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      evidence_label: ["verified", "claimed", "inferred", "missing"],
      review_status: [
        "draft",
        "proposed",
        "approved",
        "rejected",
        "executed",
        "reversed",
      ],
      risk_class: ["low", "medium", "high"],
      source_provider: ["upload", "google_drive", "zoom"],
    },
  },
} as const

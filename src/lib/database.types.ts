export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          message: string
          report_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          message?: string
          report_id: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          message?: string
          report_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
      }
      ai_image_cache: {
        Row: {
          confidence: number | null
          created_at: string
          garbage_types: string[] | null
          image_hash: string
          label: string | null
          model: string | null
          needs_human_review: boolean | null
          prompt_version: string | null
          provider: string | null
          reason: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          garbage_types?: string[] | null
          image_hash: string
          label?: string | null
          model?: string | null
          needs_human_review?: boolean | null
          prompt_version?: string | null
          provider?: string | null
          reason?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          garbage_types?: string[] | null
          image_hash?: string
          label?: string | null
          model?: string | null
          needs_human_review?: boolean | null
          prompt_version?: string | null
          provider?: string | null
          reason?: string | null
        }
      }
      ai_runs: {
        Row: {
          action: string
          created_at: string
          duration_ms: number
          error: string | null
          id: string
          model: string
          prompt_version: string
          provider: string
          report_id: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms: number
          error?: string | null
          id?: string
          model: string
          prompt_version: string
          provider?: string
          report_id: string
          status: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          model?: string
          prompt_version?: string
          provider?: string
          report_id?: string
          status?: string
          user_id?: string
        }
      }
      ai_weekly_insights: {
        Row: {
          created_at: string
          generated_by: string | null
          id: string
          model: string
          period_end: string
          period_start: string
          recommendations: string[]
          risk_areas: string[]
          summary: string
          top_issues: Json
          total_reports: number
        }
        Insert: {
          created_at?: string
          generated_by?: string | null
          id?: string
          model: string
          period_end: string
          period_start: string
          recommendations?: string[]
          risk_areas?: string[]
          summary: string
          top_issues?: Json
          total_reports?: number
        }
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
      }
      reports: {
        Row: {
          after_photo_url: string | null
          ai: Json | null
          assigned_at: string | null
          assigned_to_name: string | null
          assigned_to_user_id: string | null
          before_photo_path: string | null
          before_photo_url: string
          completion_notes: string | null
          created_at: string
          created_by: string | null
          geohash: string | null
          id: string
          lat: number
          lng: number
          location: unknown
          merged_into_report_id: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          privacy_note: string | null
          resolved_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          triaged_at: string | null
          triaged_by_user_id: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
        }
        Insert: {
          after_photo_url?: string | null
          ai?: Json | null
          assigned_at?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          before_photo_path?: string | null
          before_photo_url?: string
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          geohash?: string | null
          id?: string
          lat: number
          lng: number
          location?: unknown
          merged_into_report_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          privacy_note?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          triaged_at?: string | null
          triaged_by_user_id?: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Update: {
          after_photo_url?: string | null
          ai?: Json | null
          assigned_at?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          before_photo_path?: string | null
          before_photo_url?: string
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          geohash?: string | null
          id?: string
          lat?: number
          lng?: number
          location?: unknown
          merged_into_report_id?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          privacy_note?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          triaged_at?: string | null
          triaged_by_user_id?: string | null
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
      }
    }
    Enums: {
      activity_type: "CREATED" | "TRIAGED" | "ASSIGNED" | "UNASSIGNED" | "STATUS_CHANGE" | "COMPLETED" | "MERGED" | "COMMENT"
      ai_status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED"
      priority_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      report_status: "NEW" | "TRIAGED" | "ASSIGNED" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "REJECTED"
      report_type: "OVERFLOW" | "ILLEGAL_DUMP" | "MISSED_PICKUP"
    }
  }
}

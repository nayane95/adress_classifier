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
      jobs: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          filename: string
          file_path: string
          status: 'PENDING' | 'PARSING' | 'RULES' | 'ENRICHING' | 'AI_CLASSIFYING' | 'COMPLETED' | 'FAILED'
          total_rows: number
          processed_rows: number
          ai_rows: number
          ai_usage_percent: number
          avg_confidence: number
          needs_review_count: number
          search_calls_count: number
          ai_tokens_estimate: number
          ai_cost_estimate: number | null
          current_step: string | null
          current_batch_index: number | null
          error_message: string | null
          language: 'en' | 'fr'
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          filename: string
          file_path: string
          status?: 'PENDING' | 'PARSING' | 'RULES' | 'ENRICHING' | 'AI_CLASSIFYING' | 'COMPLETED' | 'FAILED'
          total_rows?: number
          processed_rows?: number
          ai_rows?: number
          ai_usage_percent?: number
          avg_confidence?: number
          needs_review_count?: number
          search_calls_count?: number
          ai_tokens_estimate?: number
          ai_cost_estimate?: number | null
          current_step?: string | null
          current_batch_index?: number | null
          error_message?: string | null
          language?: 'en' | 'fr'
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          filename?: string
          file_path?: string
          status?: 'PENDING' | 'PARSING' | 'RULES' | 'ENRICHING' | 'AI_CLASSIFYING' | 'COMPLETED' | 'FAILED'
          total_rows?: number
          processed_rows?: number
          ai_rows?: number
          ai_usage_percent?: number
          avg_confidence?: number
          needs_review_count?: number
          search_calls_count?: number
          ai_tokens_estimate?: number
          ai_cost_estimate?: number | null
          current_step?: string | null
          current_batch_index?: number | null
          error_message?: string | null
          language?: 'en' | 'fr'
        }
      }
      job_rows: {
        Row: {
          id: string
          job_id: string
          row_index: number
          raw_json: Json
          normalized_json: Json
          final_category: 'CLIENT' | 'PRESCRIBER' | 'SUPPLIER' | 'A_QUALIFIER' | null
          confidence: number | null
          reason_en: string | null
          reason_fr: string | null
          public_signals_en: string | null
          public_signals_fr: string | null
          needs_review: boolean
          classification_method: 'RULES' | 'AI' | 'HYBRID' | null
          ai_used: boolean
          model_used: string | null
          ai_attempts: number
          enrichment_status: 'SEARCHING' | 'CLASSIFYING' | 'DONE' | 'FAILED' | null
          enrichment_attempts: number
          enrichment_json: Json | null
          manual_override: boolean
          last_processing_step: 'PARSE' | 'RULES' | 'ENRICH' | 'AI' | 'EXPORT' | null
          row_status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
          edited_by: string | null
          edited_at: string | null
          previous_value: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          row_index: number
          raw_json: Json
          normalized_json: Json
          final_category?: 'CLIENT' | 'PRESCRIBER' | 'SUPPLIER' | 'A_QUALIFIER' | null
          confidence?: number | null
          reason_en?: string | null
          reason_fr?: string | null
          public_signals_en?: string | null
          public_signals_fr?: string | null
          needs_review?: boolean
          classification_method?: 'RULES' | 'AI' | 'HYBRID' | null
          ai_used?: boolean
          model_used?: string | null
          ai_attempts?: number
          enrichment_status?: 'SEARCHING' | 'CLASSIFYING' | 'DONE' | 'FAILED' | null
          enrichment_attempts?: number
          enrichment_json?: Json | null
          manual_override?: boolean
          last_processing_step?: 'PARSE' | 'RULES' | 'ENRICH' | 'AI' | 'EXPORT' | null
          row_status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
          edited_by?: string | null
          edited_at?: string | null
          previous_value?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          row_index?: number
          raw_json?: Json
          normalized_json?: Json
          final_category?: 'CLIENT' | 'PRESCRIBER' | 'SUPPLIER' | 'A_QUALIFIER' | null
          confidence?: number | null
          reason_en?: string | null
          reason_fr?: string | null
          public_signals_en?: string | null
          public_signals_fr?: string | null
          needs_review?: boolean
          classification_method?: 'RULES' | 'AI' | 'HYBRID' | null
          ai_used?: boolean
          model_used?: string | null
          ai_attempts?: number
          enrichment_status?: 'SEARCHING' | 'CLASSIFYING' | 'DONE' | 'FAILED' | null
          enrichment_attempts?: number
          enrichment_json?: Json | null
          manual_override?: boolean
          last_processing_step?: 'PARSE' | 'RULES' | 'ENRICH' | 'AI' | 'EXPORT' | null
          row_status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
          edited_by?: string | null
          edited_at?: string | null
          previous_value?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      enrichment_cache: {
        Row: {
          id: string
          cache_key: string
          enrichment_data: Json
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          cache_key: string
          enrichment_data: Json
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          cache_key?: string
          enrichment_data?: Json
          created_at?: string
          expires_at?: string
        }
      }
      ai_cache: {
        Row: {
          id: string
          input_hash: string
          response_data: Json
          model_used: string
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          input_hash: string
          response_data: Json
          model_used: string
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          input_hash?: string
          response_data?: Json
          model_used?: string
          created_at?: string
          expires_at?: string
        }
      }
      activity_feed: {
        Row: {
          id: string
          job_id: string
          message: string
          message_type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          message: string
          message_type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          message?: string
          message_type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
          metadata?: Json | null
          created_at?: string
        }
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
  }
}

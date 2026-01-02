export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Teaching methodology type - matches values in RAG system
export type TeachingMethodology =
  | 'standard'        // Default - balanced approach
  | 'singapore'       // Singapore Math / Bar Model / CPA
  | 'traditional'     // Traditional / Direct Instruction / Algorithm-focused
  | 'common-core'     // Common Core - conceptual + procedural balance
  | 'montessori'      // Montessori - hands-on, concrete materials
  | 'saxon'           // Saxon Math - incremental, spiral review
  | 'classical'       // Classical Education - Trivium/Quadrivium
  | 'waldorf'         // Waldorf/Steiner - artistic, movement-based

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          school_name: string | null
          grade_level: string | null
          teaching_methodology: TeachingMethodology | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          school_name?: string | null
          grade_level?: string | null
          teaching_methodology?: TeachingMethodology | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          school_name?: string | null
          grade_level?: string | null
          teaching_methodology?: TeachingMethodology | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          date: string
          is_archived: boolean
          grade_level: string | null
          teaching_methodology: TeachingMethodology | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          date?: string
          is_archived?: boolean
          grade_level?: string | null
          teaching_methodology?: TeachingMethodology | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          date?: string
          is_archived?: boolean
          grade_level?: string | null
          teaching_methodology?: TeachingMethodology | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      student_roster: {
        Row: {
          id: string
          user_id: string
          name: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_roster_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_answer_keys: {
        Row: {
          id: string
          project_id: string
          type: 'image' | 'pdf' | 'manual'
          storage_path: string | null
          answers: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type: 'image' | 'pdf' | 'manual'
          storage_path?: string | null
          answers?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: 'image' | 'pdf' | 'manual'
          storage_path?: string | null
          answers?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_answer_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      submissions: {
        Row: {
          id: string
          project_id: string
          student_id: string | null
          storage_path: string
          original_filename: string | null
          page_number: number
          status: 'pending' | 'processing' | 'completed' | 'needs_review' | 'failed'
          detected_name: string | null
          name_confidence: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          student_id?: string | null
          storage_path: string
          original_filename?: string | null
          page_number?: number
          status?: 'pending' | 'processing' | 'completed' | 'needs_review' | 'failed'
          detected_name?: string | null
          name_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          student_id?: string | null
          storage_path?: string
          original_filename?: string | null
          page_number?: number
          status?: 'pending' | 'processing' | 'completed' | 'needs_review' | 'failed'
          detected_name?: string | null
          name_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_roster"
            referencedColumns: ["id"]
          }
        ]
      }
      graded_results: {
        Row: {
          id: string
          submission_id: string
          score: number | null
          max_score: number | null
          percentage: number | null
          problems: Json | null
          overall_confidence: number | null
          feedback: string | null
          raw_ocr_text: string | null
          ai_provider: string | null
          processing_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          score?: number | null
          max_score?: number | null
          problems?: Json | null
          overall_confidence?: number | null
          feedback?: string | null
          raw_ocr_text?: string | null
          ai_provider?: string | null
          processing_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          score?: number | null
          max_score?: number | null
          problems?: Json | null
          overall_confidence?: number | null
          feedback?: string | null
          raw_ocr_text?: string | null
          ai_provider?: string | null
          processing_time_ms?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "graded_results_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          }
        ]
      }
      processing_queue: {
        Row: {
          id: string
          submission_id: string
          status: 'queued' | 'processing' | 'completed' | 'failed'
          priority: number
          attempts: number
          max_attempts: number
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          priority?: number
          attempts?: number
          max_attempts?: number
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          priority?: number
          attempts?: number
          max_attempts?: number
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          }
        ]
      }
      token_ledger: {
        Row: {
          id: string
          user_id: string
          amount: number
          balance_after: number
          operation: 'signup_bonus' | 'submission' | 'refund' | 'purchase' | 'admin_grant'
          reference_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          balance_after: number
          operation: 'signup_bonus' | 'submission' | 'refund' | 'purchase' | 'admin_grant'
          reference_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          balance_after?: number
          operation?: 'signup_bonus' | 'submission' | 'refund' | 'purchase' | 'admin_grant'
          reference_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_token_balance: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types for common use cases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export type Student = Database['public']['Tables']['student_roster']['Row']
export type StudentInsert = Database['public']['Tables']['student_roster']['Insert']
export type StudentUpdate = Database['public']['Tables']['student_roster']['Update']

export type AnswerKey = Database['public']['Tables']['project_answer_keys']['Row']
export type AnswerKeyInsert = Database['public']['Tables']['project_answer_keys']['Insert']
export type AnswerKeyUpdate = Database['public']['Tables']['project_answer_keys']['Update']

export type Submission = Database['public']['Tables']['submissions']['Row']
export type SubmissionInsert = Database['public']['Tables']['submissions']['Insert']
export type SubmissionUpdate = Database['public']['Tables']['submissions']['Update']

export type GradedResult = Database['public']['Tables']['graded_results']['Row']
export type GradedResultInsert = Database['public']['Tables']['graded_results']['Insert']
export type GradedResultUpdate = Database['public']['Tables']['graded_results']['Update']

export type ProcessingQueueItem = Database['public']['Tables']['processing_queue']['Row']
export type ProcessingQueueInsert = Database['public']['Tables']['processing_queue']['Insert']
export type ProcessingQueueUpdate = Database['public']['Tables']['processing_queue']['Update']

export type TokenLedgerEntry = Database['public']['Tables']['token_ledger']['Row']
export type TokenLedgerInsert = Database['public']['Tables']['token_ledger']['Insert']
export type TokenLedgerUpdate = Database['public']['Tables']['token_ledger']['Update']

// Status types
export type SubmissionStatus = 'pending' | 'processing' | 'completed' | 'needs_review' | 'failed'
export type QueueStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type AnswerKeyType = 'image' | 'pdf' | 'manual'
export type TokenOperation = 'signup_bonus' | 'submission' | 'refund' | 'purchase' | 'admin_grant'

// Problem structure for graded results
export interface GradedProblem {
  number: number
  student_answer: string
  correct_answer: string
  is_correct: boolean
}

// Answer structure for answer keys
export interface AnswerKeyAnswer {
  question: number
  answer: string
}

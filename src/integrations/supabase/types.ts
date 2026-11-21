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
      assignment_submissions: {
        Row: {
          assignment_id: string
          content: string
          feedback: string
          grade: number | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          content?: string
          feedback?: string
          grade?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string
          feedback?: string
          grade?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "class_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          note: string
          status: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          attendance_date?: string
          created_at?: string
          id?: string
          note?: string
          status: string
          student_id: string
          teacher_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          note?: string
          status?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      class_assignments: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          instructions: string
          published: boolean
          subject: string
          teacher_id: string
          title: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          instructions?: string
          published?: boolean
          subject?: string
          teacher_id: string
          title: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          instructions?: string
          published?: boolean
          subject?: string
          teacher_id?: string
          title?: string
        }
        Relationships: []
      }
      class_resources: {
        Row: {
          content: string
          created_at: string
          id: string
          published: boolean
          resource_type: string
          subject: string
          teacher_id: string
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          resource_type: string
          subject?: string
          teacher_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          resource_type?: string
          subject?: string
          teacher_id?: string
          title?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          created_at: string
          exam_date: string
          id: string
          subject_id: string
          syllabus_topics: string
          target_marks: number | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_date: string
          id?: string
          subject_id: string
          syllabus_topics?: string
          target_marks?: number | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          id?: string
          subject_id?: string
          syllabus_topics?: string
          target_marks?: number | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_email: string | null
          created_at: string
          daily_study_hours: number
          display_name: string | null
          id: string
          preferred_time: string
          user_id: string
          weekly_off_day: string
        }
        Insert: {
          account_email?: string | null
          created_at?: string
          daily_study_hours?: number
          display_name?: string | null
          id?: string
          preferred_time?: string
          user_id: string
          weekly_off_day?: string
        }
        Update: {
          account_email?: string | null
          created_at?: string
          daily_study_hours?: number
          display_name?: string | null
          id?: string
          preferred_time?: string
          user_id?: string
          weekly_off_day?: string
        }
        Relationships: []
      }
      reservable_resources: {
        Row: {
          category: string
          created_at: string
          details: string
          id: string
          is_available: boolean
          location: string
          name: string
          teacher_id: string
        }
        Insert: {
          category: string
          created_at?: string
          details?: string
          id?: string
          is_available?: boolean
          location?: string
          name: string
          teacher_id: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          is_available?: boolean
          location?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      resource_reservations: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          note: string
          resource_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          starts_at: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          note?: string
          resource_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          note?: string
          resource_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_reservations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "reservable_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          notes: string
          start_time: string
          status: string
          subject_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string
          id?: string
          notes?: string
          start_time?: string
          status?: string
          subject_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          notes?: string
          start_time?: string
          status?: string
          subject_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          basics_level: string
          color: string
          created_at: string
          difficulty: number
          id: string
          name: string
          priority: number
          user_id: string
        }
        Insert: {
          basics_level?: string
          color?: string
          created_at?: string
          difficulty?: number
          id?: string
          name: string
          priority?: number
          user_id: string
        }
        Update: {
          basics_level?: string
          color?: string
          created_at?: string
          difficulty?: number
          id?: string
          name?: string
          priority?: number
          user_id?: string
        }
        Relationships: []
      }
      teacher_students: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          estimated_hours: number
          id: string
          is_basic: boolean
          status: string
          subject_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_hours?: number
          id?: string
          is_basic?: boolean
          status?: string
          subject_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_hours?: number
          id?: string
          is_basic?: boolean
          status?: string
          subject_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      can_review_reservation: {
        Args: { _reservation_id: string }
        Returns: boolean
      }
      can_student_reserve_resource: {
        Args: { _resource_id: string }
        Returns: boolean
      }
      is_assigned_teacher: {
        Args: { _student_id: string; _teacher_id: string }
        Returns: boolean
      }
      is_assignment_teacher: {
        Args: { _assignment_id: string }
        Returns: boolean
      }
      is_class_teacher: { Args: { _teacher_id: string }; Returns: boolean }
      is_related_school_user: { Args: { _user_id: string }; Returns: boolean }
      is_resource_visible: { Args: { _resource_id: string }; Returns: boolean }
      is_school_admin: { Args: never; Returns: boolean }
      is_school_owner: { Args: never; Returns: boolean }
      is_student_assigned_to_assignment: {
        Args: { _assignment_id: string; _student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "school_admin" | "teacher" | "student"
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
      app_role: ["owner", "school_admin", "teacher", "student"],
    },
  },
} as const

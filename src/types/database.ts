export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          body: Json
          cover_image_alt: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          portfolio_id: string
          published: boolean
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          body: Json
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          portfolio_id: string
          published?: boolean
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          portfolio_id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          portfolio_id: string
          sender_email: string
          sender_name: string
          subject: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          portfolio_id: string
          sender_email: string
          sender_name: string
          subject?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          portfolio_id?: string
          sender_email?: string
          sender_name?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          id: number
          path: string
          portfolio_id: string
          referrer: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: never
          path: string
          portfolio_id: string
          referrer?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: never
          path?: string
          portfolio_id?: string
          referrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_settings: {
        Row: {
          color_preset: string
          dribbble_url: string | null
          email_public: string | null
          favicon_url: string | null
          font_preset: string
          github_url: string | null
          id: string
          linkedin_url: string | null
          meta_description: string | null
          og_image_url: string | null
          page_title: string | null
          portfolio_id: string
          theme_mode: string
          twitter_url: string | null
          updated_at: string
          visitor_theme_toggle: boolean
          website_url: string | null
        }
        Insert: {
          color_preset?: string
          dribbble_url?: string | null
          email_public?: string | null
          favicon_url?: string | null
          font_preset?: string
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          page_title?: string | null
          portfolio_id: string
          theme_mode?: string
          twitter_url?: string | null
          updated_at?: string
          visitor_theme_toggle?: boolean
          website_url?: string | null
        }
        Update: {
          color_preset?: string
          dribbble_url?: string | null
          email_public?: string | null
          favicon_url?: string | null
          font_preset?: string
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          page_title?: string | null
          portfolio_id?: string
          theme_mode?: string
          twitter_url?: string | null
          updated_at?: string
          visitor_theme_toggle?: boolean
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_settings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: true
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_settings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: true
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          id: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string
          headline: string | null
          id: string
          locked: boolean
          locked_reason: string | null
          published: boolean
          resume_url: string | null
          role: string
          storage_used_bytes: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email: string
          headline?: string | null
          id: string
          locked?: boolean
          locked_reason?: string | null
          published?: boolean
          resume_url?: string | null
          role?: string
          storage_used_bytes?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string
          headline?: string | null
          id?: string
          locked?: boolean
          locked_reason?: string | null
          published?: boolean
          resume_url?: string | null
          role?: string
          storage_used_bytes?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          subject: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
          subject: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
          subject?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          portfolio_id: string
          reason: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          portfolio_id: string
          reason: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          portfolio_id?: string
          reason?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      section_history: {
        Row: {
          content: Json
          created_at: string
          id: string
          section_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          section_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_history_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "public_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_history_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          content: Json
          created_at: string
          id: string
          portfolio_id: string
          sort_order: number
          type: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          portfolio_id: string
          sort_order?: number
          type: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          portfolio_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_premium: boolean
          name: string
          slug: string
          spec: Json
          three_js_enabled: boolean
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name: string
          slug: string
          spec: Json
          three_js_enabled?: boolean
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name?: string
          slug?: string
          spec?: Json
          three_js_enabled?: boolean
          thumbnail_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_blog_posts: {
        Row: {
          body: Json | null
          cover_image_alt: string | null
          cover_image_url: string | null
          excerpt: string | null
          id: string | null
          meta_description: string | null
          meta_title: string | null
          portfolio_id: string | null
          published_at: string | null
          slug: string | null
          tags: string[] | null
          title: string | null
        }
        Insert: {
          body?: Json | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          excerpt?: string | null
          id?: string | null
          meta_description?: string | null
          meta_title?: string | null
          portfolio_id?: string | null
          published_at?: string | null
          slug?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Update: {
          body?: Json | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          excerpt?: string | null
          id?: string | null
          meta_description?: string | null
          meta_title?: string | null
          portfolio_id?: string | null
          published_at?: string | null
          slug?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      public_portfolio_settings: {
        Row: {
          color_preset: string | null
          dribbble_url: string | null
          email_public: string | null
          favicon_url: string | null
          font_preset: string | null
          github_url: string | null
          linkedin_url: string | null
          meta_description: string | null
          og_image_url: string | null
          page_title: string | null
          portfolio_id: string | null
          theme_mode: string | null
          twitter_url: string | null
          visitor_theme_toggle: boolean | null
          website_url: string | null
        }
        Insert: {
          color_preset?: string | null
          dribbble_url?: string | null
          email_public?: string | null
          favicon_url?: string | null
          font_preset?: string | null
          github_url?: string | null
          linkedin_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          page_title?: string | null
          portfolio_id?: string | null
          theme_mode?: string | null
          twitter_url?: string | null
          visitor_theme_toggle?: boolean | null
          website_url?: string | null
        }
        Update: {
          color_preset?: string | null
          dribbble_url?: string | null
          email_public?: string | null
          favicon_url?: string | null
          font_preset?: string | null
          github_url?: string | null
          linkedin_url?: string | null
          meta_description?: string | null
          og_image_url?: string | null
          page_title?: string | null
          portfolio_id?: string | null
          theme_mode?: string | null
          twitter_url?: string | null
          visitor_theme_toggle?: boolean | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_settings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: true
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_settings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: true
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      public_portfolios: {
        Row: {
          created_at: string | null
          id: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          headline: string | null
          id: string | null
          published: boolean | null
          resume_url: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          headline?: string | null
          id?: string | null
          published?: boolean | null
          resume_url?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          headline?: string | null
          id?: string | null
          published?: boolean | null
          resume_url?: string | null
          username?: string | null
        }
        Relationships: []
      }
      public_sections: {
        Row: {
          content: Json | null
          id: string | null
          portfolio_id: string | null
          sort_order: number | null
          type: string | null
          visible: boolean | null
        }
        Insert: {
          content?: Json | null
          id?: string | null
          portfolio_id?: string | null
          sort_order?: number | null
          type?: string | null
          visible?: boolean | null
        }
        Update: {
          content?: Json | null
          id?: string | null
          portfolio_id?: string | null
          sort_order?: number | null
          type?: string | null
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "public_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      blog_post_is_public: {
        Args: { p_blog_post_id: string }
        Returns: boolean
      }
      initialize_portfolio: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      portfolio_is_public: {
        Args: { p_portfolio_id: string }
        Returns: boolean
      }
      profile_is_public: { Args: { p_user_id: string }; Returns: boolean }
      reorder_sections: {
        Args: { p_ordered_ids: string[]; p_portfolio_id: string }
        Returns: undefined
      }
      request_account_deletion: { Args: never; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


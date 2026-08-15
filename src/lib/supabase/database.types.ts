export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          cep: string;
          city: string;
          complement: string | null;
          created_at: string;
          customer_id: string;
          district: string | null;
          id: string;
          is_default: boolean;
          label: string | null;
          number: string | null;
          state: string;
          street: string;
        };
        Insert: {
          cep: string;
          city: string;
          complement?: string | null;
          created_at?: string;
          customer_id: string;
          district?: string | null;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          number?: string | null;
          state: string;
          street: string;
        };
        Update: {
          cep?: string;
          city?: string;
          complement?: string | null;
          created_at?: string;
          customer_id?: string;
          district?: string | null;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          number?: string | null;
          state?: string;
          street?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      admins: {
        Row: {
          created_at: string;
          full_name: string | null;
          must_change_password: boolean;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          must_change_password?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          must_change_password?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_label: string | null;
          entity_type: string | null;
          id: number;
          ip: string | null;
          metadata: Json;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_label?: string | null;
          entity_type?: string | null;
          id?: never;
          ip?: string | null;
          metadata?: Json;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_label?: string | null;
          entity_type?: string | null;
          id?: never;
          ip?: string | null;
          metadata?: Json;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          id: string;
          qty: number;
          variant_id: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          qty: number;
          variant_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
          qty?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          customer_id: string | null;
          id: string;
          session_token: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          session_token?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          session_token?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          kind: string;
          microvix_id: string;
          name: string;
          parent_id: string | null;
          source_timestamp: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind?: string;
          microvix_id: string;
          name: string;
          parent_id?: string | null;
          source_timestamp?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          microvix_id?: string;
          name?: string;
          parent_id?: string | null;
          source_timestamp?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      colors: {
        Row: {
          created_at: string;
          hex: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          hex?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          hex?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          expires_at: string | null;
          max_uses: number | null;
          min_subtotal: number;
          percent_off: number;
          used_count: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          expires_at?: string | null;
          max_uses?: number | null;
          min_subtotal?: number;
          percent_off: number;
          used_count?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          expires_at?: string | null;
          max_uses?: number | null;
          min_subtotal?: number;
          percent_off?: number;
          used_count?: number;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          cpf: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          microvix_id: string | null;
          phone: string | null;
        };
        Insert: {
          cpf?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          microvix_id?: string | null;
          phone?: string | null;
        };
        Update: {
          cpf?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          microvix_id?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      home_sections: {
        Row: {
          active: boolean;
          created_at: string;
          data: Json;
          id: string;
          kind: string;
          name: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          data?: Json;
          id?: string;
          kind: string;
          name?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          data?: Json;
          id?: string;
          kind?: string;
          name?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      measurement_models: {
        Row: {
          columns: Json;
          created_at: string;
          id: string;
          name: string;
          note_bottom: string | null;
          note_top: string | null;
          rows: Json;
          updated_at: string;
        };
        Insert: {
          columns?: Json;
          created_at?: string;
          id?: string;
          name: string;
          note_bottom?: string | null;
          note_top?: string | null;
          rows?: Json;
          updated_at?: string;
        };
        Update: {
          columns?: Json;
          created_at?: string;
          id?: string;
          name?: string;
          note_bottom?: string | null;
          note_top?: string | null;
          rows?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          created_at: string;
          email: string;
          source: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          source?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          source?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_name: string;
          qty: number;
          unit_price: number;
          variant_id: string;
          variant_label: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_name: string;
          qty: number;
          unit_price: number;
          variant_id: string;
          variant_label?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_name?: string;
          qty?: number;
          unit_price?: number;
          variant_id?: string;
          variant_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          channel: string;
          coupon_code: string | null;
          created_at: string;
          customer_id: string | null;
          discount: number;
          id: string;
          microvix_order_id: string | null;
          microvix_synced_at: string | null;
          number: number;
          payment_status: string;
          seen_at: string | null;
          shipping_address: Json | null;
          shipping_cost: number;
          shipping_method: string | null;
          shipping_service: string | null;
          shipping_total: number;
          status: string;
          subtotal: number;
          total: number;
          tracking_code: string | null;
          updated_at: string;
        };
        Insert: {
          channel?: string;
          coupon_code?: string | null;
          created_at?: string;
          customer_id?: string | null;
          discount?: number;
          id?: string;
          microvix_order_id?: string | null;
          microvix_synced_at?: string | null;
          number?: number;
          payment_status?: string;
          seen_at?: string | null;
          shipping_address?: Json | null;
          shipping_cost?: number;
          shipping_method?: string | null;
          shipping_service?: string | null;
          shipping_total?: number;
          status?: string;
          subtotal?: number;
          total?: number;
          tracking_code?: string | null;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          coupon_code?: string | null;
          created_at?: string;
          customer_id?: string | null;
          discount?: number;
          id?: string;
          microvix_order_id?: string | null;
          microvix_synced_at?: string | null;
          number?: number;
          payment_status?: string;
          seen_at?: string | null;
          shipping_address?: Json | null;
          shipping_cost?: number;
          shipping_method?: string | null;
          shipping_service?: string | null;
          shipping_total?: number;
          status?: string;
          subtotal?: number;
          total?: number;
          tracking_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_id: string;
          provider: string;
          provider_id: string;
          raw: Json | null;
          status: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          order_id: string;
          provider: string;
          provider_id: string;
          raw?: Json | null;
          status?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id?: string;
          provider?: string;
          provider_id?: string;
          raw?: Json | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      prices: {
        Row: {
          id: string;
          price: number;
          promo_price: number | null;
          source_timestamp: number | null;
          tabela_id: string;
          updated_at: string;
          valid_from: string | null;
          valid_to: string | null;
          variant_id: string;
        };
        Insert: {
          id?: string;
          price: number;
          promo_price?: number | null;
          source_timestamp?: number | null;
          tabela_id?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          variant_id: string;
        };
        Update: {
          id?: string;
          price?: number;
          promo_price?: number | null;
          source_timestamp?: number | null;
          tabela_id?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prices_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_colors: {
        Row: {
          color_id: string;
          created_at: string;
          gallery: Json;
          id: string;
          product_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          color_id: string;
          created_at?: string;
          gallery?: Json;
          id?: string;
          product_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          color_id?: string;
          created_at?: string;
          gallery?: Json;
          id?: string;
          product_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_colors_color_id_fkey";
            columns: ["color_id"];
            isOneToOne: false;
            referencedRelation: "colors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_colors_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_content: {
        Row: {
          featured: boolean;
          gallery: Json;
          meta_description: string | null;
          meta_title: string | null;
          product_id: string;
          rich_description: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          featured?: boolean;
          gallery?: Json;
          meta_description?: string | null;
          meta_title?: string | null;
          product_id: string;
          rich_description?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          featured?: boolean;
          gallery?: Json;
          meta_description?: string | null;
          meta_title?: string | null;
          product_id?: string;
          rich_description?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_content_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          color: string | null;
          ean: string | null;
          id: string;
          microvix_id: string;
          product_color_id: string | null;
          product_id: string;
          size: string | null;
          source_timestamp: number | null;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          ean?: string | null;
          id?: string;
          microvix_id: string;
          product_color_id?: string | null;
          product_id: string;
          size?: string | null;
          source_timestamp?: number | null;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          ean?: string | null;
          id?: string;
          microvix_id?: string;
          product_color_id?: string | null;
          product_id?: string;
          size?: string | null;
          source_timestamp?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_color_id_fkey";
            columns: ["product_color_id"];
            isOneToOne: false;
            referencedRelation: "product_colors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active_ecommerce: boolean;
          brand: string | null;
          category_id: string | null;
          category_name: string | null;
          effective_price: number | null;
          id: string;
          measurement_model_id: string | null;
          microvix_id: string;
          name: string;
          name_search: string | null;
          ncm: string | null;
          price: number | null;
          promo_price: number | null;
          reference: string | null;
          source_timestamp: number | null;
          updated_at: string;
          weight_grams: number | null;
        };
        Insert: {
          active_ecommerce?: boolean;
          brand?: string | null;
          category_id?: string | null;
          category_name?: string | null;
          effective_price?: number | null;
          id?: string;
          measurement_model_id?: string | null;
          microvix_id: string;
          name: string;
          name_search?: string | null;
          ncm?: string | null;
          price?: number | null;
          promo_price?: number | null;
          reference?: string | null;
          source_timestamp?: number | null;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Update: {
          active_ecommerce?: boolean;
          brand?: string | null;
          category_id?: string | null;
          category_name?: string | null;
          effective_price?: number | null;
          id?: string;
          measurement_model_id?: string | null;
          microvix_id?: string;
          name?: string;
          name_search?: string | null;
          ncm?: string | null;
          price?: number | null;
          promo_price?: number | null;
          reference?: string | null;
          source_timestamp?: number | null;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_measurement_model_id_fkey";
            columns: ["measurement_model_id"];
            isOneToOne: false;
            referencedRelation: "measurement_models";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          cart_id: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          qty: number;
          variant_id: string;
        };
        Insert: {
          cart_id?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          qty: number;
          variant_id: string;
        };
        Update: {
          cart_id?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          qty?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_alerts: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          notified_at: string | null;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          notified_at?: string | null;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          notified_at?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_alerts_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_cache: {
        Row: {
          deposito_id: string;
          id: string;
          last_synced_at: string;
          qty_available: number;
          source_timestamp: number | null;
          variant_id: string;
        };
        Insert: {
          deposito_id: string;
          id?: string;
          last_synced_at?: string;
          qty_available?: number;
          source_timestamp?: number | null;
          variant_id: string;
        };
        Update: {
          deposito_id?: string;
          id?: string;
          last_synced_at?: string;
          qty_available?: number;
          source_timestamp?: number | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_cache_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_runs: {
        Row: {
          error: string | null;
          finished_at: string | null;
          id: string;
          method: string;
          ok: boolean | null;
          rows_affected: number | null;
          started_at: string;
        };
        Insert: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          method: string;
          ok?: boolean | null;
          rows_affected?: number | null;
          started_at?: string;
        };
        Update: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          method?: string;
          ok?: boolean | null;
          rows_affected?: number | null;
          started_at?: string;
        };
        Relationships: [];
      };
      sync_state: {
        Row: {
          method: string;
          updated_at: string;
          watermark: number;
        };
        Insert: {
          method: string;
          updated_at?: string;
          watermark?: number;
        };
        Update: {
          method?: string;
          updated_at?: string;
          watermark?: number;
        };
        Relationships: [];
      };
      wishlist: {
        Row: {
          created_at: string;
          customer_id: string;
          product_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          product_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      decrement_stock: {
        Args: { p_qty: number; p_variant_id: string };
        Returns: number;
      };
      email_exists: { Args: { p_email: string }; Returns: boolean };
      imm_unaccent: { Args: { "": string }; Returns: string };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: "owner" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin"],
    },
  },
} as const;

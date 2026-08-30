// GERADO pelo Supabase (MCP: generate_typescript_types).
// Regerar a cada mudança de schema — não editar à mão.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categorias: {
        Row: { id: string; nome: string; ordem: number }
        Insert: { id?: string; nome: string; ordem?: number }
        Update: { id?: string; nome?: string; ordem?: number }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          cidade: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          observacao: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          criado_por?: string | null
          id?: string
          nome: string
          observacao?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          nome?: string
          observacao?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      estoque_movimentos: {
        Row: {
          criado_em: string
          criado_por: string | null
          id: string
          motivo: string | null
          produto_id: string
          quantidade: number
          tipo: string
          venda_id: string | null
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          produto_id: string
          quantidade: number
          tipo: string
          venda_id?: string | null
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          motivo?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: string
          venda_id?: string | null
        }
        Relationships: []
      }
      loja_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          id: boolean
          nome_loja: string
          whatsapp: string | null
          whatsapp_ativo: boolean
          whatsapp_publico: string | null
          whatsapp_testado_em: string | null
        }
        Insert: {
          id?: boolean
          nome_loja?: string
          whatsapp?: string | null
          whatsapp_ativo?: boolean
          whatsapp_testado_em?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          nome_loja?: string
          whatsapp?: string | null
          whatsapp_ativo?: boolean
          whatsapp_testado_em?: string | null
        }
        Relationships: []
      }
      perfis: {
        Row: { ativo: boolean; criado_em: string; id: string; nome: string; papel: string }
        Insert: { ativo?: boolean; criado_em?: string; id: string; nome: string; papel: string }
        Update: { ativo?: boolean; criado_em?: string; id?: string; nome?: string; papel?: string }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          cor: string
          criado_em: string
          descricao: string | null
          disponivel: boolean | null
          estoque_atual: number
          estoque_minimo: number
          foto_url: string | null
          id: string
          modelo: string
          no_catalogo: boolean
          preco_centavos: number
          sku: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          cor: string
          criado_em?: string
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          modelo: string
          no_catalogo?: boolean
          preco_centavos: number
          sku: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          cor?: string
          criado_em?: string
          descricao?: string | null
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          modelo?: string
          no_catalogo?: boolean
          preco_centavos?: number
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_itens: {
        Row: {
          id: string
          preco_unitario_centavos: number
          produto_id: string
          quantidade: number
          subtotal_centavos: number | null
          venda_id: string
        }
        Insert: {
          id?: string
          preco_unitario_centavos: number
          produto_id: string
          quantidade: number
          venda_id: string
        }
        Update: {
          id?: string
          preco_unitario_centavos?: number
          produto_id?: string
          quantidade?: number
          venda_id?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          assinatura: string | null
          cliente_id: string | null
          cliente_nome: string | null
          criada_em: string
          forma_pagamento: string
          id: string
          idempotency_key: string | null
          numero: number
          observacao: string | null
          origem: string
          total_centavos: number
          vendedor_id: string
        }
        Insert: {
          assinatura?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          criada_em?: string
          forma_pagamento: string
          id?: string
          idempotency_key?: string | null
          numero?: never
          observacao?: string | null
          origem?: string
          total_centavos?: number
          vendedor_id: string
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          forma_pagamento?: string
          observacao?: string | null
          origem?: string
          total_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      catalogo_publico: {
        Row: {
          categoria: string | null
          cor: string | null
          descricao: string | null
          disponivel: boolean | null
          foto_url: string | null
          id: string | null
          modelo: string | null
          preco_centavos: number | null
          sku: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      faturamento_por_produto: {
        Args: { _ate: string; _de: string }
        Returns: {
          categoria: string
          cor: string
          modelo: string
          participacao: number
          produto_id: string
          quantidade: number
          sku: string
          total_centavos: number
        }[]
      }
      registrar_entrada_estoque: {
        Args: { _motivo?: string; _produto_id: string; _quantidade: number }
        Returns: string
      }
      registrar_venda: {
        Args: {
          _cliente_id?: string
          _cliente_nome?: string
          _forma_pagamento: string
          _idempotency_key?: string
          _itens: Json
          _observacao?: string
          _origem?: string
        }
        Returns: string
      }
      resumo_faturamento: {
        Args: { _ate: string; _de: string }
        Returns: {
          pecas: number
          ticket_centavos: number
          total_centavos: number
          vendas: number
        }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Produto = PublicSchema["Tables"]["produtos"]["Row"]
export type Categoria = PublicSchema["Tables"]["categorias"]["Row"]
export type Perfil = PublicSchema["Tables"]["perfis"]["Row"]
export type Cliente = PublicSchema["Tables"]["clientes"]["Row"]
export type LojaConfig = PublicSchema["Tables"]["loja_config"]["Row"]
export type Venda = PublicSchema["Tables"]["vendas"]["Row"]
export type VendaItem = PublicSchema["Tables"]["venda_itens"]["Row"]
export type Movimento = PublicSchema["Tables"]["estoque_movimentos"]["Row"]
export type ItemCatalogo = PublicSchema["Views"]["catalogo_publico"]["Row"]
export type LinhaFaturamento = PublicSchema["Functions"]["faturamento_por_produto"]["Returns"][number]
export type ResumoFaturamento = PublicSchema["Functions"]["resumo_faturamento"]["Returns"][number]

export type Papel = "dono" | "vendedor"
export type FormaPagamento = "dinheiro" | "pix" | "debito" | "credito"

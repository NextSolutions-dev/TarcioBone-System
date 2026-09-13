import type { VariacaoCatalogo } from "@/lib/supabase/types"

/** Variação como a loja pública enxerga: sem saldo (só `disponivel`), com o
 *  preço de atacado já no lugar do preço. A view devolve tudo anulável porque o
 *  Postgres não prova nulidade de view — aqui a linha incompleta é descartada
 *  uma vez, na entrada, em vez de cada tela checar campo por campo. */
export type VariacaoLoja = {
  id: string
  sku: string
  modelo_id: string
  modelo: string
  descricao: string | null
  categoria: string
  cor: string
  tamanho: string
  preco_centavos: number
  disponivel: boolean
}

export function paraVariacaoLoja(linhas: VariacaoCatalogo[]): VariacaoLoja[] {
  return linhas.flatMap((l) =>
    l.id && l.sku && l.modelo_id && l.modelo && l.cor && l.tamanho && l.preco_centavos !== null
      ? [
          {
            id: l.id,
            sku: l.sku,
            modelo_id: l.modelo_id,
            modelo: l.modelo,
            descricao: l.descricao,
            categoria: l.categoria ?? "Sem categoria",
            cor: l.cor,
            tamanho: l.tamanho,
            preco_centavos: l.preco_centavos,
            disponivel: Boolean(l.disponivel),
          },
        ]
      : [],
  )
}

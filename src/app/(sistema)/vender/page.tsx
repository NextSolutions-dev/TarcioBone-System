import { criarClienteServidor } from "@/lib/supabase/server"
import type { Cliente, ModeloFoto, Produto } from "@/lib/supabase/types"

import { TelaVender } from "./tela-vender"

export const metadata = { title: "Vender" }

export default async function PaginaVender() {
  const supabase = await criarClienteServidor()

  // Variações ativas + as fotos de cada cor: a tela agrupa em produto → cor →
  // tamanho do mesmo jeito que o catálogo.
  const [produtosRes, fotosRes, clientesRes] = await Promise.all([
    supabase.from("produtos").select("*").eq("ativo", true).order("modelo").order("cor"),
    supabase.from("modelo_fotos").select("*").order("ordem"),
    supabase.from("clientes").select("*").eq("ativo", true).order("nome").limit(300),
  ])

  return (
    <TelaVender
      produtos={(produtosRes.data ?? []) as Produto[]}
      fotos={(fotosRes.data ?? []) as ModeloFoto[]}
      clientes={(clientesRes.data ?? []) as Cliente[]}
    />
  )
}

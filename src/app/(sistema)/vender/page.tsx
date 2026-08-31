import { criarClienteServidor } from "@/lib/supabase/server"
import type { Cliente, Produto } from "@/lib/supabase/types"

import { TelaVender } from "./tela-vender"

export const metadata = { title: "Vender" }

export default async function PaginaVender() {
  const supabase = await criarClienteServidor()

  const [produtosRes, clientesRes] = await Promise.all([
    supabase.from("produtos").select("*").eq("ativo", true).order("modelo").order("cor"),
    supabase.from("clientes").select("*").eq("ativo", true).order("nome").limit(300),
  ])

  return (
    <TelaVender
      produtos={(produtosRes.data ?? []) as Produto[]}
      clientes={(clientesRes.data ?? []) as Cliente[]}
    />
  )
}

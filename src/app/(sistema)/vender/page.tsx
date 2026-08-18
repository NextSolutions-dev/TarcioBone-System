import { criarClienteServidor } from "@/lib/supabase/server"
import type { Produto } from "@/lib/supabase/types"

import { TelaVender } from "./tela-vender"

export const metadata = { title: "Vender" }

export default async function PaginaVender() {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from("produtos")
    .select("*")
    .eq("ativo", true)
    .order("modelo")
    .order("cor")

  return <TelaVender produtos={(data ?? []) as Produto[]} />
}

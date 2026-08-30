import { redirect } from "next/navigation"

import { Titulo } from "@/lib/componentes"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import type { LojaConfig } from "@/lib/supabase/types"

import { FormularioConfig } from "./formulario"

export const metadata = { title: "Configurações" }

export default async function PaginaConfiguracoes() {
  const perfil = await perfilAtual()
  // Tela de dono. A RLS já impede a escrita; isto evita a tela inútil.
  if (perfil?.papel !== "dono") redirect("/painel")

  const supabase = await criarClienteServidor()
  const { data } = await supabase.from("loja_config").select("*").eq("id", true).single()

  const config = data as LojaConfig | null
  if (!config) {
    return (
      <p className="rounded-xl border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
        Configuração da loja não encontrada. Avise a Next Solutions.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Configurações</h1>

      <div>
        <p className="font-display text-xl font-bold text-texto">Configurações da loja</p>
        <p className="text-sm text-texto-suave">
          O que muda aqui vale para o catálogo na hora — sem precisar de nós.
        </p>
      </div>

      <div className="border-b border-borda-suave pb-3">
        <Titulo>Contato e identificação</Titulo>
      </div>

      <FormularioConfig config={config} />
    </div>
  )
}

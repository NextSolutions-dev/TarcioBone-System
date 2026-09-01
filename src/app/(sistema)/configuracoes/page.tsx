import Link from "next/link"
import { redirect } from "next/navigation"

import { Cartao, Titulo } from "@/lib/componentes"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import type { Bloco, LojaConfig } from "@/lib/supabase/types"

import { EditorBlocos, EditorTextos } from "./editor-catalogo"
import { FormularioConfig } from "./formulario"

export const metadata = { title: "Ajustes" }

export default async function PaginaConfiguracoes() {
  const perfil = await perfilAtual()
  // Tela de dono. A RLS já impede a escrita; isto evita a tela inútil.
  if (perfil?.papel !== "dono") redirect("/painel")

  const supabase = await criarClienteServidor()

  const [configRes, blocosRes] = await Promise.all([
    supabase.from("loja_config").select("*").eq("id", true).single(),
    supabase.from("catalogo_blocos").select("*").order("tipo").order("ordem"),
  ])

  const config = configRes.data as LojaConfig | null
  const blocos = (blocosRes.data ?? []) as Bloco[]

  if (!config) {
    return (
      <p className="rounded-xl border border-erro/30 bg-erro-fundo px-4 py-3 text-sm text-erro">
        Configuração da loja não encontrada. Avise a Next Solutions.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Ajustes</h1>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-texto">Ajustes da loja</p>
          <p className="text-sm text-texto-suave">
            O que muda aqui vale para o catálogo na hora — sem precisar de nós.
          </p>
        </div>
        <Link
          href="/catalogo"
          target="_blank"
          className="flex h-11 items-center rounded-lg border border-borda-suave px-4 text-sm font-medium text-texto transition-colors hover:border-acento/50 hover:text-acento"
        >
          Ver o catálogo
        </Link>
      </div>

      <Cartao className="p-4">
        <div className="mb-4 border-b border-borda-suave pb-3">
          <Titulo>Contato e identificação</Titulo>
        </div>
        <FormularioConfig config={config} />
      </Cartao>

      <Cartao className="p-4">
        <div className="mb-4 border-b border-borda-suave pb-3">
          <Titulo>Textos do catálogo</Titulo>
          <p className="mt-0.5 text-xs text-texto-suave">
            É o que o cliente lê no topo do site.
          </p>
        </div>
        <EditorTextos config={config} />
      </Cartao>

      <Cartao className="p-4">
        <div className="mb-4 border-b border-borda-suave pb-3">
          <Titulo>Blocos do catálogo</Titulo>
        </div>

        <div className="space-y-8">
          <EditorBlocos
            tipo="diferencial"
            titulo="Por que comprar aqui"
            descricao="Os argumentos que aparecem entre o topo e a coleção."
            blocos={blocos.filter((b) => b.tipo === "diferencial")}
          />

          <EditorBlocos
            tipo="passo"
            titulo="Como comprar"
            descricao="O passo a passo no fim da página. A ordem segue o número do rótulo."
            blocos={blocos.filter((b) => b.tipo === "passo")}
          />
        </div>
      </Cartao>
    </div>
  )
}

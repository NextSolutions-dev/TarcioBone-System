import Link from "next/link"

import { IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { ItemCatalogo } from "@/lib/supabase/types"

import { Vitrine } from "./vitrine"

export const metadata = {
  title: "Catálogo",
  description: "Bonés Aba Reta — escolha os seus e feche o pedido pelo WhatsApp.",
}

// O visitante não tem login: esta página lê a view pública, que expõe só as
// colunas do catálogo (o saldo real nunca sai do sistema).
export const revalidate = 30

export default async function PaginaCatalogo() {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from("catalogo_publico")
    .select("*")
    .order("categoria")
    .order("modelo")

  const itens = (data ?? []) as ItemCatalogo[]
  const categorias = [...new Set(itens.map((i) => i.categoria ?? "Sem categoria"))]

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP ?? ""
  const loja = process.env.NEXT_PUBLIC_LOJA_NOME ?? "Aba Reta"

  return (
    <div className="min-h-dvh pb-32">
      {/* Cabeçalho da loja */}
      <header className="border-b border-borda-suave bg-superficie">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <p className="font-display text-lg font-extrabold uppercase tracking-[0.2em] text-marca">
            {loja}
          </p>
          <Link
            href="/login"
            className="text-xs font-medium text-texto-suave underline-offset-4 transition-colors hover:text-acento hover:underline"
          >
            Área da loja
          </Link>
        </div>
      </header>

      {/* Vitrine */}
      <section className="relative overflow-hidden bg-marca">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-acento-vivo/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] text-white sm:text-6xl">
            Boné bom
            <br />
            não precisa de vitrine chique.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-marca-texto sm:text-base">
            Escolha os modelos, monte seu pedido e finalize com a gente no WhatsApp.
            Preço e disponibilidade sempre atualizados.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <IconeWhatsApp />
              Falar com a loja
            </a>
            <p className="text-xs text-marca-texto/70">
              Entrega combinada na conversa · Pix, cartão ou dinheiro
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="sr-only">Produtos</h2>
        <Vitrine itens={itens} categorias={categorias} whatsapp={whatsapp} loja={loja} />
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-8 pt-4">
        <p className="border-t border-borda-suave pt-6 text-xs text-texto-suave">
          {loja} · Catálogo de demonstração construído pela Next Solutions.
        </p>
      </footer>
    </div>
  )
}

import Link from "next/link"
import { redirect } from "next/navigation"

import { sair } from "@/app/login/acoes"
import { IconeSair, IconeVender } from "@/lib/icones"
import { perfilAtual } from "@/lib/supabase/server"

import { NavegacaoLateral, NavegacaoMobile } from "./navegacao"

export default async function LayoutSistema({ children }: LayoutProps<"/">) {
  const perfil = await perfilAtual()
  if (!perfil) redirect("/login")

  const ehDono = perfil.papel === "dono"

  return (
    <div className="min-h-dvh">
      {/* Barra superior — clara no desktop, na cor da marca no celular */}
      <header className="sticky top-0 z-30 border-b border-borda-suave bg-marca lg:bg-superficie">
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
          <Link href="/painel" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-acento-vivo font-display text-sm font-extrabold text-marca lg:bg-marca lg:text-white"
            >
              AR
            </span>
            <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-white lg:text-marca">
              Aba Reta
            </span>
          </Link>

          <div className="flex items-center gap-2 lg:gap-4">
            <Link
              href="/vender"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-acento-vivo px-3 text-xs font-semibold text-marca transition-colors hover:bg-acento-vivo/85 lg:bg-marca lg:text-white lg:hover:bg-marca-vivo"
            >
              <IconeVender className="h-4 w-4" />
              <span className="hidden sm:inline">Nova venda</span>
              <span className="sm:hidden">Vender</span>
            </Link>

            <div className="hidden text-right leading-tight lg:block">
              <p className="text-xs font-medium text-texto">{perfil.nome}</p>
              <p className="text-[11px] capitalize text-texto-suave">{perfil.papel}</p>
            </div>

            <form action={sair}>
              <button
                type="submit"
                title="Sair"
                className="grid h-9 w-9 place-items-center rounded-lg text-marca-texto transition-colors hover:bg-white/10 lg:text-texto-suave lg:hover:bg-fundo lg:hover:text-erro"
              >
                <IconeSair />
                <span className="sr-only">Sair</span>
              </button>
            </form>
          </div>
        </div>

        <div className="bg-marca px-4 pb-2 lg:hidden">
          <NavegacaoMobile ehDono={ehDono} />
        </div>
      </header>

      <NavegacaoLateral ehDono={ehDono} />

      <main className="px-4 py-6 lg:pl-52 lg:pr-6">{children}</main>
    </div>
  )
}

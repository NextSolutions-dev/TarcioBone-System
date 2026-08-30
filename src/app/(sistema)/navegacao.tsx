"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  IconeAjustes,
  IconeEstoque,
  IconeFaturamento,
  IconePainel,
  IconeProdutos,
  IconeVendas,
  IconeVender,
} from "@/lib/icones"
import { cx } from "@/lib/utils"

type Item = {
  href: string
  nome: string
  Icone: (p: { className?: string }) => React.ReactElement
  soDono?: boolean
}

const ITENS: Item[] = [
  { href: "/painel", nome: "Painel", Icone: IconePainel },
  { href: "/vender", nome: "Vender", Icone: IconeVender },
  { href: "/vendas", nome: "Vendas", Icone: IconeVendas },
  { href: "/faturamento", nome: "Faturamento", Icone: IconeFaturamento },
  { href: "/estoque", nome: "Estoque", Icone: IconeEstoque },
  { href: "/produtos", nome: "Produtos", Icone: IconeProdutos, soDono: true },
  { href: "/configuracoes", nome: "Ajustes", Icone: IconeAjustes, soDono: true },
]

function usarItens(ehDono: boolean) {
  return ITENS.filter((item) => !item.soDono || ehDono)
}

function ativo(caminho: string, href: string) {
  return caminho === href || caminho.startsWith(`${href}/`)
}

/** Desktop: tiles fixos à esquerda. */
export function NavegacaoLateral({ ehDono }: { ehDono: boolean }) {
  const caminho = usePathname()

  return (
    <nav
      aria-label="Seções do sistema"
      className="fixed left-4 top-20 hidden w-44 flex-col gap-2 lg:flex"
    >
      {usarItens(ehDono).map(({ href, nome, Icone }) => {
        const estaAtivo = ativo(caminho, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={estaAtivo ? "page" : undefined}
            className={cx(
              "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-medium uppercase tracking-wider transition-colors",
              estaAtivo
                ? "border-marca bg-marca text-white shadow-sm"
                : "border-borda-suave bg-superficie text-texto-suave shadow-sm hover:border-acento/40 hover:text-acento",
            )}
          >
            <Icone className="h-5 w-5" />
            {nome}
          </Link>
        )
      })}
    </nav>
  )
}

/** Celular: pílulas roláveis logo abaixo da barra da marca. */
export function NavegacaoMobile({ ehDono }: { ehDono: boolean }) {
  const caminho = usePathname()

  return (
    <nav
      aria-label="Seções do sistema"
      className="rolagem-suave -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
    >
      {usarItens(ehDono).map(({ href, nome, Icone }) => {
        const estaAtivo = ativo(caminho, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={estaAtivo ? "page" : undefined}
            className={cx(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
              estaAtivo
                ? "border-acento-vivo bg-acento-vivo text-marca"
                : "border-white/20 bg-white/10 text-marca-texto",
            )}
          >
            <Icone className="h-4 w-4" />
            {nome}
          </Link>
        )
      })}
    </nav>
  )
}

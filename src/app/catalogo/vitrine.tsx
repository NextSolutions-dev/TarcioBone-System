"use client"

import { useMemo, useState } from "react"

import { Bone } from "@/lib/bone"
import { IconeMais, IconeMenos, IconeWhatsApp } from "@/lib/icones"
import type { ItemCatalogo } from "@/lib/supabase/types"
import { cx, dinheiro } from "@/lib/utils"

type Linha = { item: ItemCatalogo; quantidade: number }

export function Vitrine({
  itens,
  categorias,
  whatsapp,
  loja,
}: {
  itens: ItemCatalogo[]
  categorias: string[]
  whatsapp: string
  loja: string
}) {
  const [categoria, setCategoria] = useState<string>("Todos")
  const [sacola, setSacola] = useState<Linha[]>([])
  const [aberta, setAberta] = useState(false)

  const filtrados = useMemo(
    () => (categoria === "Todos" ? itens : itens.filter((i) => i.categoria === categoria)),
    [itens, categoria],
  )

  const total = sacola.reduce(
    (soma, l) => soma + l.quantidade * (l.item.preco_centavos ?? 0),
    0,
  )
  const pecas = sacola.reduce((soma, l) => soma + l.quantidade, 0)

  function quantidade(id: string | null) {
    return sacola.find((l) => l.item.id === id)?.quantidade ?? 0
  }

  function adicionar(item: ItemCatalogo) {
    setSacola((atual) => {
      const existente = atual.find((l) => l.item.id === item.id)
      if (existente) {
        return atual.map((l) =>
          l.item.id === item.id ? { ...l, quantidade: l.quantidade + 1 } : l,
        )
      }
      return [...atual, { item, quantidade: 1 }]
    })
    setAberta(true)
  }

  function remover(id: string | null) {
    setSacola((atual) =>
      atual
        .map((l) => (l.item.id === id ? { ...l, quantidade: l.quantidade - 1 } : l))
        .filter((l) => l.quantidade > 0),
    )
  }

  /** Monta o pedido como mensagem — o fechamento acontece na conversa. */
  const linkWhatsApp = useMemo(() => {
    const linhas = sacola.map(
      (l) =>
        `• ${l.quantidade}x ${l.item.modelo} (${l.item.cor}) — ${dinheiro(
          l.quantidade * (l.item.preco_centavos ?? 0),
        )}`,
    )
    const texto = [
      `Olá! Quero fazer um pedido na ${loja}:`,
      "",
      ...linhas,
      "",
      `Total: ${dinheiro(total)}`,
    ].join("\n")

    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`
  }, [sacola, total, whatsapp, loja])

  return (
    <>
      {/* Filtro por categoria */}
      <div className="rolagem-suave -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {["Todos", ...categorias].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            className={cx(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              categoria === c
                ? "border-marca bg-marca text-white"
                : "border-borda-suave bg-superficie text-texto-suave hover:border-acento/40 hover:text-acento",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Grade da vitrine */}
      <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {filtrados.map((item) => {
          const qtd = quantidade(item.id)
          const esgotado = !item.disponivel

          return (
            <li
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-borda-suave bg-superficie shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Espaço da foto — ilustração na cor real enquanto não há imagem */}
              <div className="relative flex aspect-square items-center justify-center bg-fundo p-5">
                <Bone cor={item.cor ?? ""} className="h-full w-full drop-shadow-sm" />
                {esgotado ? (
                  <span className="absolute inset-x-0 bottom-0 bg-texto/80 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white">
                    Esgotado
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col p-3.5">
                <p className="text-sm font-semibold leading-snug text-texto">
                  {item.modelo}
                </p>
                <p className="text-xs text-texto-suave">{item.cor}</p>

                {item.descricao ? (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-texto-suave">
                    {item.descricao}
                  </p>
                ) : null}

                <p className="numeros mt-3 font-display text-lg font-extrabold text-texto">
                  {dinheiro(item.preco_centavos)}
                </p>

                <div className="mt-3">
                  {esgotado ? (
                    <p className="text-center text-xs text-texto-suave">Sem estoque</p>
                  ) : qtd > 0 ? (
                    <div className="flex items-center justify-between rounded-lg border border-borda-suave p-1">
                      <button
                        type="button"
                        onClick={() => remover(item.id)}
                        aria-label={`Tirar um ${item.modelo} ${item.cor}`}
                        className="grid h-9 w-9 place-items-center rounded-md text-texto transition-colors hover:bg-fundo"
                      >
                        <IconeMenos />
                      </button>
                      <span className="numeros text-sm font-bold text-texto">{qtd}</span>
                      <button
                        type="button"
                        onClick={() => adicionar(item)}
                        aria-label={`Adicionar mais um ${item.modelo} ${item.cor}`}
                        className="grid h-9 w-9 place-items-center rounded-md text-texto transition-colors hover:bg-fundo"
                      >
                        <IconeMais />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => adicionar(item)}
                      className="h-10 w-full rounded-lg bg-marca text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-marca-vivo"
                    >
                      Adicionar
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Sacola fixa */}
      {sacola.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda-suave bg-superficie/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 py-3">
            {aberta ? (
              <ul className="rolagem-suave mb-3 max-h-40 space-y-1.5 overflow-y-auto">
                {sacola.map((l) => (
                  <li key={l.item.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-texto-suave">
                      <span className="numeros font-semibold text-texto">
                        {l.quantidade}×
                      </span>{" "}
                      {l.item.modelo} · {l.item.cor}
                    </span>
                    <span className="numeros shrink-0 pl-3 font-medium text-texto">
                      {dinheiro(l.quantidade * (l.item.preco_centavos ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAberta((v) => !v)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-[11px] text-texto-suave">
                  {pecas} {pecas === 1 ? "item" : "itens"} · {aberta ? "ocultar" : "ver pedido"}
                </p>
                <p className="numeros font-display text-xl font-extrabold text-texto">
                  {dinheiro(total)}
                </p>
              </button>

              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                <IconeWhatsApp />
                Fechar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

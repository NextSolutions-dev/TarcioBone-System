"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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
  whatsapp: string | null
  loja: string
}) {
  const [categoria, setCategoria] = useState<string>("Todos")
  const [sacola, setSacola] = useState<Linha[]>([])
  const [aberta, setAberta] = useState(false)
  const grade = useRef<HTMLUListElement>(null)

  const filtrados = useMemo(
    () => (categoria === "Todos" ? itens : itens.filter((i) => i.categoria === categoria)),
    [itens, categoria],
  )

  /** Os cards sobem quando entram na tela. IntersectionObserver em vez de
   *  animation-timeline porque o cliente vai abrir isto no celular dele, e o
   *  Safari ainda não acompanha. */
  useEffect(() => {
    const lista = grade.current
    const alvos = lista?.querySelectorAll(".revela")
    if (!lista || !alvos?.length) return

    // A coleção já está visível no HTML. Só assumimos o controle da opacidade
    // depois de confirmar que dá para animar — senão o produto some sem JS.
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }

    lista.classList.add("anima-scroll")

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add("visivel")
            observador.unobserve(entrada.target)
          }
        })
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    )

    alvos.forEach((el) => observador.observe(el))
    return () => {
      observador.disconnect()
      lista.classList.remove("anima-scroll")
    }
  }, [filtrados])

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
  }

  function remover(id: string | null) {
    setSacola((atual) =>
      atual
        .map((l) => (l.item.id === id ? { ...l, quantidade: l.quantidade - 1 } : l))
        .filter((l) => l.quantidade > 0),
    )
  }

  /** O pedido vira mensagem escrita — o fechamento acontece na conversa.
   *  Sem número liberado na configuração não há link: melhor não oferecer o
   *  botão do que mandar o cliente para um número que não existe. */
  const linkWhatsApp = useMemo(() => {
    if (!whatsapp) return null
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
      {/* filtro por categoria */}
      <div className="rolagem-suave -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        {["Todos", ...categorias].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            aria-pressed={categoria === c}
            className={cx(
              "h-10 shrink-0 border px-4 font-mono text-[11px] uppercase tracking-widest transition-colors",
              categoria === c
                ? "border-tinta bg-tinta text-white"
                : "border-linha bg-papel text-fumaca hover:border-tinta hover:text-tinta",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* a coleção */}
      <ul
        ref={grade}
        className="mt-8 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4 lg:gap-x-8"
      >
        {filtrados.map((item, i) => {
          const qtd = quantidade(item.id)
          const esgotado = !item.disponivel

          return (
            <li
              key={item.id}
              className="cartao-peca revela group scroll-mb-32"
              style={{ transitionDelay: `${Math.min(i, 7) * 55}ms` }}
            >
              {/* palco: o boné apoiado na linha */}
              <div className="relative bg-papel px-3 pt-5 sm:px-4">
                <Bone
                  cor={item.cor ?? ""}
                  className={cx("peca h-auto w-full", esgotado && "opacity-45 grayscale")}
                />
                {esgotado ? (
                  <span className="absolute left-4 top-4 bg-tinta px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white">
                    Esgotado
                  </span>
                ) : null}
              </div>

              {/* A LINHA DA ABA de novo: a prateleira sob a peça */}
              <div className="h-[2px] w-full bg-linha">
                <div className="prateleira h-full w-full bg-tinta" />
              </div>

              <div className="pt-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-fumaca">
                  {item.categoria}
                </p>

                <h3 className="mt-2 font-cartaz text-lg uppercase leading-tight tracking-tight text-tinta sm:text-xl">
                  {item.modelo}
                </h3>
                <p className="text-sm text-grafite">{item.cor}</p>

                {item.descricao ? (
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-fumaca">
                    {item.descricao}
                  </p>
                ) : null}

                <p className="numeros mt-4 font-cartaz text-2xl tracking-tight text-tinta">
                  {dinheiro(item.preco_centavos)}
                </p>

                <div className="mt-4">
                  {esgotado ? (
                    <p className="flex h-11 items-center justify-center border border-linha font-mono text-[11px] uppercase tracking-widest text-fumaca">
                      Sem estoque
                    </p>
                  ) : qtd > 0 ? (
                    <div className="flex h-11 items-center justify-between border border-tinta">
                      <button
                        type="button"
                        onClick={() => remover(item.id)}
                        aria-label={`Tirar um ${item.modelo} ${item.cor}`}
                        className="grid h-full w-11 place-items-center text-tinta transition-colors hover:bg-tinta hover:text-white"
                      >
                        <IconeMenos />
                      </button>
                      <span className="numeros font-mono text-sm font-bold text-tinta">
                        {qtd}
                      </span>
                      <button
                        type="button"
                        onClick={() => adicionar(item)}
                        aria-label={`Adicionar mais um ${item.modelo} ${item.cor}`}
                        className="grid h-full w-11 place-items-center text-tinta transition-colors hover:bg-tinta hover:text-white"
                      >
                        <IconeMais />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => adicionar(item)}
                      className="botao-varre h-11 w-full border border-tinta font-mono text-[11px] uppercase tracking-widest text-tinta transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 focus-visible:ring-offset-concreto"
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

      {/* ------------------------------------------------------------- sacola */}
      {sacola.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-royal bg-tinta text-white">
          <div className="mx-auto max-w-[92rem] px-5 py-3.5 sm:px-8">
            {aberta ? (
              <ul className="rolagem-suave mb-3 max-h-44 space-y-2 overflow-y-auto border-b border-white/15 pb-3">
                {sacola.map((l) => (
                  <li
                    key={l.item.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-white/70">
                      <span className="numeros font-mono font-bold text-white">
                        {l.quantidade}×
                      </span>{" "}
                      {l.item.modelo} · {l.item.cor}
                    </span>
                    <span className="numeros shrink-0 font-mono text-white">
                      {dinheiro(l.quantidade * (l.item.preco_centavos ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setAberta((v) => !v)}
                aria-expanded={aberta}
                className="min-w-0 flex-1 text-left"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/55">
                  {pecas} {pecas === 1 ? "item" : "itens"} ·{" "}
                  {aberta ? "ocultar" : "ver pedido"}
                </p>
                <p className="numeros font-cartaz text-2xl tracking-tight text-white">
                  {dinheiro(total)}
                </p>
              </button>

              {linkWhatsApp ? (
                <a
                  href={linkWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 shrink-0 items-center gap-2 bg-[#25D366] px-5 font-mono text-[11px] uppercase tracking-widest text-tinta transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <IconeWhatsApp className="h-5 w-5" />
                  Fechar pedido
                </a>
              ) : (
                <p className="shrink-0 font-mono text-[10px] uppercase leading-tight tracking-widest text-white/60">
                  WhatsApp ainda
                  <br />
                  não configurado
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

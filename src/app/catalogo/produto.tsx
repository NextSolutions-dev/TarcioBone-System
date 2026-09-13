"use client"

import { useEffect, useRef, useState } from "react"

import { Bone } from "@/lib/bone"
import { IconeMais, IconeMenos } from "@/lib/icones"
import { cx, dinheiro } from "@/lib/utils"
import type { GrupoCor, GrupoModelo } from "@/lib/variacoes"

import type { VariacaoLoja } from "./tipos"

type Props = {
  grupo: GrupoModelo<VariacaoLoja>
  naSacola: (id: string) => number
  onAdicionar: (v: VariacaoLoja, quantidade: number) => void
  onFechar: () => void
}

function primeiraDisponivel(cor: GrupoCor<VariacaoLoja> | undefined) {
  return cor?.variacoes.find((v) => v.disponivel)?.id ?? null
}

/** Cor inicial ao abrir: a primeira que tem peça — abrir um produto já mostrando
 *  a cor esgotada seria mandar o lojista embora na primeira olhada. */
export function corInicial(grupo: GrupoModelo<VariacaoLoja>) {
  return (grupo.cores.find((c) => c.variacoes.some((v) => v.disponivel)) ?? grupo.cores[0]).chave
}

/** Página do produto, aberta sobre a vitrine.
 *
 *  Desenho de loja grande: a foto grande troca junto com a cor; as cores são as
 *  próprias fotos; os tamanhos são pílulas, e o que acabou fica riscado. Sem
 *  avaliação, selo de mais vendido ou desconto relâmpago — isso é linguagem de
 *  marketplace, e aqui é o catálogo de um distribuidor.
 *
 *  O visitante NÃO vê quantidade (regra 8 do AGENTS): só se o tamanho tem ou não
 *  tem. Quantidade é informação de dentro da loja. */
export function ProdutoLoja({ grupo, naSacola, onAdicionar, onFechar }: Props) {
  const painel = useRef<HTMLDivElement>(null)
  const galeria = useRef<HTMLDivElement>(null)

  const [chaveCor, setChaveCor] = useState(() => corInicial(grupo))
  const [variacaoId, setVariacaoId] = useState<string | null>(() =>
    primeiraDisponivel(grupo.cores.find((c) => c.chave === corInicial(grupo))),
  )
  const [foto, setFoto] = useState(0)
  const [quantidade, setQuantidade] = useState(1)
  const [adicionado, setAdicionado] = useState(false)

  const cor = grupo.cores.find((c) => c.chave === chaveCor) ?? grupo.cores[0]
  const variacao = cor.variacoes.find((v) => v.id === variacaoId) ?? null
  const fotos = cor.fotos
  const descricao = grupo.variacoes.find((v) => v.descricao)?.descricao ?? null
  const categoria = grupo.variacoes[0]?.categoria
  const preco = variacao?.preco_centavos ?? cor.variacoes[0]?.preco_centavos ?? 0

  // Mesmo cuidado do seletor do sistema: o fechar numa ref deixa o efeito
  // rodar uma vez só, sem roubar o foco a cada render.
  const fechar = useRef(onFechar)
  useEffect(() => {
    fechar.current = onFechar
  }, [onFechar])

  useEffect(() => {
    painel.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar.current()
    }
    const anterior = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", tecla)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener("keydown", tecla)
    }
  }, [])

  function escolherCor(c: GrupoCor<VariacaoLoja>) {
    setChaveCor(c.chave)
    setVariacaoId(primeiraDisponivel(c))
    setFoto(0)
    setQuantidade(1)
    setAdicionado(false)
    galeria.current?.scrollTo({ left: 0 })
  }

  function irParaFoto(i: number) {
    setFoto(i)
    const alvo = galeria.current
    if (alvo) alvo.scrollTo({ left: alvo.clientWidth * i, behavior: "smooth" })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-8">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="produto-titulo"
        tabIndex={-1}
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden border-t-2 border-ouro bg-onix text-creme outline-none lg:max-w-6xl lg:border"
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center bg-onix/80 text-2xl leading-none text-creme transition-colors hover:text-ouro"
        >
          ×
        </button>

        <div className="rolagem-suave grid flex-1 overflow-y-auto lg:grid-cols-[1.15fr_1fr]">
          {/* ---------------------------------------------------- galeria */}
          <div className="flex gap-3 bg-carvao lg:p-6">
            {fotos.length > 1 ? (
              <ul className="hidden w-[4.5rem] shrink-0 flex-col gap-2 lg:flex">
                {fotos.map((url, i) => (
                  <li key={url}>
                    <button
                      type="button"
                      onClick={() => irParaFoto(i)}
                      aria-label={`Foto ${i + 1} de ${cor.cor}`}
                      aria-pressed={foto === i}
                      className={cx(
                        "block w-full border transition-colors",
                        foto === i ? "border-ouro" : "border-transparent hover:border-linha",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="aspect-[4/5] w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="relative min-w-0 flex-1">
              {/* No celular desliza com o dedo (scroll-snap); no computador as
                  miniaturas ao lado controlam. */}
              <div
                ref={galeria}
                onScroll={(e) => {
                  const el = e.currentTarget
                  const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))
                  if (i !== foto) setFoto(i)
                }}
                className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto lg:overflow-hidden [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                {fotos.length > 0 ? (
                  fotos.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt={`${grupo.nome} na cor ${cor.cor}, foto ${i + 1}`}
                      className="h-full w-full shrink-0 snap-center object-cover"
                    />
                  ))
                ) : (
                  <div
                    className="grid h-full w-full shrink-0 place-items-center p-10"
                    style={{ backgroundImage: "radial-gradient(ellipse at 50% 55%, rgba(240,235,227,0.13), transparent 62%)" }}
                  >
                    <Bone cor={cor.cor} className="h-auto w-full" />
                  </div>
                )}
              </div>

              {fotos.length > 1 ? (
                <p className="numeros absolute bottom-3 right-3 bg-onix/80 px-2 py-1 font-etiqueta text-[11px] tracking-widest text-creme lg:hidden">
                  {foto + 1} / {fotos.length}
                </p>
              ) : null}
            </div>
          </div>

          {/* ----------------------------------------------------- opções */}
          <div className="flex flex-col px-5 pb-28 pt-6 sm:px-8 lg:pb-8 lg:pt-10">
            {categoria && categoria !== "Sem categoria" ? (
              <p className="font-etiqueta text-[11px] uppercase tracking-[0.22em] text-fumaca">
                {categoria}
              </p>
            ) : null}

            <h2
              id="produto-titulo"
              className="mt-2 pr-10 font-cartaz text-3xl leading-tight text-creme sm:text-4xl"
            >
              {grupo.nome}
            </h2>

            <p className="numeros mt-4 font-cartaz text-3xl text-ouro">{dinheiro(preco)}</p>
            <p className="font-etiqueta text-[11px] uppercase tracking-widest text-fumaca">
              preço de atacado, por peça
            </p>

            <div className="my-6 h-px w-full bg-linha" />

            {/* cor */}
            <div>
              <p className="font-etiqueta text-sm tracking-wide text-cinza">
                <span className="uppercase tracking-widest text-fumaca">Cor:</span>{" "}
                <span className="text-creme">{cor.cor}</span>
              </p>

              <ul className="mt-3 flex flex-wrap gap-2.5">
                {grupo.cores.map((c) => {
                  const temPeca = c.variacoes.some((v) => v.disponivel)
                  const ativa = c.chave === cor.chave
                  return (
                    <li key={c.chave}>
                      <button
                        type="button"
                        onClick={() => escolherCor(c)}
                        aria-pressed={ativa}
                        aria-label={`${c.cor}${temPeca ? "" : " — esgotada"}`}
                        title={c.cor}
                        className={cx(
                          "relative block border-2 p-0.5 transition-colors",
                          ativa ? "border-ouro" : "border-linha hover:border-ouro/50",
                        )}
                      >
                        {c.fotos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.fotos[0]}
                            alt=""
                            className={cx(
                              "h-[4.5rem] w-14 object-cover",
                              !temPeca && "opacity-40 grayscale",
                            )}
                          />
                        ) : (
                          <span
                            className={cx(
                              "grid h-[4.5rem] w-14 place-items-center bg-carvao p-1",
                              !temPeca && "opacity-40",
                            )}
                          >
                            <Bone cor={c.cor} className="h-auto w-full" />
                          </span>
                        )}
                        {!temPeca ? (
                          <span
                            aria-hidden
                            className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-creme/70"
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* tamanho */}
            <div className="mt-6">
              <p className="font-etiqueta text-sm uppercase tracking-widest text-fumaca">
                Tamanho
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {cor.variacoes.map((v) => {
                  const ativo = v.id === variacaoId
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setVariacaoId(v.id)
                          setQuantidade(1)
                          setAdicionado(false)
                        }}
                        disabled={!v.disponivel}
                        aria-pressed={ativo}
                        aria-label={`Tamanho ${v.tamanho}${v.disponivel ? "" : " — esgotado"}`}
                        className={cx(
                          "h-11 min-w-14 border px-4 font-etiqueta text-sm tracking-wide transition-colors",
                          ativo
                            ? "border-ouro bg-ouro text-onix"
                            : "border-linha text-creme hover:border-ouro",
                          !v.disponivel &&
                            "cursor-not-allowed border-dashed text-fumaca line-through hover:border-linha",
                        )}
                      >
                        {v.tamanho}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {cor.variacoes.every((v) => !v.disponivel) ? (
                <p className="mt-3 font-etiqueta text-[11px] uppercase tracking-widest text-fumaca">
                  Esta cor esgotou — veja as outras
                </p>
              ) : null}
            </div>

            {descricao ? (
              <p className="mt-8 max-w-prose text-[15px] leading-relaxed text-cinza">
                {descricao}
              </p>
            ) : null}

            {/* ação — fixa no pé no celular, no fluxo no computador */}
            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linha bg-onix/95 px-5 py-3 backdrop-blur lg:static lg:mt-auto lg:border-0 lg:bg-transparent lg:px-0 lg:pt-8 lg:backdrop-blur-none">
              {variacao && naSacola(variacao.id) > 0 ? (
                <p className="numeros mb-2 font-etiqueta text-[11px] uppercase tracking-widest text-ouro-claro">
                  Na sacola: {naSacola(variacao.id)} × {cor.cor} {variacao.tamanho}
                </p>
              ) : null}

              <div className="flex items-stretch gap-3">
                <div className="flex h-12 items-center border border-linha">
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                    disabled={!variacao || quantidade <= 1}
                    aria-label="Diminuir quantidade"
                    className="grid h-full w-11 place-items-center text-creme transition-colors hover:text-ouro disabled:text-fumaca/50"
                  >
                    <IconeMenos />
                  </button>
                  <span className="numeros w-9 text-center font-etiqueta text-sm font-medium text-creme">
                    {quantidade}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => Math.min(999, q + 1))}
                    disabled={!variacao}
                    aria-label="Aumentar quantidade"
                    className="grid h-full w-11 place-items-center text-creme transition-colors hover:text-ouro disabled:text-fumaca/50"
                  >
                    <IconeMais />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!variacao}
                  onClick={() => {
                    if (!variacao) return
                    onAdicionar(variacao, quantidade)
                    setAdicionado(true)
                    setQuantidade(1)
                  }}
                  className="h-12 flex-1 bg-ouro font-etiqueta text-[12px] font-medium uppercase tracking-[0.18em] text-onix transition-colors hover:bg-ouro-claro disabled:cursor-not-allowed disabled:bg-carvao disabled:text-fumaca"
                >
                  {!variacao
                    ? "Escolha o tamanho"
                    : adicionado
                      ? "Adicionado — pôr mais"
                      : "Adicionar à sacola"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

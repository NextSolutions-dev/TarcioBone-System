"use client"

import { useEffect, useRef, useState } from "react"

import { Bone } from "@/lib/bone"
import { IconeMais, IconeMenos } from "@/lib/icones"
import type { Produto } from "@/lib/supabase/types"
import { cx, dinheiro } from "@/lib/utils"
import type { GrupoCor, GrupoModelo } from "@/lib/variacoes"

type Props = {
  grupo: GrupoModelo<Produto>
  corInicial: string
  variacaoInicial: string | null
  precoDe: (p: Produto) => number | null
  noCarrinho: (id: string) => number
  onAdicionar: (p: Produto, quantidade: number) => void
  onFechar: () => void
}

/** Primeira variação vendável de uma cor: tem peça fora do carrinho e tem preço
 *  no canal atual. É o que fica pré-selecionado ao abrir ou trocar de cor. */
export function primeiraDisponivel(
  cor: GrupoCor<Produto> | undefined,
  precoDe: (p: Produto) => number | null,
  noCarrinho: (id: string) => number,
): string | null {
  const v = cor?.variacoes.find(
    (x) => x.estoque_atual - noCarrinho(x.id) > 0 && precoDe(x) !== null,
  )
  return v?.id ?? null
}

/** Escolha de cor e tamanho, no desenho de página de produto de loja grande:
 *  a foto grande muda com a cor, as cores são as próprias fotos, e cada tamanho
 *  mostra quantas peças tem. No celular abre de baixo; no computador, ao centro. */
export function SeletorVariacao({
  grupo,
  corInicial,
  variacaoInicial,
  precoDe,
  noCarrinho,
  onAdicionar,
  onFechar,
}: Props) {
  const painel = useRef<HTMLDivElement>(null)

  const [chaveCor, setChaveCor] = useState(corInicial)
  const [variacaoId, setVariacaoId] = useState<string | null>(variacaoInicial)
  const [foto, setFoto] = useState(0)
  const [quantidade, setQuantidade] = useState(1)

  const cor = grupo.cores.find((c) => c.chave === chaveCor) ?? grupo.cores[0]
  const variacao = cor.variacoes.find((v) => v.id === variacaoId) ?? null
  const livre = variacao ? variacao.estoque_atual - noCarrinho(variacao.id) : 0
  const preco = variacao ? precoDe(variacao) : precoDe(cor.variacoes[0])

  // O fechar mora numa ref para o efeito abaixo rodar UMA vez só. Dependendo de
  // `onFechar` direto, cada render da tela (função nova) re-rodaria o efeito e
  // devolveria o foco ao painel — roubando o foco do botão que acabou de ser
  // clicado dentro dele.
  const fechar = useRef(onFechar)
  useEffect(() => {
    fechar.current = onFechar
  }, [onFechar])

  // Foco no painel ao abrir e Esc para fechar: quem usa teclado não fica preso
  // atrás do fundo escurecido. Rolagem da página trava enquanto está aberto.
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

  function escolherCor(c: GrupoCor<Produto>) {
    setChaveCor(c.chave)
    setVariacaoId(primeiraDisponivel(c, precoDe, noCarrinho))
    setFoto(0)
    setQuantidade(1)
  }

  function escolherTamanho(id: string) {
    setVariacaoId(id)
    setQuantidade(1)
  }

  const fotos = cor.fotos

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/45"
      />

      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seletor-titulo"
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-superficie shadow-xl outline-none lg:max-w-4xl lg:rounded-2xl"
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-superficie/90 text-xl leading-none text-texto-suave shadow-sm transition-colors hover:text-texto"
        >
          ×
        </button>

        <div className="grid gap-5 p-4 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:p-6">
          {/* ---------------------------------------------------- galeria */}
          <div className="flex gap-3">
            {fotos.length > 1 ? (
              <ul className="hidden w-16 shrink-0 flex-col gap-2 lg:flex">
                {fotos.map((url, i) => (
                  <li key={url}>
                    <button
                      type="button"
                      onClick={() => setFoto(i)}
                      aria-label={`Foto ${i + 1} de ${cor.cor}`}
                      aria-pressed={foto === i}
                      className={cx(
                        "block overflow-hidden rounded-lg border-2 transition-colors",
                        foto === i ? "border-marca" : "border-transparent hover:border-borda",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-fundo">
                {fotos.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotos[Math.min(foto, fotos.length - 1)]}
                    alt={`${grupo.nome} ${cor.cor}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center p-8">
                    <Bone cor={cor.cor} className="h-auto w-full" />
                  </div>
                )}
              </div>

              {/* no celular as miniaturas vão abaixo, em linha */}
              {fotos.length > 1 ? (
                <ul className="rolagem-suave mt-2 flex gap-2 overflow-x-auto lg:hidden">
                  {fotos.map((url, i) => (
                    <li key={url} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setFoto(i)}
                        aria-label={`Foto ${i + 1} de ${cor.cor}`}
                        aria-pressed={foto === i}
                        className={cx(
                          "block h-14 w-14 overflow-hidden rounded-lg border-2",
                          foto === i ? "border-marca" : "border-transparent",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {/* ----------------------------------------------------- opções */}
          <div className="flex flex-col">
            <h2 id="seletor-titulo" className="pr-10 font-display text-xl font-bold text-texto">
              {grupo.nome}
            </h2>
            {variacao ? (
              <p className="numeros mt-0.5 text-xs text-texto-suave">Código {variacao.sku}</p>
            ) : null}

            <p className="numeros mt-3 font-display text-2xl font-extrabold text-texto">
              {preco === null ? (
                <span className="text-base font-semibold text-texto-suave">
                  Sem preço de atacado
                </span>
              ) : (
                dinheiro(preco)
              )}
            </p>

            {/* cor */}
            <div className="mt-5">
              <p className="text-sm text-texto">
                <span className="font-semibold">Cor:</span> {cor.cor}
                <span className="numeros ml-2 text-xs text-texto-suave">
                  {grupo.cores.length} {grupo.cores.length === 1 ? "opção" : "opções"}
                </span>
              </p>

              <ul className="mt-2 flex flex-wrap gap-2">
                {grupo.cores.map((c) => {
                  const pecas = c.variacoes.reduce((s, v) => s + v.estoque_atual, 0)
                  const ativa = c.chave === cor.chave
                  return (
                    <li key={c.chave}>
                      <button
                        type="button"
                        onClick={() => escolherCor(c)}
                        aria-pressed={ativa}
                        title={`${c.cor} — ${pecas} peça(s)`}
                        className={cx(
                          "relative flex flex-col items-center gap-1 rounded-lg border-2 p-1 transition-colors",
                          ativa ? "border-marca" : "border-borda-suave hover:border-borda",
                          pecas === 0 && "opacity-50",
                        )}
                      >
                        {c.fotos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.fotos[0]}
                            alt=""
                            className="h-14 w-14 rounded-md object-cover"
                          />
                        ) : (
                          <span className="grid h-14 w-14 place-items-center rounded-md bg-fundo p-1">
                            <Bone cor={c.cor} className="h-auto w-full" />
                          </span>
                        )}
                        <span className="max-w-14 truncate text-[10px] font-medium text-texto">
                          {c.cor}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* tamanho, com a quantidade de cada um */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-texto">Tamanho</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {cor.variacoes.map((v) => {
                  const disponivel = v.estoque_atual - noCarrinho(v.id)
                  const semPreco = precoDe(v) === null
                  const bloqueado = disponivel <= 0 || semPreco
                  const ativo = v.id === variacaoId
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => escolherTamanho(v.id)}
                        disabled={bloqueado}
                        aria-pressed={ativo}
                        className={cx(
                          "flex min-w-16 flex-col items-center rounded-lg border px-3 py-2 transition-colors",
                          ativo
                            ? "border-marca bg-marca text-white"
                            : "border-borda-suave bg-superficie text-texto hover:border-marca/50",
                          bloqueado &&
                            "cursor-not-allowed border-dashed bg-fundo text-texto-suave line-through hover:border-borda-suave",
                        )}
                      >
                        <span className="text-sm font-bold">{v.tamanho}</span>
                        <span
                          className={cx(
                            "numeros text-[11px]",
                            ativo ? "text-white/80" : "text-texto-suave",
                          )}
                        >
                          {semPreco ? "sem preço" : `${Math.max(0, disponivel)} un`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* quantidade + adicionar */}
            <div className="mt-auto pt-6">
              {variacao && noCarrinho(variacao.id) > 0 ? (
                <p className="numeros mb-2 text-xs text-acento">
                  Já no carrinho: {noCarrinho(variacao.id)} × {variacao.tamanho}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <div className="flex h-12 items-center rounded-lg border border-borda-suave">
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                    disabled={!variacao || quantidade <= 1}
                    aria-label="Diminuir quantidade"
                    className="grid h-full w-11 place-items-center text-texto transition-colors hover:text-marca disabled:text-borda"
                  >
                    <IconeMenos />
                  </button>
                  <span className="numeros w-8 text-center text-sm font-bold text-texto">
                    {variacao ? Math.min(quantidade, Math.max(livre, 1)) : 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantidade((q) => Math.min(livre, q + 1))}
                    disabled={!variacao || quantidade >= livre}
                    aria-label="Aumentar quantidade"
                    className="grid h-full w-11 place-items-center text-texto transition-colors hover:text-marca disabled:text-borda"
                  >
                    <IconeMais />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!variacao || livre <= 0 || preco === null}
                  onClick={() => {
                    if (!variacao) return
                    onAdicionar(variacao, Math.min(quantidade, livre))
                    onFechar()
                  }}
                  className="h-12 flex-1 rounded-lg bg-marca text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-not-allowed disabled:bg-borda disabled:text-texto-suave"
                >
                  {!variacao ? "Escolha o tamanho" : "Adicionar ao carrinho"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

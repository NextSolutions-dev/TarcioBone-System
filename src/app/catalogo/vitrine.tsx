"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Bone } from "@/lib/bone"
import { IconeMais, IconeMenos, IconeWhatsApp } from "@/lib/icones"
import type { ModeloFoto } from "@/lib/supabase/types"
import { cx, dinheiro } from "@/lib/utils"
import {
  agruparPorModelo,
  capaDoModelo,
  compararTamanhos,
  nomeVariacao,
  type GrupoModelo,
} from "@/lib/variacoes"

import { ProdutoLoja } from "./produto"
import type { VariacaoLoja } from "./tipos"

type Linha = { variacao: VariacaoLoja; quantidade: number }

export function Vitrine({
  variacoes,
  fotos,
  categorias,
  whatsapp,
  loja,
  minimo,
}: {
  variacoes: VariacaoLoja[]
  fotos: Pick<ModeloFoto, "modelo_id" | "cor" | "url" | "ordem">[]
  categorias: string[]
  whatsapp: string | null
  loja: string
  minimo: number
}) {
  const [categoria, setCategoria] = useState<string>("Todos")
  const [sacola, setSacola] = useState<Linha[]>([])
  const [aberta, setAberta] = useState(false)
  const [produtoAberto, setProdutoAberto] = useState<string | null>(null)
  const grade = useRef<HTMLUListElement>(null)

  const grupos = useMemo(() => agruparPorModelo(variacoes, fotos), [variacoes, fotos])

  const filtrados = useMemo(
    () =>
      categoria === "Todos"
        ? grupos
        : grupos.filter((g) => g.variacoes[0]?.categoria === categoria),
    [grupos, categoria],
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

  const total = sacola.reduce((soma, l) => soma + l.quantidade * l.variacao.preco_centavos, 0)
  const pecas = sacola.reduce((soma, l) => soma + l.quantidade, 0)

  function naSacola(id: string) {
    return sacola.find((l) => l.variacao.id === id)?.quantidade ?? 0
  }

  function adicionar(variacao: VariacaoLoja, quantidade = 1) {
    setSacola((atual) => {
      const existente = atual.find((l) => l.variacao.id === variacao.id)
      if (existente) {
        return atual.map((l) =>
          l.variacao.id === variacao.id ? { ...l, quantidade: l.quantidade + quantidade } : l,
        )
      }
      return [...atual, { variacao, quantidade }]
    })
  }

  function remover(id: string) {
    setSacola((atual) =>
      atual
        .map((l) => (l.variacao.id === id ? { ...l, quantidade: l.quantidade - 1 } : l))
        .filter((l) => l.quantidade > 0),
    )
  }

  const faltam = Math.max(0, minimo - pecas)
  const atingiuMinimo = faltam === 0

  /** O pedido vira mensagem escrita, com um LINK que abre a página do pedido
   *  com as fotos. O WhatsApp não anexa imagem por link — só texto — então a
   *  foto chega assim. O link carrega os itens na própria URL: nada é gravado
   *  no banco, o que evita pedido fantasma e fecha a porta de escrita ao
   *  visitante. Cor e tamanho vão escritos: é o que o Tarcio separa na mão. */
  const linkWhatsApp = useMemo(() => {
    if (!whatsapp || !atingiuMinimo) return null

    const linhas = sacola.map(
      (l) =>
        `• ${l.quantidade}x ${nomeVariacao(l.variacao)} — ${dinheiro(
          l.quantidade * l.variacao.preco_centavos,
        )}`,
    )

    const codigos = sacola.map((l) => `${l.variacao.sku}:${l.quantidade}`).join(",")

    const origem = typeof window === "undefined" ? "" : window.location.origin
    const linkFotos = codigos ? `${origem}/pedido?i=${encodeURIComponent(codigos)}` : null

    const texto = [
      `Olá! Quero fazer um pedido na ${loja}:`,
      "",
      ...linhas,
      "",
      `Total: ${dinheiro(total)}`,
      ...(linkFotos ? ["", `Fotos e detalhes do pedido: ${linkFotos}`] : []),
    ].join("\n")

    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`
  }, [sacola, total, whatsapp, loja, atingiuMinimo])

  const grupoAberto = produtoAberto ? grupos.find((g) => g.modeloId === produtoAberto) : null

  return (
    <>
      {/* filtro por categoria */}
      {categorias.length > 1 ? (
        <div className="rolagem-suave -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
          {["Todos", ...categorias].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={cx(
                "h-10 shrink-0 border px-4 font-etiqueta text-[11px] uppercase tracking-widest transition-colors",
                categoria === c
                  ? "border-ouro bg-ouro text-onix"
                  : "border-linha bg-carvao text-fumaca hover:border-ouro hover:text-creme",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {/* Coleção vazia: o visitante recebeu um link e precisa entender o que
          houve. Sem isto a página abre um buraco branco embaixo do título. */}
      {filtrados.length === 0 ? (
        <div className="mt-8 border border-dashed border-linha px-6 py-14 text-center">
          <p className="font-cartaz text-2xl text-creme">
            {grupos.length === 0 ? "A coleção está sendo atualizada" : "Nada nesta categoria"}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cinza">
            {grupos.length === 0
              ? "Estamos subindo as peças novas. Chame no WhatsApp que a gente manda o que tem disponível agora."
              : "Escolha outra categoria para ver o que temos."}
          </p>
          {grupos.length === 0 && whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-12 items-center gap-2 bg-ouro px-6 font-etiqueta text-[11px] uppercase tracking-widest text-onix transition-colors hover:bg-ouro-claro"
            >
              <IconeWhatsApp className="h-4 w-4" />
              Falar com a loja
            </a>
          ) : null}
        </div>
      ) : null}

      {/* a coleção — a grade some quando não há o que mostrar, senão sobra um
          vão vazio entre o aviso e a seção seguinte */}
      <ul
        ref={grade}
        hidden={filtrados.length === 0}
        className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-14"
      >
        {filtrados.map((g, i) => (
          <CartaoModelo
            key={g.modeloId}
            grupo={g}
            atraso={Math.min(i, 7) * 55}
            naSacola={g.variacoes.reduce((s, v) => s + naSacola(v.id), 0)}
            onAbrir={() => setProdutoAberto(g.modeloId)}
          />
        ))}
      </ul>

      {grupoAberto ? (
        <ProdutoLoja
          key={grupoAberto.modeloId}
          grupo={grupoAberto}
          naSacola={naSacola}
          onAdicionar={adicionar}
          onFechar={() => setProdutoAberto(null)}
        />
      ) : null}

      {/* ------------------------------------------------------------- sacola */}
      {sacola.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ouro bg-carvao text-creme">
          <div className="mx-auto max-w-[92rem] px-5 py-3.5 sm:px-8">
            {aberta ? (
              <ul className="rolagem-suave mb-3 max-h-56 space-y-2 overflow-y-auto border-b border-linha pb-3">
                {sacola.map((l) => (
                  <li key={l.variacao.id} className="flex items-center gap-3 text-sm">
                    <span className="flex shrink-0 items-center border border-linha">
                      <button
                        type="button"
                        onClick={() => remover(l.variacao.id)}
                        aria-label={`Tirar um ${nomeVariacao(l.variacao)}`}
                        className="grid h-9 w-9 place-items-center text-creme transition-colors hover:bg-ouro hover:text-onix"
                      >
                        <IconeMenos />
                      </button>
                      <span className="numeros w-7 text-center font-etiqueta text-sm text-creme">
                        {l.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => adicionar(l.variacao)}
                        aria-label={`Mais um ${nomeVariacao(l.variacao)}`}
                        className="grid h-9 w-9 place-items-center text-creme transition-colors hover:bg-ouro hover:text-onix"
                      >
                        <IconeMais />
                      </button>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-cinza">
                      {nomeVariacao(l.variacao)}
                    </span>
                    <span className="numeros shrink-0 font-etiqueta text-creme">
                      {dinheiro(l.quantidade * l.variacao.preco_centavos)}
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
                <p className="font-etiqueta text-[10px] uppercase tracking-widest text-fumaca">
                  {pecas} {pecas === 1 ? "peça" : "peças"} ·{" "}
                  <span className="text-ouro-claro underline underline-offset-2">
                    {aberta ? "ocultar" : "ver e ajustar"}
                  </span>
                  {!atingiuMinimo ? <span className="text-cinza"> · mínimo {minimo}</span> : null}
                </p>
                <p className="numeros font-cartaz text-2xl text-creme">{dinheiro(total)}</p>
              </button>

              {linkWhatsApp ? (
                <a
                  href={linkWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 shrink-0 items-center gap-2 bg-[#25D366] px-5 font-etiqueta text-[11px] font-medium uppercase tracking-widest text-onix transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-creme"
                >
                  <IconeWhatsApp className="h-5 w-5" />
                  Fechar pedido
                </a>
              ) : !atingiuMinimo ? (
                <p className="shrink-0 text-right font-etiqueta text-[10px] uppercase leading-tight tracking-widest text-cinza">
                  faltam {faltam}
                  <br />
                  {faltam === 1 ? "peça" : "peças"}
                </p>
              ) : (
                <p className="shrink-0 text-right font-etiqueta text-[10px] uppercase leading-tight tracking-widest text-cinza">
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

/** Card do produto na vitrine: a foto, as cores (pelas próprias fotos), os
 *  tamanhos que ainda têm e o preço. O card inteiro abre a página do produto. */
function CartaoModelo({
  grupo,
  atraso,
  naSacola,
  onAbrir,
}: {
  grupo: GrupoModelo<VariacaoLoja>
  atraso: number
  naSacola: number
  onAbrir: () => void
}) {
  const esgotado = grupo.variacoes.every((v) => !v.disponivel)
  const capa = capaDoModelo(grupo, (v) => v.disponivel)
  const categoria = grupo.variacoes[0]?.categoria

  const tamanhos = [
    ...new Set(grupo.variacoes.filter((v) => v.disponivel).map((v) => v.tamanho)),
  ].sort(compararTamanhos)
  const soUnico = tamanhos.length === 1 && /^[uú]nico$/i.test(tamanhos[0])

  const precos = grupo.variacoes.map((v) => v.preco_centavos)
  const menor = Math.min(...precos)
  const variaPreco = Math.max(...precos) !== menor

  // Segunda foto da mesma cor aparece ao passar o mouse — o lojista vê o
  // produto de outro ângulo sem abrir.
  const segunda =
    grupo.cores.find((c) => c.fotos[0] === capa.url)?.fotos[1] ?? null

  return (
    <li
      className="cartao-peca revela group scroll-mb-32"
      style={{ transitionDelay: `${atraso}ms` }}
    >
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Ver ${grupo.nome}: ${grupo.cores.length} ${grupo.cores.length === 1 ? "cor" : "cores"}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro focus-visible:ring-offset-4 focus-visible:ring-offset-onix"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-carvao">
          {capa.url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capa.url}
                alt={`${grupo.nome} na cor ${capa.cor}`}
                loading="lazy"
                className={cx(
                  "peca h-full w-full object-cover transition-opacity duration-500",
                  esgotado && "opacity-45 grayscale",
                  segunda && "group-hover:opacity-0",
                )}
              />
              {segunda ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={segunda}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              ) : null}
            </>
          ) : (
            /* Sem foto ainda: a ilustração segura a vitrine em vez de um
               quadrado vazio. Sai sozinha quando a foto entrar. */
            <div
              className="grid h-full place-items-center px-4"
              style={{ backgroundImage: "radial-gradient(ellipse at 50% 55%, rgba(240,235,227,0.13), transparent 62%)" }}
            >
              <Bone
                cor={capa.cor}
                className={cx("peca h-auto w-full", esgotado && "opacity-45 grayscale")}
              />
            </div>
          )}

          {esgotado ? (
            <span className="absolute left-3 top-3 bg-onix/85 px-2 py-1 font-etiqueta text-[10px] uppercase tracking-widest text-creme">
              Esgotado
            </span>
          ) : null}
          {naSacola > 0 ? (
            <span className="numeros absolute right-3 top-3 bg-ouro px-2 py-1 font-etiqueta text-[10px] uppercase tracking-widest text-onix">
              {naSacola} na sacola
            </span>
          ) : null}
        </div>

        {/* A LINHA DA ABA de novo: a prateleira sob a peça */}
        <div className="h-[2px] w-full bg-linha">
          <div className="prateleira h-full w-full bg-ouro/40" />
        </div>

        <div className="pt-4">
          {categoria && categoria !== "Sem categoria" ? (
            <p className="font-etiqueta text-[10px] uppercase tracking-widest text-fumaca">
              {categoria}
            </p>
          ) : null}

          <h3 className="mt-1.5 line-clamp-2 font-cartaz text-lg leading-snug text-creme sm:text-xl">
            {grupo.nome}
          </h3>

          {/* quantas cores — mostradas pelas próprias fotos */}
          <div className="mt-3 flex items-center gap-1.5">
            {grupo.cores.slice(0, 5).map((c) => (
              <span
                key={c.chave}
                title={c.cor}
                className={cx(
                  "h-6 w-6 overflow-hidden rounded-full border bg-carvao",
                  c.fotos[0] === capa.url ? "border-ouro" : "border-linha",
                )}
              >
                {c.fotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.fotos[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Bone cor={c.cor} className="h-full w-full scale-150" />
                )}
              </span>
            ))}
            <span className="numeros ml-1 font-etiqueta text-[11px] tracking-wide text-cinza">
              {grupo.cores.length} {grupo.cores.length === 1 ? "cor" : "cores"}
              {grupo.cores.length > 5 ? ` · +${grupo.cores.length - 5}` : ""}
            </span>
          </div>

          {!esgotado && !soUnico && tamanhos.length > 0 ? (
            <p className="mt-2 truncate font-etiqueta text-[11px] uppercase tracking-widest text-fumaca">
              {tamanhos.join(" · ")}
            </p>
          ) : null}

          <p className="numeros mt-3 font-cartaz text-2xl text-creme">
            {variaPreco ? (
              <span className="mr-1 font-etiqueta text-[10px] uppercase tracking-widest text-fumaca">
                a partir de
              </span>
            ) : null}
            {dinheiro(menor)}
          </p>

          <span className="botao-varre mt-4 flex h-11 w-full items-center justify-center border border-linha font-etiqueta text-[11px] uppercase tracking-widest text-creme transition-colors">
            {esgotado ? "Ver o produto" : "Escolher cor e tamanho"}
          </span>
        </div>
      </button>
    </li>
  )
}

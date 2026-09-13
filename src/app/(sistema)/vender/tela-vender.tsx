"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Bone } from "@/lib/bone"
import { Selo, Vazio } from "@/lib/componentes"
import { IconeBusca, IconeCarrinhoVazio, IconeMais, IconeMenos } from "@/lib/icones"
import { criarClienteNavegador } from "@/lib/supabase/client"
import type { Canal, Cliente, FormaPagamento, ModeloFoto, Produto } from "@/lib/supabase/types"
import { ROTULO_PAGAMENTO, cx, dinheiro, formatarTelefone, paraCentavos } from "@/lib/utils"
import {
  agruparPorModelo,
  capaDoModelo,
  compararTamanhos,
  nomeVariacao,
  type GrupoModelo,
} from "@/lib/variacoes"

import { SeletorVariacao, primeiraDisponivel } from "./seletor-variacao"

type Linha = { produto: Produto; quantidade: number }
/** Item que não está no cadastro — digitado na hora, sem estoque para baixar. */
type Avulso = { id: string; descricao: string; centavos: number; quantidade: number }

const PAGAMENTOS: FormaPagamento[] = ["pix", "dinheiro", "debito", "credito"]

export function TelaVender({
  produtos: iniciais,
  fotos,
  clientes,
}: {
  produtos: Produto[]
  fotos: ModeloFoto[]
  clientes: Cliente[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => criarClienteNavegador(), [])

  const [produtos, setProdutos] = useState(iniciais)
  const [busca, setBusca] = useState("")
  const [carrinho, setCarrinho] = useState<Linha[]>([])
  const [pagamento, setPagamento] = useState<FormaPagamento>("pix")
  const [canal, setCanal] = useState<Canal>("varejo")
  const [avulsos, setAvulsos] = useState<Avulso[]>([])
  const [descAvulso, setDescAvulso] = useState("")
  const [valorAvulso, setValorAvulso] = useState("")
  const [desconto, setDesconto] = useState("")
  const [descontoMotivo, setDescontoMotivo] = useState("")
  const [frete, setFrete] = useState("")
  const [cliente, setCliente] = useState("")
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [recibo, setRecibo] = useState<{ numero: number; total: number } | null>(null)

  // Trava de duplo envio (next-dev-integridade §1): o ref fecha a janela que o
  // state sozinho deixa aberta quando chegam dois cliques no mesmo tick.
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  const chaveRef = useRef<string>(globalThis.crypto.randomUUID())

  /** Produto aberto no seletor de cor/tamanho. Guardado com a cor e a variação
   *  iniciais, calculadas no clique — nunca num efeito depois de abrir. */
  const [aberto, setAberto] = useState<{
    modeloId: string
    cor: string
    variacao: string | null
  } | null>(null)

  const grupos = useMemo(() => agruparPorModelo(produtos, fotos), [produtos, fotos])

  /** A busca procura em tudo que o vendedor pode ter na cabeça: nome, cor,
   *  tamanho ou o código da etiqueta. O produto aparece se QUALQUER variação bate. */
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return grupos
    return grupos.filter((g) =>
      g.variacoes.some((v) =>
        `${v.modelo} ${v.cor} ${v.tamanho} ${v.sku}`.toLowerCase().includes(termo),
      ),
    )
  }, [grupos, busca])

  /** O canal decide o preço. A RPC recalcula no servidor — isto aqui é só para
   *  a tela mostrar o mesmo número que vai ser cobrado. */
  function precoDe(produto: Produto): number | null {
    return canal === "atacado" ? produto.preco_atacado_centavos : produto.preco_centavos
  }

  const subtotal =
    carrinho.reduce((soma, l) => soma + l.quantidade * (precoDe(l.produto) ?? 0), 0) +
    avulsos.reduce((soma, a) => soma + a.quantidade * a.centavos, 0)

  const descontoCentavos = Math.min(paraCentavos(desconto) ?? 0, subtotal)
  const freteCentavos = paraCentavos(frete) ?? 0
  const total = subtotal - descontoCentavos + freteCentavos

  const descontoExcede = (paraCentavos(desconto) ?? 0) > subtotal

  const pecas =
    carrinho.reduce((soma, l) => soma + l.quantidade, 0) +
    avulsos.reduce((soma, a) => soma + a.quantidade, 0)

  /** Sugestões de cliente cadastrado. Digitar invalida a escolha anterior —
   *  senão o nome na tela diz um e o vínculo aponta outro. */
  const sugestoes = useMemo(() => {
    if (clienteId) return []
    const termo = cliente.trim().toLowerCase()
    if (termo.length < 2) return []
    return clientes
      .filter((c) =>
        `${c.nome} ${c.telefone ?? ""} ${c.cidade ?? ""}`.toLowerCase().includes(termo),
      )
      .slice(0, 5)
  }, [clientes, cliente, clienteId])

  function noCarrinho(id: string) {
    return carrinho.find((l) => l.produto.id === id)?.quantidade ?? 0
  }

  function trocarCanal(novo: Canal) {
    setCanal(novo)
    setErro(null)

    if (novo === "atacado") {
      const semPreco = carrinho.filter((l) => l.produto.preco_atacado_centavos === null)
      if (semPreco.length > 0) {
        setCarrinho((atual) =>
          atual.filter((l) => l.produto.preco_atacado_centavos !== null),
        )
        setErro(
          `Tirei ${semPreco.length} item(ns) do carrinho: sem preço de atacado cadastrado.`,
        )
      }
    }
  }

  function adicionar(produto: Produto, quantidade = 1) {
    setErro(null)
    if (precoDe(produto) === null) {
      setErro(`${nomeVariacao(produto)} não tem preço de atacado cadastrado.`)
      return
    }
    setCarrinho((atual) => {
      const existente = atual.find((l) => l.produto.id === produto.id)
      const jaTem = existente?.quantidade ?? 0

      // O banco é quem trava de verdade (CHECK + FOR UPDATE). Isto só impede a
      // tela de oferecer peça que não existe.
      const soma = Math.min(quantidade, produto.estoque_atual - jaTem)
      if (soma <= 0) return atual

      if (existente) {
        return atual.map((l) =>
          l.produto.id === produto.id ? { ...l, quantidade: l.quantidade + soma } : l,
        )
      }
      return [...atual, { produto, quantidade: soma }]
    })
  }

  function abrir(grupo: GrupoModelo<Produto>) {
    const capa = capaDoModelo(grupo, (v) => v.estoque_atual - noCarrinho(v.id) > 0)
    const cor =
      grupo.cores.find((c) =>
        c.variacoes.some((v) => v.estoque_atual - noCarrinho(v.id) > 0 && precoDe(v) !== null),
      ) ??
      grupo.cores.find((c) => c.cor === capa.cor) ??
      grupo.cores[0]
    setAberto({
      modeloId: grupo.modeloId,
      cor: cor.chave,
      variacao: primeiraDisponivel(cor, precoDe, noCarrinho),
    })
  }

  function remover(produtoId: string) {
    setCarrinho((atual) =>
      atual
        .map((l) => (l.produto.id === produtoId ? { ...l, quantidade: l.quantidade - 1 } : l))
        .filter((l) => l.quantidade > 0),
    )
  }

  async function finalizar() {
    if (salvandoRef.current) return
    if (carrinho.length === 0 && avulsos.length === 0) return
    if (descontoExcede) return

    salvandoRef.current = true
    setSalvando(true)
    setErro(null)

    try {
      const { data, error } = await supabase.rpc("registrar_venda", {
        _itens: [
          ...carrinho.map((l) => ({ produto_id: l.produto.id, quantidade: l.quantidade })),
          ...avulsos.map((a) => ({
            descricao: a.descricao,
            quantidade: a.quantidade,
            preco_centavos: a.centavos,
          })),
        ],
        _forma_pagamento: pagamento,
        _cliente_nome: clienteId ? undefined : cliente.trim() || undefined,
        _cliente_id: clienteId ?? undefined,
        _canal: canal,
        _desconto_centavos: descontoCentavos,
        _desconto_motivo: descontoMotivo.trim() || undefined,
        _frete_centavos: freteCentavos,
        _idempotency_key: chaveRef.current,
      })

      if (error) {
        setErro(error.message)
        return
      }

      // Tentativa concluída: a próxima venda usa chave nova.
      chaveRef.current = globalThis.crypto.randomUUID()

      const { data: venda } = await supabase
        .from("vendas")
        .select("numero, total_centavos")
        .eq("id", data as string)
        .single()

      const { data: atualizados } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .order("modelo")

      if (atualizados) setProdutos(atualizados as Produto[])

      setRecibo({
        numero: venda?.numero ?? 0,
        total: venda?.total_centavos ?? total,
      })
      setCarrinho([])
      setAvulsos([])
      setDesconto("")
      setDescontoMotivo("")
      setFrete("")
      setCliente("")
      setClienteId(null)
      setRevisando(false)
      router.refresh()
    } catch {
      setErro("Não foi possível registrar a venda. Verifique a conexão e tente de novo.")
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  // ---------------------------------------------------------------- recibo
  if (recibo) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <div className="rounded-2xl border border-ok/25 bg-ok-fundo p-6 text-center">
          <p className="text-sm font-medium text-ok">Venda registrada</p>
          <p className="numeros mt-2 font-display text-4xl font-extrabold text-texto">
            {dinheiro(recibo.total)}
          </p>
          <p className="mt-1 text-sm text-texto-suave">Venda nº {recibo.numero}</p>
          <p className="mt-4 text-xs text-texto-suave">
            O estoque já foi baixado e o faturamento atualizado.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRecibo(null)}
          className="mt-4 h-12 w-full rounded-xl bg-marca text-sm font-semibold text-white transition-colors hover:bg-marca-vivo"
        >
          Registrar outra venda
        </button>
      </div>
    )
  }

  return (
    <div className="pb-40">
      <h1 className="sr-only">Registrar venda</h1>

      {/* Canal antes de tudo: o preço que aparece já é o que vai ser cobrado */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-texto-suave">
          Venda
        </span>
        <div className="flex rounded-lg border border-borda-suave bg-campo p-0.5">
          {(["varejo", "atacado"] as Canal[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => trocarCanal(c)}
              aria-pressed={canal === c}
              className={cx(
                "h-9 rounded-md px-4 text-xs font-semibold capitalize transition-colors",
                canal === c ? "bg-marca text-white" : "text-texto-suave hover:text-texto",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-suave">
          <IconeBusca />
        </span>
        <input
          type="search"
          inputMode="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por modelo, cor ou código"
          aria-label="Buscar produto"
          className="h-12 w-full rounded-xl border border-borda-suave bg-campo pl-10 pr-3.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
        />
      </div>

      {/* Grade de produtos: um card por produto, com as cores e os tamanhos.
          Tocar abre a escolha de cor e tamanho — alvos grandes para o polegar. */}
      {filtrados.length === 0 ? (
        <div className="mt-4">
          <Vazio
            titulo="Nenhum produto encontrado"
            descricao="Tente outro nome, cor, tamanho ou código. Produtos sem estoque continuam aparecendo, mas não entram na venda."
          />
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((g) => {
            const pecas = g.variacoes.reduce((s, v) => s + v.estoque_atual, 0)
            const levando = g.variacoes.reduce((s, v) => s + noCarrinho(v.id), 0)
            const capa = capaDoModelo(g, (v) => v.estoque_atual > 0)
            const tamanhos = [...new Set(g.variacoes.map((v) => v.tamanho))].sort(
              compararTamanhos,
            )
            const precos = g.variacoes
              .map((v) => precoDe(v))
              .filter((x): x is number => x !== null)
            const menor = precos.length ? Math.min(...precos) : null
            const variaPreco = precos.length > 1 && Math.max(...precos) !== menor

            return (
              <li key={g.modeloId}>
                <button
                  type="button"
                  onClick={() => abrir(g)}
                  className={cx(
                    "group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-superficie text-left shadow-sm transition-colors",
                    levando > 0 ? "border-acento/60" : "border-borda-suave hover:border-marca/40",
                  )}
                >
                  <div className="relative aspect-square w-full bg-fundo">
                    {capa.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={capa.url}
                        alt=""
                        loading="lazy"
                        className={cx("h-full w-full object-cover", pecas === 0 && "opacity-50 grayscale")}
                      />
                    ) : (
                      <div className="grid h-full place-items-center p-6">
                        <Bone cor={capa.cor} className="h-auto w-full" />
                      </div>
                    )}

                    {levando > 0 ? (
                      <span className="numeros absolute right-2 top-2 rounded-full bg-acento-vivo px-2 py-0.5 text-[11px] font-bold text-marca">
                        {levando} no carrinho
                      </span>
                    ) : null}
                    {pecas === 0 ? (
                      <span className="absolute left-2 top-2">
                        <Selo tom="erro">Esgotado</Selo>
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-texto">
                      {g.nome}
                    </p>

                    {/* as cores do produto, pelas próprias fotos */}
                    <div className="mt-2 flex items-center gap-1">
                      {g.cores.slice(0, 5).map((c) => (
                        <span
                          key={c.chave}
                          title={c.cor}
                          className="h-5 w-5 overflow-hidden rounded-full border border-borda-suave bg-fundo"
                        >
                          {c.fotos[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.fotos[0]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Bone cor={c.cor} className="h-full w-full scale-150" />
                          )}
                        </span>
                      ))}
                      <span className="numeros ml-1 text-[11px] text-texto-suave">
                        {g.cores.length} {g.cores.length === 1 ? "cor" : "cores"}
                        {g.cores.length > 5 ? ` (+${g.cores.length - 5})` : ""}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-[11px] text-texto-suave">
                      {tamanhos.join(" · ")}
                    </p>

                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      {menor === null ? (
                        <span className="text-[11px] text-texto-suave">sem preço de atacado</span>
                      ) : (
                        <span className="numeros text-sm font-bold text-texto">
                          {variaPreco ? <span className="text-[10px] font-medium text-texto-suave">a partir de </span> : null}
                          {dinheiro(menor)}
                        </span>
                      )}
                      <span
                        className={cx(
                          "numeros text-[11px]",
                          pecas === 0 ? "text-erro" : "text-texto-suave",
                        )}
                      >
                        {pecas} un
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {aberto
        ? (() => {
            const grupo = grupos.find((g) => g.modeloId === aberto.modeloId)
            if (!grupo) return null
            return (
              <SeletorVariacao
                key={aberto.modeloId}
                grupo={grupo}
                corInicial={aberto.cor}
                variacaoInicial={aberto.variacao}
                precoDe={precoDe}
                noCarrinho={noCarrinho}
                onAdicionar={adicionar}
                onFechar={() => setAberto(null)}
              />
            )
          })()
        : null}

      {/* Barra fixa do carrinho */}
      {carrinho.length > 0 || avulsos.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda-suave bg-superficie/95 backdrop-blur lg:pl-48">
          <div className="mx-auto max-w-3xl px-4 py-3">
            {erro ? (
              <p
                role="alert"
                className="mb-2.5 rounded-lg border border-erro/30 bg-erro-fundo px-3 py-2 text-xs text-erro"
              >
                {erro}
              </p>
            ) : null}

            {revisando ? (
              <div className="mb-3 space-y-3">
                <ul className="rolagem-suave max-h-44 space-y-1.5 overflow-y-auto">
                  {carrinho.map((l) => (
                    <li
                      key={l.produto.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      {/* O menos mora aqui: a grade agora abre o seletor de cor e
                          tamanho, então é na revisão que se tira peça do carrinho. */}
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => remover(l.produto.id)}
                          aria-label={`Tirar um ${nomeVariacao(l.produto)}`}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-borda-suave text-texto transition-colors hover:border-erro/40 hover:text-erro"
                        >
                          <IconeMenos />
                        </button>
                        <span className="numeros w-6 text-center font-semibold text-texto">
                          {l.quantidade}
                        </span>
                        <button
                          type="button"
                          onClick={() => adicionar(l.produto)}
                          disabled={l.quantidade >= l.produto.estoque_atual}
                          aria-label={`Mais um ${nomeVariacao(l.produto)}`}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-borda-suave text-texto transition-colors hover:border-marca/40 disabled:cursor-not-allowed disabled:text-borda"
                        >
                          <IconeMais />
                        </button>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-texto-suave">
                        {nomeVariacao(l.produto)}
                      </span>
                      <span className="numeros shrink-0 pl-2 font-medium text-texto">
                        {dinheiro(l.quantidade * (precoDe(l.produto) ?? 0))}
                      </span>
                    </li>
                  ))}
                  {avulsos.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-xs">
                      <span className="truncate text-texto-suave">
                        <span className="numeros font-semibold text-texto">
                          {a.quantidade}×
                        </span>{" "}
                        {a.descricao}{" "}
                        <span className="text-[10px] uppercase tracking-wide text-acento">
                          avulso
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 pl-2">
                        <span className="numeros font-medium text-texto">
                          {dinheiro(a.quantidade * a.centavos)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAvulsos((x) => x.filter((y) => y.id !== a.id))}
                          aria-label={`Remover ${a.descricao}`}
                          className="px-1 text-texto-suave hover:text-erro"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Item avulso: coisa que não está no cadastro e não tem estoque */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={descAvulso}
                    onChange={(e) => setDescAvulso(e.target.value)}
                    placeholder="Item avulso"
                    aria-label="Descrição do item avulso"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorAvulso}
                    onChange={(e) => setValorAvulso(e.target.value)}
                    placeholder="R$"
                    aria-label="Valor do item avulso"
                    className="numeros h-10 w-20 rounded-lg border border-borda-suave bg-campo px-2.5 text-sm outline-none focus:border-acento/60"
                  />
                  <button
                    type="button"
                    disabled={!descAvulso.trim() || paraCentavos(valorAvulso) === null}
                    onClick={() => {
                      const c = paraCentavos(valorAvulso)
                      if (!descAvulso.trim() || c === null) return
                      setAvulsos((x) => [
                        ...x,
                        {
                          id: globalThis.crypto.randomUUID(),
                          descricao: descAvulso.trim(),
                          centavos: c,
                          quantidade: 1,
                        },
                      ])
                      setDescAvulso("")
                      setValorAvulso("")
                    }}
                    className="h-10 shrink-0 rounded-lg border border-borda-suave px-3 text-xs font-semibold text-texto transition-colors hover:border-marca hover:bg-marca hover:text-white disabled:opacity-40"
                  >
                    Somar
                  </button>
                </div>

                {/* Desconto e frete */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    placeholder="Desconto R$"
                    aria-label="Desconto do pedido"
                    className={cx(
                      "numeros h-10 min-w-0 flex-1 rounded-lg border bg-campo px-3 text-sm outline-none",
                      descontoExcede
                        ? "border-erro"
                        : "border-borda-suave focus:border-acento/60",
                    )}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={frete}
                    onChange={(e) => setFrete(e.target.value)}
                    placeholder="Frete R$"
                    aria-label="Frete do pedido"
                    className="numeros h-10 w-28 rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60"
                  />
                </div>

                {descontoCentavos > 0 ? (
                  <input
                    type="text"
                    value={descontoMotivo}
                    onChange={(e) => setDescontoMotivo(e.target.value)}
                    placeholder="Motivo do desconto (opcional)"
                    aria-label="Motivo do desconto"
                    className="h-10 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60"
                  />
                ) : null}

                {descontoExcede ? (
                  <p role="alert" className="text-[11px] text-erro">
                    O desconto é maior que o valor dos itens.
                  </p>
                ) : null}

                {/* A conta aberta: o vendedor vê como se chegou no total */}
                {descontoCentavos > 0 || freteCentavos > 0 ? (
                  <dl className="space-y-0.5 border-t border-borda-suave pt-2 text-xs">
                    <div className="flex justify-between text-texto-suave">
                      <dt>Itens</dt>
                      <dd className="numeros">{dinheiro(subtotal)}</dd>
                    </div>
                    {descontoCentavos > 0 ? (
                      <div className="flex justify-between text-erro">
                        <dt>Desconto</dt>
                        <dd className="numeros">− {dinheiro(descontoCentavos)}</dd>
                      </div>
                    ) : null}
                    {freteCentavos > 0 ? (
                      <div className="flex justify-between text-texto-suave">
                        <dt>Frete</dt>
                        <dd className="numeros">+ {dinheiro(freteCentavos)}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}


                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-texto-suave">
                    Pagamento
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PAGAMENTOS.map((forma) => (
                      <button
                        key={forma}
                        type="button"
                        onClick={() => setPagamento(forma)}
                        className={cx(
                          "h-10 rounded-lg border px-3.5 text-xs font-medium transition-colors",
                          pagamento === forma
                            ? "border-marca bg-marca text-white"
                            : "border-borda-suave bg-campo text-texto-suave hover:border-acento/40",
                        )}
                      >
                        {ROTULO_PAGAMENTO[forma]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={cliente}
                    onChange={(e) => {
                      setCliente(e.target.value)
                      setClienteId(null)
                    }}
                    placeholder="Cliente (opcional) — digite para buscar"
                    aria-label="Cliente"
                    autoComplete="off"
                    className={cx(
                      "h-11 w-full rounded-lg border bg-campo px-3.5 text-sm outline-none focus:ring-2 focus:ring-acento/25",
                      clienteId ? "border-ok/50" : "border-borda-suave focus:border-acento/60",
                    )}
                  />

                  {clienteId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCliente("")
                        setClienteId(null)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-texto-suave hover:text-erro"
                    >
                      trocar
                    </button>
                  ) : null}

                  {sugestoes.length > 0 ? (
                    <ul className="absolute bottom-full z-10 mb-1 max-h-44 w-full overflow-y-auto rounded-lg border border-borda-suave bg-superficie shadow-lg">
                      {sugestoes.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCliente(c.nome)
                              setClienteId(c.id)
                            }}
                            className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-fundo"
                          >
                            <span className="text-sm font-medium text-texto">{c.nome}</span>
                            <span className="numeros text-xs text-texto-suave">
                              {formatarTelefone(c.telefone)}
                              {c.cidade ? ` · ${c.cidade}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {clienteId ? (
                  <p className="text-[11px] text-ok">
                    Cliente cadastrado — dá para mandar mensagem depois.
                  </p>
                ) : cliente.trim() ? (
                  <p className="text-[11px] text-texto-suave">
                    Nome solto, sem cadastro. Não dá para mandar mensagem depois.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-texto-suave">
                  {pecas} {pecas === 1 ? "peça" : "peças"} · {canal}
                  {revisando ? ` · ${ROTULO_PAGAMENTO[pagamento]}` : ""}
                </p>
                <p className="numeros font-display text-xl font-extrabold text-texto">
                  {dinheiro(total)}
                </p>
              </div>

              {revisando ? (
                <button
                  type="button"
                  onClick={() => setRevisando(false)}
                  disabled={salvando}
                  className="h-12 rounded-xl border border-borda-suave px-4 text-sm font-medium text-texto-suave transition-colors hover:text-texto disabled:opacity-50"
                >
                  Voltar
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => (revisando ? finalizar() : setRevisando(true))}
                disabled={salvando || (revisando && descontoExcede)}
                className="h-12 shrink-0 rounded-xl bg-marca px-6 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
              >
                {salvando ? "Salvando…" : revisando ? "Confirmar venda" : "Fechar venda"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {produtos.length > 0 && carrinho.length === 0 && avulsos.length === 0 ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-texto-suave">
          <IconeCarrinhoVazio className="h-4 w-4" />
          Toque no + para montar a venda.
        </p>
      ) : null}
    </div>
  )
}

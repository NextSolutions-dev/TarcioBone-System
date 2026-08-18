"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Selo, Vazio } from "@/lib/componentes"
import { IconeBusca, IconeCarrinhoVazio, IconeMais, IconeMenos } from "@/lib/icones"
import { criarClienteNavegador } from "@/lib/supabase/client"
import type { FormaPagamento, Produto } from "@/lib/supabase/types"
import { ROTULO_PAGAMENTO, cx, dinheiro } from "@/lib/utils"

type Linha = { produto: Produto; quantidade: number }

const PAGAMENTOS: FormaPagamento[] = ["pix", "dinheiro", "debito", "credito"]

export function TelaVender({ produtos: iniciais }: { produtos: Produto[] }) {
  const router = useRouter()
  const supabase = useMemo(() => criarClienteNavegador(), [])

  const [produtos, setProdutos] = useState(iniciais)
  const [busca, setBusca] = useState("")
  const [carrinho, setCarrinho] = useState<Linha[]>([])
  const [pagamento, setPagamento] = useState<FormaPagamento>("pix")
  const [cliente, setCliente] = useState("")
  const [revisando, setRevisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [recibo, setRecibo] = useState<{ numero: number; total: number } | null>(null)

  // Trava de duplo envio (next-dev-integridade §1): o ref fecha a janela que o
  // state sozinho deixa aberta quando chegam dois cliques no mesmo tick.
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  const chaveRef = useRef<string>(globalThis.crypto.randomUUID())

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return produtos
    return produtos.filter((p) =>
      `${p.modelo} ${p.cor} ${p.sku}`.toLowerCase().includes(termo),
    )
  }, [produtos, busca])

  const total = carrinho.reduce(
    (soma, l) => soma + l.quantidade * l.produto.preco_centavos,
    0,
  )
  const pecas = carrinho.reduce((soma, l) => soma + l.quantidade, 0)

  function noCarrinho(id: string) {
    return carrinho.find((l) => l.produto.id === id)?.quantidade ?? 0
  }

  function adicionar(produto: Produto) {
    setErro(null)
    setCarrinho((atual) => {
      const existente = atual.find((l) => l.produto.id === produto.id)
      const jaTem = existente?.quantidade ?? 0

      if (jaTem >= produto.estoque_atual) return atual

      if (existente) {
        return atual.map((l) =>
          l.produto.id === produto.id ? { ...l, quantidade: l.quantidade + 1 } : l,
        )
      }
      return [...atual, { produto, quantidade: 1 }]
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
    if (carrinho.length === 0) return

    salvandoRef.current = true
    setSalvando(true)
    setErro(null)

    try {
      const { data, error } = await supabase.rpc("registrar_venda", {
        _itens: carrinho.map((l) => ({
          produto_id: l.produto.id,
          quantidade: l.quantidade,
        })),
        _forma_pagamento: pagamento,
        _cliente_nome: cliente.trim() || undefined,
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
      setCliente("")
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

      {/* Grade de produtos — alvos grandes para o polegar */}
      {filtrados.length === 0 ? (
        <div className="mt-4">
          <Vazio
            titulo="Nenhum boné encontrado"
            descricao="Tente outro modelo, cor ou código. Produtos sem estoque continuam aparecendo, mas não entram na venda."
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((produto) => {
            const qtd = noCarrinho(produto.id)
            const esgotado = produto.estoque_atual === 0
            const noLimite = qtd >= produto.estoque_atual

            return (
              <li key={produto.id}>
                <div
                  className={cx(
                    "flex items-center gap-3 rounded-xl border bg-superficie p-3 shadow-sm transition-colors",
                    qtd > 0 ? "border-acento/50" : "border-borda-suave",
                    esgotado && "opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-texto">
                      {produto.modelo}
                    </p>
                    <p className="truncate text-xs text-texto-suave">
                      {produto.cor} · {produto.sku}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="numeros text-sm font-bold text-texto">
                        {dinheiro(produto.preco_centavos)}
                      </span>
                      {esgotado ? (
                        <Selo tom="erro">Esgotado</Selo>
                      ) : produto.estoque_atual <= produto.estoque_minimo ? (
                        <Selo tom="alerta">{produto.estoque_atual} restantes</Selo>
                      ) : (
                        <span className="numeros text-xs text-texto-suave">
                          {produto.estoque_atual} em estoque
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {qtd > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => remover(produto.id)}
                          aria-label={`Remover um ${produto.modelo} ${produto.cor}`}
                          className="grid h-11 w-11 place-items-center rounded-lg border border-borda-suave text-texto transition-colors hover:border-erro/40 hover:text-erro"
                        >
                          <IconeMenos />
                        </button>
                        <span className="numeros w-6 text-center text-sm font-bold text-texto">
                          {qtd}
                        </span>
                      </>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => adicionar(produto)}
                      disabled={esgotado || noLimite}
                      aria-label={`Adicionar ${produto.modelo} ${produto.cor}`}
                      className="grid h-11 w-11 place-items-center rounded-lg bg-marca text-white transition-colors hover:bg-marca-vivo disabled:cursor-not-allowed disabled:bg-borda disabled:text-texto-suave"
                    >
                      <IconeMais />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Barra fixa do carrinho */}
      {carrinho.length > 0 ? (
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
                <ul className="rolagem-suave max-h-32 space-y-1 overflow-y-auto">
                  {carrinho.map((l) => (
                    <li
                      key={l.produto.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate text-texto-suave">
                        <span className="numeros font-semibold text-texto">
                          {l.quantidade}×
                        </span>{" "}
                        {l.produto.modelo} · {l.produto.cor}
                      </span>
                      <span className="numeros shrink-0 pl-2 font-medium text-texto">
                        {dinheiro(l.quantidade * l.produto.preco_centavos)}
                      </span>
                    </li>
                  ))}
                </ul>

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

                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nome do cliente (opcional)"
                  aria-label="Nome do cliente"
                  className="h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
                />
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-texto-suave">
                  {pecas} {pecas === 1 ? "peça" : "peças"}
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
                disabled={salvando}
                className="h-12 shrink-0 rounded-xl bg-marca px-6 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
              >
                {salvando ? "Salvando…" : revisando ? "Confirmar venda" : "Fechar venda"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {produtos.length > 0 && carrinho.length === 0 ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-texto-suave">
          <IconeCarrinhoVazio className="h-4 w-4" />
          Toque no + para montar a venda.
        </p>
      ) : null}
    </div>
  )
}

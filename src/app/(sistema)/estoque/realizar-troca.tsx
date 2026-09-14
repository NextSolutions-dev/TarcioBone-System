"use client"

import { useActionState, useRef, useState, useTransition } from "react"

import type { Produto } from "@/lib/supabase/types"
import { diasDesde, dinheiro } from "@/lib/utils"
import { nomeVariacao } from "@/lib/variacoes"

import {
  buscarVendaParaAtendimento,
  registrarAtendimento,
  type EstadoAtendimento,
  type VendaParaAtendimento,
  type ItemParaAtendimento,
} from "./atendimento-acoes"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo = "block text-[11px] font-medium uppercase tracking-wider text-texto-suave"

/** Prévia em inteiros; a RPC recalcula e rejeita se o valor mudar. */
function preverReembolso(
  venda: VendaParaAtendimento,
  item: ItemParaAtendimento,
  quantidade: number,
): number | null {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > item.disponivel) {
    return null
  }
  const descontoAte = (bruto: number) => {
    if (venda.subtotal_centavos === 0) return 0
    const numerador = BigInt(venda.desconto_centavos) * BigInt(bruto)
    const divisor = BigInt(venda.subtotal_centavos)
    return Number((numerador * BigInt(2) + divisor) / (divisor * BigInt(2)))
  }
  const antes = venda.bruto_ja_reembolsado_centavos
  const depois = antes + quantidade * item.preco_centavos
  const frete = venda.quantidade_ja_reembolsada + quantidade === venda.quantidade_vendida
    ? venda.frete_centavos : 0
  return depois - antes - (descontoAte(depois) - descontoAte(antes)) + frete
}

export function RealizarTroca({
  produtos,
  prazo,
}: {
  produtos: Produto[]
  prazo: number
}) {
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<"troca" | "reembolso" | null>(null)
  const [numero, setNumero] = useState("")
  const [venda, setVenda] = useState<VendaParaAtendimento | null>(null)
  const [itemId, setItemId] = useState("")
  const [quantidade, setQuantidade] = useState(1)
  const [repor, setRepor] = useState(false)
  const [erroBusca, setErroBusca] = useState("")
  const [buscando, iniciarBusca] = useTransition()
  const travaBusca = useRef(false)
  const travaEnvio = useRef(false)
  const [chave, setChave] = useState("")

  const [estado, acao, pendente] = useActionState<EstadoAtendimento, FormData>(
    async (anterior, dados) => {
      if (travaEnvio.current) return anterior
      travaEnvio.current = true
      try {
        const resultado = await registrarAtendimento(anterior, dados)
        if (resultado.ok) {
          setVenda(null)
          setItemId("")
          setQuantidade(1)
          setRepor(false)
          setChave(crypto.randomUUID())
        }
        return resultado
      } finally {
        travaEnvio.current = false
      }
    },
    {},
  )

  function buscar() {
    if (travaBusca.current) return
    travaBusca.current = true
    setErroBusca("")
    iniciarBusca(async () => {
      try {
        const resultado = await buscarVendaParaAtendimento(numero)
        if (resultado.erro) {
          setVenda(null)
          setErroBusca(resultado.erro)
        } else {
          setVenda(resultado.venda ?? null)
          setItemId("")
          setQuantidade(1)
          setRepor(false)
        }
      } catch {
        setErroBusca("Não foi possível consultar a venda. Tente novamente.")
      } finally {
        travaBusca.current = false
      }
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAberto(true)
          setChave(crypto.randomUUID())
        }}
        className="h-11 rounded-lg bg-marca px-4 text-sm font-semibold text-white hover:bg-marca-vivo"
      >
        Realizar troca
      </button>
    )
  }

  const elegiveis = (venda?.itens ?? []).filter(
    (item) => item.disponivel > 0 && (tipo !== "troca" || item.produto_id !== null),
  )
  const escolhido = elegiveis.find((item) => item.id === itemId)
  const previsao = tipo === "reembolso" && venda && escolhido
    ? preverReembolso(venda, escolhido, quantidade) : null
  const dias = venda ? diasDesde(venda.criada_em) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-texto">Realizar troca</p>
        <button type="button" onClick={() => setAberto(false)}
          className="text-xs text-texto-suave underline-offset-2 hover:underline">
          Fechar
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => { setTipo("reembolso"); setItemId(""); setQuantidade(1); setRepor(false) }}
          className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${tipo === "reembolso" ? "border-acento bg-acento/10 text-acento" : "border-borda-suave text-texto"}`}>
          Reembolso
          <span className="mt-1 block text-xs font-normal text-texto-suave">
            Abate o valor devolvido do faturamento. Item avulso não mexe no estoque.
          </span>
        </button>
        <button type="button" onClick={() => { setTipo("troca"); setItemId(""); setQuantidade(1); setRepor(false) }}
          className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${tipo === "troca" ? "border-acento bg-acento/10 text-acento" : "border-borda-suave text-texto"}`}>
          Trocar por outra peça
          <span className="mt-1 block text-xs font-normal text-texto-suave">
            Entrega outra peça sem alterar o valor da venda.
          </span>
        </button>
      </div>

      {tipo ? (
        <div className="space-y-3 rounded-lg border border-borda-suave bg-fundo/60 p-3">
          <label htmlFor="numero-venda-troca" className={rotulo}>Número da venda</label>
          <div className="flex gap-2">
            <input id="numero-venda-troca" type="number" min={1} inputMode="numeric"
              value={numero} onChange={(evento) => setNumero(evento.target.value)}
              onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); buscar() } }}
              placeholder="Ex.: 123" className={campo} />
            <button type="button" onClick={buscar} disabled={buscando}
              className="rounded-lg bg-marca px-4 text-sm font-semibold text-white disabled:opacity-60">
              {buscando ? "Buscando…" : "Buscar"}
            </button>
          </div>
          {erroBusca ? <p role="alert" className="text-sm text-erro">{erroBusca}</p> : null}
        </div>
      ) : null}

      {tipo && venda ? (
        <form action={acao} className="space-y-4 rounded-lg border border-borda-suave p-3">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="idempotency_key" value={chave} />
          {previsao !== null ? (
            <input type="hidden" name="reembolso_esperado_centavos" value={previsao} />
          ) : null}
          <div className="text-sm text-texto">
            <p className="font-semibold">Venda nº {venda.numero}
              {venda.cliente_nome ? ` · ${venda.cliente_nome}` : ""}
            </p>
            <p className={`text-xs ${dias > prazo ? "text-alerta" : "text-texto-suave"}`}>
              Feita há {dias} {dias === 1 ? "dia" : "dias"} · referência: {prazo} dias.
              {dias > prazo ? " Fora do prazo; o dono pode decidir aceitar." : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="item-venda-troca" className={rotulo}>Peça devolvida</label>
            <select id="item-venda-troca" name="venda_item_id" required value={itemId}
              onChange={(evento) => { setItemId(evento.target.value); setQuantidade(1); setRepor(false) }}
              className={campo}>
              <option value="">Escolha o item da venda</option>
              {elegiveis.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.rotulo} · {item.disponivel} disponível(is)
                </option>
              ))}
            </select>
            {elegiveis.length === 0 ? (
              <p className="text-xs text-alerta">
                Nenhum item elegível. Avulsos só podem ser reembolsados.
              </p>
            ) : null}
          </div>
          {escolhido ? (
            <p className="text-xs text-texto-suave">
              Preço original: {dinheiro(escolhido.preco_centavos)} por peça.
              O reembolso considera também o desconto original.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="qtd-troca" className={rotulo}>Quantidade</label>
              <input id="qtd-troca" name="quantidade" type="number" min={1}
                max={escolhido?.disponivel ?? 1} value={quantidade} required
                onChange={(evento) => setQuantidade(Number(evento.target.value))}
                className={campo} />
            </div>
            {tipo === "troca" ? (
              <div className="space-y-1.5">
                <label htmlFor="peca-nova" className={rotulo}>Peça que o cliente levará</label>
                <select id="peca-nova" name="produto_novo_id" required className={campo}
                  defaultValue="">
                  <option value="">Escolha uma variação</option>
                  {produtos.filter((produto) => produto.estoque_atual > 0 || (repor && produto.id === escolhido?.produto_id))
                    .map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {nomeVariacao(produto)} · saldo {produto.estoque_atual}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
          </div>
          {tipo === "reembolso" && previsao !== null ? (
            <p className="rounded-lg border border-acento/30 bg-acento/5 p-3 text-sm text-texto">
              Valor a reembolsar: <strong className="numeros">{dinheiro(previsao)}</strong>
              <span className="block text-xs text-texto-suave">
                Desconto rateado. Frete somente se toda a venda for reembolsada.
                Se a venda mudar, a confirmação será recusada.
              </span>
            </p>
          ) : null}
          {escolhido?.produto_id ? (
            <label className="flex items-start gap-2 rounded-lg border border-borda-suave p-3 text-sm text-texto">
              <input type="checkbox" name="repor_estoque" checked={repor}
                onChange={(evento) => setRepor(evento.target.checked)} className="mt-1" />
              <span>
                A peça devolvida está apta para revenda: adicionar ao estoque.
                <span className="block text-xs text-texto-suave">
                  Deixe desmarcado se estiver com defeito. Nunca volta automaticamente.
                </span>
              </span>
            </label>
          ) : null}
          <div className="space-y-1.5">
            <label htmlFor="motivo-troca" className={rotulo}>Motivo</label>
            <textarea id="motivo-troca" name="motivo" required maxLength={200} rows={2}
              className="w-full rounded-lg border border-borda-suave bg-campo px-3 py-2 text-sm" />
          </div>
          {estado.erro ? <p role="alert" className="text-sm text-erro">{estado.erro}</p> : null}
          {estado.ok ? <p role="status" className="text-sm text-ok">{estado.ok}</p> : null}
          <button type="submit" disabled={pendente || !escolhido || (tipo === "reembolso" && previsao === null)}
            className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white disabled:opacity-60">
            {pendente ? "Salvando…" : tipo === "reembolso" ? "Confirmar reembolso" : "Confirmar troca"}
          </button>
        </form>
      ) : null}
      {!venda && estado.ok ? <p role="status" className="text-sm text-ok">{estado.ok}</p> : null}
    </div>
  )
}

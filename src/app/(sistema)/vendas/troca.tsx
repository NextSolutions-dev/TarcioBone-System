"use client"

import { useActionState, useRef, useState } from "react"
import { useFormStatus } from "react-dom"

import { IconeAlerta, IconeTroca } from "@/lib/icones"
import { cx } from "@/lib/utils"

import { registrarTroca, type EstadoTroca } from "./acoes"

export type ItemTrocavel = {
  id: string
  rotulo: string
  quantidade: number
  jaTrocado: number
}

export type ProdutoDisponivel = {
  id: string
  rotulo: string
  estoque: number
}

const campo =
  "h-10 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotuloCampo = "block text-xs font-medium uppercase tracking-wider text-texto-suave"

function Confirmar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-lg bg-marca px-4 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Registrando…" : "Registrar troca"}
    </button>
  )
}

export function Troca({
  numero,
  itens,
  produtos,
  diasDaVenda,
  prazo,
}: {
  numero: number
  itens: ItemTrocavel[]
  produtos: ProdutoDisponivel[]
  diasDaVenda: number
  prazo: number
}) {
  const [aberto, setAberto] = useState(false)
  const [levaOutra, setLevaOutra] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  /** Mesma trava da venda: a chave nasce ao abrir o formulário e só troca
   *  depois de um registro aceito, então clique repetido não gera duas trocas.
   *  É estado, não ref: o valor vai para dentro do HTML, e ler ref durante o
   *  render é justamente o que o `react-hooks/refs` proíbe. */
  const [chave, setChave] = useState("")

  const [estado, acao] = useActionState<EstadoTroca, FormData>(
    async (anterior, dados) => {
      const resposta = await registrarTroca(anterior, dados)
      if (resposta.ok) {
        setChave(crypto.randomUUID())
        formRef.current?.reset()
        setLevaOutra(false)
      }
      return resposta
    },
    {},
  )

  // Item cujas peças já foram todas trocadas não tem o que oferecer.
  const disponiveis = itens.filter((i) => i.quantidade - i.jaTrocado > 0)
  const foraDoPrazo = diasDaVenda > prazo

  if (!aberto) {
    if (disponiveis.length === 0) return null
    return (
      <button
        type="button"
        onClick={() => {
          setChave(crypto.randomUUID())
          setAberto(true)
        }}
        className="mt-2 flex h-9 items-center gap-1.5 rounded-lg border border-borda-suave px-3 text-xs font-semibold text-texto-suave transition-colors hover:border-acento/40 hover:text-acento"
      >
        <IconeTroca className="h-4 w-4" />
        Registrar troca
      </button>
    )
  }

  return (
    <form
      ref={formRef}
      action={acao}
      className="mt-3 space-y-3 rounded-lg border border-borda-suave bg-fundo/70 p-3"
    >
      <input type="hidden" name="idempotency_key" value={chave} />

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-texto">Troca da venda nº {numero}</p>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-xs text-texto-suave underline-offset-2 hover:underline"
        >
          Fechar
        </button>
      </div>

      {/* O prazo é referência, não trava: quem decide é o dono. */}
      <p
        className={cx(
          "flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs",
          foraDoPrazo
            ? "border border-alerta/30 bg-alerta-fundo text-alerta"
            : "bg-superficie text-texto-suave",
        )}
      >
        {foraDoPrazo ? <IconeAlerta className="mt-px h-3.5 w-3.5 shrink-0" /> : null}
        <span>
          Vendida há <span className="numeros font-semibold">{diasDaVenda}</span>{" "}
          {diasDaVenda === 1 ? "dia" : "dias"}
          {foraDoPrazo
            ? ` — passou do prazo de ${prazo} dias. Você pode aceitar mesmo assim.`
            : ` — dentro do prazo de ${prazo} dias.`}
        </span>
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <div className="space-y-1.5">
          <label htmlFor={`item-${numero}`} className={rotuloCampo}>
            Peça devolvida
          </label>
          <select id={`item-${numero}`} name="venda_item_id" required className={campo}>
            {disponiveis.map((i) => (
              <option key={i.id} value={i.id}>
                {i.rotulo} — {i.quantidade - i.jaTrocado} disponível(is) para troca
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`qtd-${numero}`} className={rotuloCampo}>
            Quantidade
          </label>
          <input
            id={`qtd-${numero}`}
            name="quantidade"
            type="number"
            min={1}
            defaultValue={1}
            required
            className={`${campo} numeros`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`motivo-${numero}`} className={rotuloCampo}>
          Motivo / especificação
        </label>
        <input
          id={`motivo-${numero}`}
          name="motivo"
          required
          maxLength={280}
          placeholder="Ex.: cliente quis outra cor; aba veio torta"
          className={campo}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-texto">
        <input
          type="checkbox"
          name="volta_ao_estoque"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-borda accent-marca"
        />
        <span>
          A peça voltou para o estoque
          <span className="block text-xs text-texto-suave">
            Desmarque se veio com defeito e não pode ser revendida — somar ao saldo
            faria o catálogo oferecer o que não existe.
          </span>
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm text-texto">
        <input
          type="checkbox"
          checked={levaOutra}
          onChange={(e) => setLevaOutra(e.target.checked)}
          className="h-4 w-4 rounded border-borda accent-marca"
        />
        O cliente levou outra peça agora
      </label>

      {levaOutra ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <div className="space-y-1.5">
            <label htmlFor={`novo-${numero}`} className={rotuloCampo}>
              Peça levada
            </label>
            <select id={`novo-${numero}`} name="produto_novo_id" required className={campo}>
              <option value="">Escolha…</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.rotulo} — {p.estoque} em estoque
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`qtdnova-${numero}`} className={rotuloCampo}>
              Quantidade
            </label>
            <input
              id={`qtdnova-${numero}`}
              name="quantidade_nova"
              type="number"
              min={1}
              defaultValue={1}
              required
              className={`${campo} numeros`}
            />
          </div>
        </div>
      ) : null}

      <p className="text-xs text-texto-suave">
        A troca <strong className="font-semibold">não altera o valor da venda</strong> — o
        dinheiro daquele dia foi recebido de verdade. Se houver diferença de preço,
        registre uma venda nova com item avulso.
      </p>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-lg border border-erro/30 bg-erro-fundo px-3 py-2 text-sm text-erro"
        >
          {estado.erro}
        </p>
      ) : null}

      {estado.ok ? (
        <p
          role="status"
          className="rounded-lg border border-ok/30 bg-ok-fundo px-3 py-2 text-sm text-ok"
        >
          {estado.ok}
        </p>
      ) : null}

      <Confirmar />
    </form>
  )
}

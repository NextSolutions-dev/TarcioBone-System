"use client"

import { useActionState, useRef } from "react"
import { useFormStatus } from "react-dom"

import type { Produto } from "@/lib/supabase/types"

import { registrarTrocaEstoque, type EstadoTrocaEstoque } from "./acoes"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo = "block text-[11px] font-medium uppercase tracking-wider text-texto-suave"

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Salvando…" : "Registrar troca"}
    </button>
  )
}

/** Troca manual no estoque: a peça que o cliente devolveu entra, a que ele
 *  levou no lugar sai. As duas mudanças nascem juntas numa função só do banco. */
export function FormularioTroca({ produtos }: { produtos: Produto[] }) {
  const formRef = useRef<HTMLFormElement>(null)

  /** Chave de envio contra duplo clique. Duas regras:
   *  - nasce no envio, não no render: este formulário fica sempre na tela, e
   *    gerar no render daria uma chave no servidor e outra no navegador;
   *  - só é descartada quando o formulário é EDITADO, nunca ao terminar o envio.
   *    O `useActionState` enfileira: o segundo clique roda depois do primeiro, e
   *    se a chave zerasse no sucesso ele chegaria com chave nova e viraria outra
   *    troca. Uma troca de verdade sempre exige editar — o reset esvazia as peças. */
  const chave = useRef<string | null>(null)

  const [estado, acao] = useActionState<EstadoTrocaEstoque, FormData>(
    async (anterior, dados) => {
      chave.current ??= crypto.randomUUID()
      dados.set("idempotency_key", chave.current)

      const resposta = await registrarTrocaEstoque(anterior, dados)
      if (resposta.ok) formRef.current?.reset()
      return resposta
    },
    {},
  )

  return (
    <form
      ref={formRef}
      action={acao}
      onChange={() => {
        chave.current = null
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <div className="space-y-1.5">
          <label htmlFor="produto_entra_id" className={rotulo}>
            Peça que volta
          </label>
          <select
            id="produto_entra_id"
            name="produto_entra_id"
            required
            defaultValue=""
            className={campo}
          >
            <option value="" disabled>
              O que o cliente devolveu…
            </option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.modelo} · {p.cor} ({p.estoque_atual} un)
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="quantidade_entra" className={rotulo}>
            Qtd.
          </label>
          <input
            id="quantidade_entra"
            name="quantidade_entra"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={1}
            required
            className={`numeros ${campo}`}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <div className="space-y-1.5">
          <label htmlFor="produto_sai_id" className={rotulo}>
            Peça que sai
          </label>
          <select
            id="produto_sai_id"
            name="produto_sai_id"
            required
            defaultValue=""
            className={campo}
          >
            <option value="" disabled>
              O que o cliente levou no lugar…
            </option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id} disabled={p.estoque_atual === 0}>
                {p.modelo} · {p.cor} ({p.estoque_atual} un)
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="quantidade_sai" className={rotulo}>
            Qtd.
          </label>
          <input
            id="quantidade_sai"
            name="quantidade_sai"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={1}
            required
            className={`numeros ${campo}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <label htmlFor="motivo_troca" className={rotulo}>
            Motivo (opcional)
          </label>
          <input
            id="motivo_troca"
            name="motivo"
            type="text"
            maxLength={120}
            placeholder="Ex.: cliente quis outra cor"
            className={campo}
          />
        </div>
        <Botao />
      </div>

      <p className="text-xs text-texto-suave">
        A peça que volta soma ao saldo e a que sai baixa, na mesma hora. Se foi
        <strong className="font-semibold"> defeito com reembolso</strong>, não use a troca:
        lance a entrada acima, só se a peça puder voltar à venda.
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
    </form>
  )
}

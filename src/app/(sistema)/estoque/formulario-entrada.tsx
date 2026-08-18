"use client"

import { useActionState, useRef } from "react"
import { useFormStatus } from "react-dom"

import type { Produto } from "@/lib/supabase/types"

import { darEntrada, type EstadoEntrada } from "./acoes"

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Salvando…" : "Lançar"}
    </button>
  )
}

export function FormularioEntrada({ produtos }: { produtos: Produto[] }) {
  const [estado, acao] = useActionState<EstadoEntrada, FormData>(darEntrada, {})
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (dados) => {
        await acao(dados)
        formRef.current?.reset()
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-56 flex-1 space-y-1.5">
        <label
          htmlFor="produto_id"
          className="block text-[11px] font-medium uppercase tracking-wider text-texto-suave"
        >
          Produto
        </label>
        <select
          id="produto_id"
          name="produto_id"
          required
          defaultValue=""
          className="h-11 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
        >
          <option value="" disabled>
            Escolha o boné…
          </option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.modelo} · {p.cor} ({p.estoque_atual} un)
            </option>
          ))}
        </select>
      </div>

      <div className="w-28 space-y-1.5">
        <label
          htmlFor="quantidade"
          className="block text-[11px] font-medium uppercase tracking-wider text-texto-suave"
        >
          Quantidade
        </label>
        <input
          id="quantidade"
          name="quantidade"
          type="number"
          inputMode="numeric"
          step="1"
          required
          placeholder="+10"
          className="numeros h-11 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
        />
      </div>

      <div className="min-w-40 flex-1 space-y-1.5">
        <label
          htmlFor="motivo"
          className="block text-[11px] font-medium uppercase tracking-wider text-texto-suave"
        >
          Motivo (opcional)
        </label>
        <input
          id="motivo"
          name="motivo"
          type="text"
          maxLength={120}
          placeholder="Ex.: chegada do fornecedor"
          className="h-11 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
        />
      </div>

      <Botao />

      <p className="w-full text-xs text-texto-suave">
        Use número negativo para corrigir para baixo (perda, avaria). Todo lançamento
        fica no histórico abaixo — o saldo nunca é digitado direto.
      </p>

      {estado.erro ? (
        <p
          role="alert"
          className="w-full rounded-lg border border-erro/30 bg-erro-fundo px-3 py-2 text-sm text-erro"
        >
          {estado.erro}
        </p>
      ) : null}

      {estado.ok ? (
        <p
          role="status"
          className="w-full rounded-lg border border-ok/30 bg-ok-fundo px-3 py-2 text-sm text-ok"
        >
          {estado.ok}
        </p>
      ) : null}
    </form>
  )
}

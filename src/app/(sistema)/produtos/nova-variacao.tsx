"use client"

import { useActionState, useRef, useState } from "react"
import { useFormStatus } from "react-dom"

import { IconeMais } from "@/lib/icones"

import { adicionarVariacoes, type EstadoProduto } from "./acoes"

const campo =
  "h-10 w-full rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 shrink-0 rounded-lg bg-marca px-4 text-xs font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Salvando…" : "Adicionar"}
    </button>
  )
}

/** Chegou cor ou tamanho novo de um produto que já existe. Os preços vêm das
 *  variações que ele já tem. Não precisa de chave de envio: repetir a mesma
 *  variação não duplica — o banco ignora pela regra de variação única. */
export function NovaVariacao({ modeloId, nome }: { modeloId: string; nome: string }) {
  const [aberto, setAberto] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [estado, acao] = useActionState<EstadoProduto, FormData>(
    async (anterior, dados) => {
      const resposta = await adicionarVariacoes(anterior, dados)
      if (resposta.ok) formRef.current?.reset()
      return resposta
    },
    {},
  )

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-borda-suave px-3 text-xs font-semibold text-texto-suave transition-colors hover:border-acento/40 hover:text-acento"
      >
        <IconeMais />
        Cor ou tamanho
      </button>
    )
  }

  return (
    <form ref={formRef} action={acao} className="w-full space-y-2">
      <input type="hidden" name="modelo_id" value={modeloId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-32 flex-1">
          <label htmlFor={`cor-${modeloId}`} className="sr-only">
            Cor de {nome}
          </label>
          <input
            id={`cor-${modeloId}`}
            name="cor"
            required
            maxLength={40}
            placeholder="Cor (nova ou já existente)"
            className={campo}
          />
        </div>
        <div className="min-w-32 flex-1">
          <label htmlFor={`tam-${modeloId}`} className="sr-only">
            Tamanhos de {nome}
          </label>
          <input
            id={`tam-${modeloId}`}
            name="tamanhos"
            maxLength={200}
            placeholder="P, M, G · vazio = único"
            className={campo}
          />
        </div>
        <Botao />
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="h-10 px-2 text-xs text-texto-suave underline-offset-2 hover:underline"
        >
          Fechar
        </button>
      </div>

      {estado.erro ? (
        <p role="alert" className="text-xs text-erro">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-xs text-ok">
          {estado.ok}
        </p>
      ) : null}
    </form>
  )
}

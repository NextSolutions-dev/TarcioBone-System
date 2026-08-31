"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { useFormStatus } from "react-dom"

import { IconeAlerta, IconeMais } from "@/lib/icones"
import { criarClienteNavegador } from "@/lib/supabase/client"
import { formatarTelefone, telefoneParaArmazenar } from "@/lib/utils"

import { cadastrarCliente, type EstadoCliente } from "./acoes"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo = "block text-xs font-medium uppercase tracking-wider text-texto-suave"

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Salvando…" : "Cadastrar cliente"}
    </button>
  )
}

type Repetido = { id: string; nome: string; cidade: string | null }

export function FormularioCliente() {
  const [aberto, setAberto] = useState(false)
  const [estado, acao] = useActionState<EstadoCliente, FormData>(cadastrarCliente, {})
  const formRef = useRef<HTMLFormElement>(null)
  const supabase = useMemo(() => criarClienteNavegador(), [])

  const [telefone, setTelefone] = useState("")
  const [repetidos, setRepetidos] = useState<Repetido[]>([])

  const normalizado = telefoneParaArmazenar(telefone)

  /** Telefone não é único no banco de propósito — em família dois clientes
   *  dividem o número. A defesa contra duplicata é este aviso: quem cadastra vê
   *  que já existe alguém com o mesmo número e decide. */
  useEffect(() => {
    if (!normalizado) {
      setRepetidos([])
      return
    }

    let cancelado = false
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, cidade")
        .eq("telefone", normalizado)
        .eq("ativo", true)
        .limit(3)

      if (!cancelado) setRepetidos((data ?? []) as Repetido[])
    }, 400)

    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [normalizado, supabase])

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset()
      setTelefone("")
      setRepetidos([])
    }
  }, [estado.ok])

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-11 items-center gap-1.5 rounded-lg bg-marca px-4 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo"
      >
        <IconeMais />
        Novo cliente
      </button>
    )
  }

  return (
    <form ref={formRef} action={acao} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="nome" className={rotulo}>
          Nome
        </label>
        <input id="nome" name="nome" required maxLength={80} className={campo} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="telefone" className={rotulo}>
          WhatsApp
        </label>
        <input
          id="telefone"
          name="telefone"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className={`${campo} numeros`}
        />
        <p className="text-xs text-texto-suave">
          Sem telefone não dá para mandar mensagem depois.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cidade" className={rotulo}>
          Cidade
        </label>
        <input id="cidade" name="cidade" maxLength={60} className={campo} />
      </div>

      {repetidos.length > 0 ? (
        <div className="rounded-lg border border-alerta/30 bg-alerta-fundo px-3.5 py-2.5 sm:col-span-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-alerta">
            <IconeAlerta />
            Já existe cliente com {formatarTelefone(normalizado)}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-alerta/90">
            {repetidos.map((r) => (
              <li key={r.id}>
                {r.nome}
                {r.cidade ? ` · ${r.cidade}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-alerta/80">
            Pode cadastrar assim mesmo — é comum a família dividir o número.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="observacao" className={rotulo}>
          Observação (opcional)
        </label>
        <input
          id="observacao"
          name="observacao"
          maxLength={280}
          placeholder="Ex.: compra sempre no atacado, prefere entrega na feira"
          className={campo}
        />
      </div>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-lg border border-erro/30 bg-erro-fundo px-3.5 py-2.5 text-sm text-erro sm:col-span-2"
        >
          {estado.erro}
        </p>
      ) : null}

      {estado.ok ? (
        <p
          role="status"
          className="rounded-lg border border-ok/30 bg-ok-fundo px-3.5 py-2.5 text-sm text-ok sm:col-span-2"
        >
          {estado.ok}
        </p>
      ) : null}

      <div className="flex gap-2 sm:col-span-2">
        <Botao />
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="h-11 rounded-lg border border-borda-suave px-4 text-sm font-medium text-texto-suave transition-colors hover:text-texto"
        >
          Fechar
        </button>
      </div>
    </form>
  )
}

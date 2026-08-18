"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { entrar, type EstadoLogin } from "./acoes"

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-marca text-sm font-semibold tracking-wide text-white transition-colors hover:bg-marca-vivo focus:outline-none focus-visible:ring-2 focus-visible:ring-acento/50 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  )
}

export function FormularioLogin({ proxima }: { proxima?: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {})

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="proxima" value={proxima ?? ""} />

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-xs font-medium uppercase tracking-wider text-texto-suave"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue="dono@abareta.com.br"
          className="h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="senha"
          className="block text-xs font-medium uppercase tracking-wider text-texto-suave"
        >
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          defaultValue="abareta2026"
          className="h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
        />
      </div>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-lg border border-erro/30 bg-erro-fundo px-3.5 py-2.5 text-sm text-erro"
        >
          {estado.erro}
        </p>
      ) : null}

      <Botao />
    </form>
  )
}

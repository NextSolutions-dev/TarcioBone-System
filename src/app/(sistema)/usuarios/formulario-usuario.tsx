"use client"

import { useActionState, useRef, useState } from "react"
import { useFormStatus } from "react-dom"

import { IconeMais } from "@/lib/icones"

import { criarUsuario, type EstadoUsuario } from "./acoes"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo = "block text-[11px] font-medium uppercase tracking-wider text-texto-suave"

/** Sem 0/O e 1/l: a senha vai ser ditada ou escrita num papel. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

function senhaSugerida() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("")
}

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Criando…" : "Criar acesso"}
    </button>
  )
}

export function FormularioUsuario({
  donosAtivos,
  maxDonos,
  desabilitado,
}: {
  donosAtivos: number
  maxDonos: number
  desabilitado: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [senha, setSenha] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const lotouDonos = donosAtivos >= maxDonos

  const [estado, acao] = useActionState<EstadoUsuario, FormData>(
    async (anterior, dados) => {
      const resposta = await criarUsuario(anterior, dados)
      if (resposta.ok) {
        formRef.current?.reset()
        setSenha("")
        setMostrarSenha(false)
      }
      return resposta
    },
    {},
  )

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={desabilitado}
        className="flex h-11 items-center gap-1.5 rounded-lg bg-marca px-4 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconeMais />
        Novo acesso
      </button>
    )
  }

  return (
    <form
      ref={formRef}
      action={acao}
      className="w-full max-w-2xl space-y-4 rounded-xl border border-borda-suave bg-superficie p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-texto">Novo acesso</p>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-xs text-texto-suave underline-offset-2 hover:underline"
        >
          Fechar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="nome" className={rotulo}>
            Nome da pessoa
          </label>
          <input
            id="nome"
            name="nome"
            required
            maxLength={60}
            autoComplete="off"
            placeholder="Ex.: Maria Souza"
            className={campo}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="papel" className={rotulo}>
            Cargo
          </label>
          <select id="papel" name="papel" defaultValue="vendedor" className={campo}>
            <option value="vendedor">Vendedor</option>
            <option value="dono" disabled={lotouDonos}>
              Dono{lotouDonos ? ` (limite de ${maxDonos} atingido)` : ""}
            </option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className={rotulo}>
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="off"
            placeholder="maria@exemplo.com"
            className={campo}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="senha" className={rotulo}>
              Senha
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSenha(senhaSugerida())
                  setMostrarSenha(true)
                }}
                className="text-xs font-semibold text-acento underline-offset-2 hover:underline"
              >
                Sugerir
              </button>
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="text-xs text-texto-suave underline-offset-2 hover:underline"
              >
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <input
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
            className={`${campo} ${mostrarSenha ? "numeros" : ""}`}
          />
        </div>
      </div>

      <p className="text-xs text-texto-suave">
        A pessoa entra com esse e-mail e essa senha. Anote antes de salvar — depois
        daqui a senha não aparece mais em lugar nenhum, e trocá-la é outro botão, na
        linha dela.
      </p>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-lg border border-erro/30 bg-erro-fundo px-3.5 py-2.5 text-sm text-erro"
        >
          {estado.erro}
        </p>
      ) : null}

      {estado.ok ? (
        <p
          role="status"
          className="rounded-lg border border-ok/30 bg-ok-fundo px-3.5 py-2.5 text-sm text-ok"
        >
          {estado.ok}
        </p>
      ) : null}

      <Botao />
    </form>
  )
}

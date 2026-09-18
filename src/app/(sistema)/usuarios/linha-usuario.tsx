"use client"

import { useActionState, useState } from "react"

import { Selo } from "@/lib/componentes"

import {
  alternarAtivo,
  redefinirSenha,
  removerUsuario,
  type EstadoUsuario,
} from "./acoes"

const botaoDiscreto =
  "h-9 rounded-lg border border-borda-suave px-3 text-xs font-semibold text-texto transition-colors hover:border-acento/40 hover:text-acento disabled:cursor-wait disabled:opacity-60"

export function LinhaUsuario({
  id,
  nome,
  email,
  papel,
  ativo,
  desde,
  souEu,
  temMovimento,
  podeRemover,
}: {
  id: string
  nome: string
  email: string | null
  papel: string
  ativo: boolean
  desde: string
  souEu: boolean
  temMovimento: boolean
  podeRemover: boolean
}) {
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const [estadoAtivo, acaoAtivo, salvandoAtivo] = useActionState<EstadoUsuario, FormData>(
    alternarAtivo,
    {},
  )
  const [estadoSenha, acaoSenha, salvandoSenha] = useActionState<EstadoUsuario, FormData>(
    async (anterior, dados) => {
      const resposta = await redefinirSenha(anterior, dados)
      if (resposta.ok) setTrocandoSenha(false)
      return resposta
    },
    {},
  )
  const [estadoRemover, acaoRemover, removendo] = useActionState<EstadoUsuario, FormData>(
    async (anterior, dados) => {
      const resposta = await removerUsuario(anterior, dados)
      setConfirmando(false)
      return resposta
    },
    {},
  )

  const aviso = estadoAtivo.erro ?? estadoSenha.erro ?? estadoRemover.erro
  const sucesso = estadoAtivo.ok ?? estadoSenha.ok ?? estadoRemover.ok

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold text-texto">{nome}</p>
            <Selo tom={papel === "dono" ? "marca" : "neutro"}>
              {papel === "dono" ? "Dono" : "Vendedor"}
            </Selo>
            {ativo ? null : <Selo tom="alerta">Sem acesso</Selo>}
            {souEu ? <Selo tom="ok">Você</Selo> : null}
          </div>
          <p className="mt-0.5 text-xs text-texto-suave">
            {email ?? "e-mail indisponível"} · desde {desde}
          </p>
        </div>

        {/* Ninguém mexe no próprio acesso: é assim que o dono não se tranca
            do lado de fora do sistema. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTrocandoSenha((v) => !v)
              setConfirmando(false)
            }}
            disabled={!podeRemover}
            className={botaoDiscreto}
          >
            {trocandoSenha ? "Cancelar" : "Trocar senha"}
          </button>

          {souEu ? null : (
            <form action={acaoAtivo}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" disabled={salvandoAtivo} className={botaoDiscreto}>
                {salvandoAtivo ? "Salvando…" : ativo ? "Desativar" : "Reativar"}
              </button>
            </form>
          )}

          {souEu || !podeRemover ? null : confirmando ? (
            <form action={acaoRemover} className="flex items-center gap-2">
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                disabled={removendo}
                className="h-9 rounded-lg bg-erro px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {removendo ? "Removendo…" : "Confirmar remoção"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="text-xs text-texto-suave underline-offset-2 hover:underline"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmando(true)
                setTrocandoSenha(false)
              }}
              className="h-9 rounded-lg border border-erro/30 px-3 text-xs font-semibold text-erro transition-colors hover:bg-erro-fundo"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {confirmando ? (
        <p className="text-xs text-texto-suave">
          {temMovimento
            ? `${nome} já tem movimento no sistema. Remover vai ser recusado para não tirar o autor do histórico — o caminho é Desativar.`
            : `${nome} perde a conta de login e sai da lista. Não dá para desfazer.`}
        </p>
      ) : null}

      {trocandoSenha ? (
        <form action={acaoSenha} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <div className="space-y-1.5">
            <label
              htmlFor={`senha-${id}`}
              className="block text-[11px] font-medium uppercase tracking-wider text-texto-suave"
            >
              Nova senha de {nome}
            </label>
            <input
              id={`senha-${id}`}
              name="senha"
              type="text"
              required
              minLength={8}
              maxLength={72}
              autoComplete="off"
              placeholder="Mínimo de 8 caracteres"
              className="h-10 w-64 rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
            />
          </div>
          <button
            type="submit"
            disabled={salvandoSenha}
            className="h-10 rounded-lg bg-marca px-4 text-xs font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
          >
            {salvandoSenha ? "Trocando…" : "Trocar"}
          </button>
        </form>
      ) : null}

      {aviso ? (
        <p
          role="alert"
          className="rounded-lg border border-erro/30 bg-erro-fundo px-3.5 py-2.5 text-sm text-erro"
        >
          {aviso}
        </p>
      ) : null}

      {sucesso ? (
        <p
          role="status"
          className="rounded-lg border border-ok/30 bg-ok-fundo px-3.5 py-2.5 text-sm text-ok"
        >
          {sucesso}
        </p>
      ) : null}
    </div>
  )
}

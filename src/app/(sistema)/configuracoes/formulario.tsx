"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

import { Selo } from "@/lib/componentes"
import { IconeWhatsApp } from "@/lib/icones"
import type { LojaConfig } from "@/lib/supabase/types"
import { formatarTelefone, telefoneParaArmazenar } from "@/lib/utils"

import { salvarConfig, type EstadoConfig } from "./acoes"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo = "block text-xs font-medium uppercase tracking-wider text-texto-suave"

function Botao({ desabilitado }: { desabilitado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || desabilitado}
      className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  )
}

export function FormularioConfig({ config }: { config: LojaConfig }) {
  const [estado, acao] = useActionState<EstadoConfig, FormData>(salvarConfig, {})

  const [nome, setNome] = useState(config.nome_loja)
  const [numero, setNumero] = useState(
    config.whatsapp ? formatarTelefone(config.whatsapp) : "",
  )
  const [testou, setTestou] = useState(false)
  const [confirmou, setConfirmou] = useState(config.whatsapp_ativo)

  const normalizado = telefoneParaArmazenar(numero)
  const numeroValido = Boolean(normalizado)
  const mudouONumero = normalizado !== (config.whatsapp ?? null)

  // Trocou o número? O teste anterior não vale mais para o número novo.
  const precisaTestar = numeroValido && mudouONumero && !testou

  const linkTeste = normalizado
    ? `https://wa.me/${normalizado}?text=${encodeURIComponent(
        `Teste do sistema ${nome || "da loja"}. Se você recebeu esta mensagem, o número está certo.`,
      )}`
    : null

  return (
    <form action={acao} className="max-w-2xl space-y-6">
      <div className="space-y-1.5">
        <label htmlFor="nome_loja" className={rotulo}>
          Nome da loja
        </label>
        <input
          id="nome_loja"
          name="nome_loja"
          required
          maxLength={60}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={campo}
        />
        <p className="text-xs text-texto-suave">Aparece no topo do catálogo e nas mensagens.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-borda-suave bg-superficie p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-texto">WhatsApp que recebe os pedidos</p>
          {config.whatsapp_ativo ? (
            <Selo tom="ok">No ar no catálogo</Selo>
          ) : config.whatsapp ? (
            <Selo tom="alerta">Guardado, fora do catálogo</Selo>
          ) : (
            <Selo tom="neutro">Não configurado</Selo>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="whatsapp" className={rotulo}>
            Número
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            value={numero}
            onChange={(e) => {
              setNumero(e.target.value)
              setTestou(false)
              setConfirmou(false)
            }}
            className={`${campo} numeros`}
          />
          <p className="text-xs text-texto-suave">
            Com DDD. Deixe em branco para o catálogo não mostrar WhatsApp nenhum.
          </p>
        </div>

        {/* Passo 1 — mandar o teste */}
        <div className="flex flex-wrap items-center gap-3 border-t border-borda-suave pt-3">
          <a
            href={linkTeste ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!linkTeste}
            onClick={(e) => {
              if (!linkTeste) {
                e.preventDefault()
                return
              }
              setTestou(true)
            }}
            className={`flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
              linkTeste
                ? "bg-[#25D366] text-white hover:opacity-90"
                : "pointer-events-none bg-borda text-texto-suave"
            }`}
          >
            <IconeWhatsApp className="h-4 w-4" />
            Enviar mensagem de teste
          </a>

          <p className="text-xs text-texto-suave">
            Abre o WhatsApp com uma mensagem pronta. Envie e confira se chegou.
          </p>
        </div>

        {/* Passo 2 — confirmar que chegou */}
        <label className="flex items-start gap-2.5 border-t border-borda-suave pt-3">
          <input
            type="checkbox"
            name="confirmou_teste"
            checked={confirmou}
            onChange={(e) => setConfirmou(e.target.checked)}
            disabled={!numeroValido}
            className="mt-0.5 h-4 w-4 rounded border-borda accent-[var(--ar-marca)] disabled:opacity-40"
          />
          <span className="text-sm text-texto">
            A mensagem de teste chegou neste número.
            <span className="mt-0.5 block text-xs text-texto-suave">
              Enquanto isso não for marcado, o número fica guardado mas o catálogo
              não mostra WhatsApp — cliente nenhum cai em número errado.
            </span>
          </span>
        </label>

        {precisaTestar ? (
          <p className="rounded-lg border border-alerta/30 bg-alerta-fundo px-3 py-2 text-xs text-alerta">
            Você mudou o número. Envie um teste novo antes de liberar.
          </p>
        ) : null}
      </div>

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

      <Botao desabilitado={Boolean(numero) && !numeroValido} />
    </form>
  )
}

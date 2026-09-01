"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

import { Selo } from "@/lib/componentes"
import { IconeMais } from "@/lib/icones"
import type { Bloco, LojaConfig } from "@/lib/supabase/types"

import {
  alternarBloco,
  removerBloco,
  salvarBloco,
  salvarTextos,
  type EstadoCatalogo,
} from "./acoes-catalogo"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const area =
  "min-h-20 w-full rounded-lg border border-borda-suave bg-campo px-3.5 py-2.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo = "block text-xs font-medium uppercase tracking-wider text-texto-suave"

function Salvar({ children = "Salvar" }: { children?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Salvando…" : children}
    </button>
  )
}

function Aviso({ estado }: { estado: EstadoCatalogo }) {
  if (estado.erro) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-erro/30 bg-erro-fundo px-3.5 py-2.5 text-sm text-erro"
      >
        {estado.erro}
      </p>
    )
  }
  if (estado.ok) {
    return (
      <p
        role="status"
        className="rounded-lg border border-ok/30 bg-ok-fundo px-3.5 py-2.5 text-sm text-ok"
      >
        {estado.ok}
      </p>
    )
  }
  return null
}

/** Textos do topo do catálogo + pedido mínimo do atacado. */
export function EditorTextos({ config }: { config: LojaConfig }) {
  const [estado, acao] = useActionState<EstadoCatalogo, FormData>(salvarTextos, {})
  const [titulo, setTitulo] = useState(config.hero_titulo ?? "")
  const [destaque, setDestaque] = useState(config.hero_destaque ?? "")

  const destaqueForaDoTitulo = Boolean(destaque) && !titulo.includes(destaque)

  return (
    <form action={acao} className="max-w-2xl space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="hero_eyebrow" className={rotulo}>
          Linha de cima
        </label>
        <input
          id="hero_eyebrow"
          name="hero_eyebrow"
          maxLength={80}
          defaultValue={config.hero_eyebrow ?? ""}
          placeholder="Atacado e varejo"
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="hero_titulo" className={rotulo}>
          Título grande
        </label>
        <input
          id="hero_titulo"
          name="hero_titulo"
          required
          maxLength={120}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="hero_destaque" className={rotulo}>
          Trecho colorido
        </label>
        <input
          id="hero_destaque"
          name="hero_destaque"
          maxLength={60}
          value={destaque}
          onChange={(e) => setDestaque(e.target.value)}
          placeholder="opcional"
          className={campo}
        />
        <p className="text-xs text-texto-suave">
          Precisa aparecer <strong>exatamente</strong> dentro do título — é o pedaço que
          ganha cor.
        </p>
        {destaqueForaDoTitulo ? (
          <p className="text-xs text-erro">
            Esse trecho não existe no título como está escrito.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="hero_texto" className={rotulo}>
          Parágrafo abaixo do título
        </label>
        <textarea
          id="hero_texto"
          name="hero_texto"
          maxLength={400}
          defaultValue={config.hero_texto ?? ""}
          className={area}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="pedido_minimo_pecas" className={rotulo}>
            Pedido mínimo (peças)
          </label>
          <input
            id="pedido_minimo_pecas"
            name="pedido_minimo_pecas"
            type="number"
            min={0}
            max={9999}
            defaultValue={config.pedido_minimo_pecas}
            className={`${campo} numeros`}
          />
          <p className="text-xs text-texto-suave">
            0 desliga a regra. Acima disso, o catálogo só libera fechar o pedido ao
            atingir a quantidade.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="rodape_texto" className={rotulo}>
            Rodapé
          </label>
          <input
            id="rodape_texto"
            name="rodape_texto"
            maxLength={200}
            defaultValue={config.rodape_texto ?? ""}
            className={campo}
          />
        </div>
      </div>

      <Aviso estado={estado} />
      <Salvar>Salvar textos</Salvar>
    </form>
  )
}

/** Lista editável dos blocos de uma seção. */
export function EditorBlocos({
  tipo,
  blocos,
  titulo,
  descricao,
}: {
  tipo: "diferencial" | "passo"
  blocos: Bloco[]
  titulo: string
  descricao: string
}) {
  const [novo, setNovo] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-texto">{titulo}</p>
          <p className="text-xs text-texto-suave">{descricao}</p>
        </div>
        {!novo ? (
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-borda-suave px-3 text-sm font-medium text-texto transition-colors hover:border-marca hover:bg-marca hover:text-white"
          >
            <IconeMais />
            Adicionar
          </button>
        ) : null}
      </div>

      {novo ? (
        <FormBloco
          tipo={tipo}
          ordem={blocos.length + 1}
          aoFechar={() => setNovo(false)}
        />
      ) : null}

      {blocos.length === 0 && !novo ? (
        <p className="rounded-lg border border-dashed border-borda px-4 py-6 text-center text-sm text-texto-suave">
          Nenhum bloco. Sem eles, esta seção não aparece no catálogo.
        </p>
      ) : null}

      <ul className="space-y-2">
        {blocos.map((b) => (
          <li key={b.id}>
            <FormBloco tipo={tipo} bloco={b} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FormBloco({
  tipo,
  bloco,
  ordem,
  aoFechar,
}: {
  tipo: "diferencial" | "passo"
  bloco?: Bloco
  ordem?: number
  aoFechar?: () => void
}) {
  const [estado, acao] = useActionState<EstadoCatalogo, FormData>(salvarBloco, {})

  return (
    <div className="rounded-xl border border-borda-suave bg-superficie p-3">
      <form action={acao} className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
        <input type="hidden" name="id" value={bloco?.id ?? ""} />
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="ordem" value={bloco?.ordem ?? ordem ?? 0} />

        <input
          name="rotulo"
          maxLength={40}
          defaultValue={bloco?.rotulo ?? ""}
          placeholder={tipo === "passo" ? "01" : "RÓTULO"}
          aria-label="Rótulo"
          className={`${campo} text-xs uppercase`}
        />

        <div className="space-y-2">
          <input
            name="titulo"
            required
            maxLength={80}
            defaultValue={bloco?.titulo ?? ""}
            placeholder="Título"
            aria-label="Título do bloco"
            className={campo}
          />
          <textarea
            name="texto"
            required
            maxLength={300}
            defaultValue={bloco?.texto ?? ""}
            placeholder="Texto"
            aria-label="Texto do bloco"
            className={area}
          />
        </div>

        <div className="flex flex-row gap-2 sm:flex-col">
          <Salvar>{bloco ? "Atualizar" : "Adicionar"}</Salvar>
          {aoFechar ? (
            <button
              type="button"
              onClick={aoFechar}
              className="h-11 rounded-lg border border-borda-suave px-3 text-sm text-texto-suave hover:text-texto"
            >
              Fechar
            </button>
          ) : null}
        </div>

        {estado.erro || estado.ok ? (
          <div className="sm:col-span-3">
            <Aviso estado={estado} />
          </div>
        ) : null}
      </form>

      {bloco ? (
        <div className="mt-2 flex items-center gap-2 border-t border-borda-suave pt-2">
          <form action={alternarBloco}>
            <input type="hidden" name="id" value={bloco.id} />
            <input type="hidden" name="atual" value={String(bloco.ativo)} />
            <button type="submit" className="cursor-pointer">
              <Selo tom={bloco.ativo ? "ok" : "neutro"}>
                {bloco.ativo ? "Aparecendo" : "Escondido"}
              </Selo>
            </button>
          </form>

          <form action={removerBloco} className="ml-auto">
            <input type="hidden" name="id" value={bloco.id} />
            <button
              type="submit"
              className="text-xs font-medium text-texto-suave transition-colors hover:text-erro"
            >
              Excluir
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}

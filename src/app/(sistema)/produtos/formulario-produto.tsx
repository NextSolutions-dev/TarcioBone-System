"use client"

import { useActionState, useRef, useState } from "react"
import { useFormStatus } from "react-dom"

import { IconeMais } from "@/lib/icones"
import type { Categoria } from "@/lib/supabase/types"

import { criarProduto, type EstadoProduto } from "./acoes"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo =
  "block text-[11px] font-medium uppercase tracking-wider text-texto-suave"

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Salvando…" : "Cadastrar produto"}
    </button>
  )
}

export function FormularioProduto({ categorias }: { categorias: Categoria[] }) {
  const [aberto, setAberto] = useState(false)
  const [estado, acao] = useActionState<EstadoProduto, FormData>(criarProduto, {})
  const formRef = useRef<HTMLFormElement>(null)

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-11 items-center gap-1.5 rounded-lg bg-marca px-4 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo"
      >
        <IconeMais />
        Novo produto
      </button>
    )
  }

  return (
    <form
      ref={formRef}
      action={async (dados) => {
        await acao(dados)
        formRef.current?.reset()
      }}
      className="grid max-w-2xl gap-3 sm:grid-cols-2"
    >
      <div className="space-y-1.5">
        <label htmlFor="modelo" className={rotulo}>Modelo</label>
        <input id="modelo" name="modelo" required placeholder="Snapback Clássico" className={campo} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cor" className={rotulo}>Cor</label>
        <input id="cor" name="cor" required placeholder="Preto" className={campo} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sku" className={rotulo}>Código (SKU)</label>
        <input id="sku" name="sku" required placeholder="ABR-006" className={campo} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="preco" className={rotulo}>Preço de varejo</label>
        <input
          id="preco"
          name="preco"
          required
          inputMode="decimal"
          placeholder="89,90"
          className={`${campo} numeros`}
        />
        <p className="text-xs text-texto-suave">Usado na venda pelo sistema.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="preco_atacado" className={rotulo}>Preço de atacado</label>
        <input
          id="preco_atacado"
          name="preco_atacado"
          inputMode="decimal"
          placeholder="opcional"
          className={`${campo} numeros`}
        />
        <p className="text-xs text-texto-suave">
          Sem este preço o produto <strong>não aparece no catálogo</strong>.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="categoria_id" className={rotulo}>Categoria</label>
        <select id="categoria_id" name="categoria_id" defaultValue="" className={campo}>
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="estoque_minimo" className={rotulo}>Estoque mínimo</label>
        <input
          id="estoque_minimo"
          name="estoque_minimo"
          type="number"
          min={0}
          step={1}
          defaultValue={3}
          className={`${campo} numeros`}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="descricao" className={rotulo}>Descrição (aparece no site)</label>
        <input
          id="descricao"
          name="descricao"
          maxLength={280}
          placeholder="Aba reta, seis gomos, fecho ajustável."
          className={campo}
        />
      </div>

      <label className="flex items-center gap-2.5 sm:col-span-2">
        <input
          type="checkbox"
          name="no_catalogo"
          defaultChecked
          className="h-4 w-4 rounded border-borda accent-[var(--ar-marca)]"
        />
        <span className="text-sm text-texto">Mostrar no catálogo do site</span>
      </label>

      {estado.erro ? (
        <p role="alert" className="rounded-lg border border-erro/30 bg-erro-fundo px-3 py-2 text-sm text-erro sm:col-span-2">
          {estado.erro}
        </p>
      ) : null}

      {estado.ok ? (
        <p role="status" className="rounded-lg border border-ok/30 bg-ok-fundo px-3 py-2 text-sm text-ok sm:col-span-2">
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

"use client"

import { useActionState, useRef, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"

import { IconeMais, IconeMenos } from "@/lib/icones"
import type { Categoria } from "@/lib/supabase/types"

import { criarCategoria, criarModelo, type EstadoProduto } from "./acoes"

const campo =
  "h-11 w-full rounded-lg border border-borda-suave bg-campo px-3.5 text-sm outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
const rotulo = "block text-[11px] font-medium uppercase tracking-wider text-texto-suave"

type LinhaCor = { id: number; cor: string; tamanhos: string }

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

/** Cadastro de produto com todas as cores e tamanhos de uma vez — o mesmo jeito
 *  que o Tarcio pensa quando chega mercadoria: "a Polo veio em preto (P, M, G)
 *  e branco (M, G)". Cada linha é uma cor; cada tamanho vira uma variação com
 *  seu próprio estoque. */
export function FormularioProduto({ categorias }: { categorias: Categoria[] }) {
  const [aberto, setAberto] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const proximoId = useRef(2)
  const [categoriasLocais, setCategoriasLocais] = useState(categorias)
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("")
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState("")
  const [erroCategoria, setErroCategoria] = useState("")
  const [salvandoCategoria, iniciarCategoria] = useTransition()
  const travaCategoria = useRef(false)

  const [linhas, setLinhas] = useState<LinhaCor[]>([{ id: 1, cor: "", tamanhos: "" }])

  /** A chave de envio nasce ao abrir o formulário (clique, nunca render) e só
   *  troca depois de um cadastro aceito: duplo clique devolve o mesmo produto. */
  const [chave, setChave] = useState("")

  const [estado, acao] = useActionState<EstadoProduto, FormData>(
    async (anterior, dados) => {
      const resposta = await criarModelo(anterior, dados)
      if (resposta.ok) {
        formRef.current?.reset()
        setCategoriaSelecionada("")
        setLinhas([{ id: proximoId.current++, cor: "", tamanhos: "" }])
        setChave(crypto.randomUUID())
      }
      return resposta
    },
    {},
  )

  const totalVariacoes = linhas.reduce((soma, l) => {
    if (!l.cor.trim()) return soma
    const n = l.tamanhos.split(/[,;/]/).filter((t) => t.trim()).length
    return soma + Math.max(1, n)
  }, 0)

  function atualizar(id: number, campoLinha: "cor" | "tamanhos", valor: string) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, [campoLinha]: valor } : l)))
  }

  function salvarCategoria() {
    if (travaCategoria.current) return
    travaCategoria.current = true
    setErroCategoria("")
    iniciarCategoria(async () => {
      try {
        const resposta = await criarCategoria(nomeNovaCategoria)
        if (resposta.erro) {
          setErroCategoria(resposta.erro)
          return
        }
        if (resposta.categoria) {
          const nova = resposta.categoria
          setCategoriasLocais((atual) =>
            atual.some((categoria) => categoria.id === nova.id) ? atual : [...atual, nova],
          )
          setCategoriaSelecionada(nova.id)
          setNomeNovaCategoria("")
          setCriandoCategoria(false)
        }
      } catch {
        setErroCategoria("Não foi possível cadastrar a categoria. Tente novamente.")
      } finally {
        travaCategoria.current = false
      }
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setChave(crypto.randomUUID())
          setAberto(true)
        }}
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
      action={acao}
      className="w-full space-y-4 rounded-xl border border-borda-suave bg-superficie p-4 shadow-sm"
    >
      <input type="hidden" name="idempotency_key" value={chave} />
      <input
        type="hidden"
        name="variacoes"
        value={JSON.stringify(linhas.map(({ cor, tamanhos }) => ({ cor, tamanhos })))}
      />

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-texto">Novo produto</p>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-xs text-texto-suave underline-offset-2 hover:underline"
        >
          Fechar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="nome" className={rotulo}>
            Nome do produto
          </label>
          <input
            id="nome"
            name="nome"
            required
            maxLength={80}
            placeholder="Ex.: Boné Trucker Premium"
            className={campo}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="categoria_id" className={rotulo}>
              Categoria
            </label>
            <button
              type="button"
              onClick={() => {
                setCriandoCategoria((atual) => !atual)
                setErroCategoria("")
              }}
              className="text-xs font-semibold text-acento underline-offset-2 hover:underline"
            >
              {criandoCategoria ? "Cancelar" : "+ Nova categoria"}
            </button>
          </div>
          <select
            id="categoria_id"
            name="categoria_id"
            value={categoriaSelecionada}
            onChange={(evento) => setCategoriaSelecionada(evento.target.value)}
            className={campo}
          >
            <option value="">Sem categoria</option>
            {categoriasLocais.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
          {criandoCategoria ? (
            <div className="space-y-2 rounded-lg border border-borda-suave bg-fundo/60 p-2.5">
              <label htmlFor="nova_categoria" className={rotulo}>Nome da nova categoria</label>
              <div className="flex gap-2">
                <input
                  id="nova_categoria"
                  value={nomeNovaCategoria}
                  onChange={(evento) => setNomeNovaCategoria(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter") {
                      evento.preventDefault()
                      salvarCategoria()
                    }
                  }}
                  maxLength={60}
                  placeholder="Ex.: Bonés aba reta"
                  className={campo}
                />
                <button
                  type="button"
                  onClick={salvarCategoria}
                  disabled={salvandoCategoria}
                  className="shrink-0 rounded-lg bg-marca px-3 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {salvandoCategoria ? "Salvando…" : "Adicionar"}
                </button>
              </div>
              {erroCategoria ? <p role="alert" className="text-xs text-erro">{erroCategoria}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="estoque_minimo" className={rotulo}>
            Avisar reposição com
          </label>
          <input
            id="estoque_minimo"
            name="estoque_minimo"
            type="number"
            min={0}
            defaultValue={3}
            className={`${campo} numeros`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="preco" className={rotulo}>
            Preço de varejo
          </label>
          <input
            id="preco"
            name="preco"
            required
            inputMode="decimal"
            placeholder="89,90"
            className={`${campo} numeros`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="preco_atacado" className={rotulo}>
            Preço de atacado
          </label>
          <input
            id="preco_atacado"
            name="preco_atacado"
            inputMode="decimal"
            placeholder="69,90 (sem ele, fica fora do site)"
            className={`${campo} numeros`}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="descricao" className={rotulo}>
            Descrição (opcional)
          </label>
          <textarea
            id="descricao"
            name="descricao"
            maxLength={400}
            rows={2}
            placeholder="Material, acabamento, o que o cliente precisa saber"
            className="min-h-16 w-full rounded-lg border border-borda-suave bg-campo px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
          />
        </div>
      </div>

      {/* Cores e tamanhos */}
      <fieldset className="space-y-2 rounded-lg border border-borda-suave bg-fundo/60 p-3">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wider text-texto-suave">
          Cores e tamanhos
        </legend>

        <p className="text-xs text-texto-suave">
          Uma linha por cor. Separe os tamanhos por vírgula — <em>P, M, G</em>. Deixe em
          branco se for tamanho único. As fotos de cada cor são enviadas depois, na lista.
        </p>

        <ul className="space-y-2">
          {linhas.map((l, i) => (
            <li key={l.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <div className="space-y-1">
                <label htmlFor={`cor-${l.id}`} className={rotulo}>
                  Cor {i + 1}
                </label>
                <input
                  id={`cor-${l.id}`}
                  value={l.cor}
                  onChange={(e) => atualizar(l.id, "cor", e.target.value)}
                  required
                  maxLength={40}
                  placeholder="Preto"
                  className={campo}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`tam-${l.id}`} className={rotulo}>
                  Tamanhos
                </label>
                <input
                  id={`tam-${l.id}`}
                  value={l.tamanhos}
                  onChange={(e) => atualizar(l.id, "tamanhos", e.target.value)}
                  maxLength={200}
                  placeholder="P, M, G  ·  vazio = único"
                  className={campo}
                />
              </div>
              <button
                type="button"
                onClick={() => setLinhas((atual) => atual.filter((x) => x.id !== l.id))}
                disabled={linhas.length === 1}
                aria-label={`Remover a cor ${i + 1}`}
                className="grid h-11 w-11 place-items-center rounded-lg border border-borda-suave text-texto-suave transition-colors hover:border-erro/40 hover:text-erro disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconeMenos />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              setLinhas((atual) => [...atual, { id: proximoId.current++, cor: "", tamanhos: "" }])
            }
            className="flex h-10 items-center gap-1.5 rounded-lg border border-borda-suave bg-superficie px-3 text-xs font-semibold text-texto transition-colors hover:border-acento/40"
          >
            <IconeMais />
            Outra cor
          </button>
          <p className="numeros text-xs text-texto-suave">
            {totalVariacoes} {totalVariacoes === 1 ? "variação" : "variações"} a criar
          </p>
        </div>
      </fieldset>

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

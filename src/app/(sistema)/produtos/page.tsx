import { redirect } from "next/navigation"

import { Cartao, Selo, Vazio } from "@/lib/componentes"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import type { Categoria, Modelo, ModeloFoto, Produto } from "@/lib/supabase/types"
import { dinheiro } from "@/lib/utils"
import { agruparPorModelo, chaveCor } from "@/lib/variacoes"

import { alternarCatalogo } from "./acoes"
import { FormularioProduto } from "./formulario-produto"
import { FotosDaCor } from "./fotos-cor"
import { NovaVariacao } from "./nova-variacao"

export const metadata = { title: "Produtos" }

export default async function PaginaProdutos() {
  const perfil = await perfilAtual()
  // Tela de dono. A RLS já impede a escrita; isto evita a tela em branco.
  if (perfil?.papel !== "dono") redirect("/painel")

  const supabase = await criarClienteServidor()

  const [variacoesRes, modelosRes, fotosRes, categoriasRes] = await Promise.all([
    supabase.from("produtos").select("*").eq("ativo", true),
    supabase.from("modelos").select("*, categorias ( nome )"),
    supabase.from("modelo_fotos").select("*").order("ordem"),
    supabase.from("categorias").select("*").order("ordem"),
  ])

  const variacoes = (variacoesRes.data ?? []) as Produto[]
  const fotos = (fotosRes.data ?? []) as ModeloFoto[]
  const categorias = (categoriasRes.data ?? []) as Categoria[]
  const modelosInfo = new Map(
    ((modelosRes.data ?? []) as (Modelo & { categorias: { nome: string } | null })[]).map(
      (m) => [m.id, m],
    ),
  )

  const grupos = agruparPorModelo(variacoes, fotos)

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Produtos</h1>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-texto">Produtos</p>
          <p className="text-sm text-texto-suave">
            Cada produto tem suas cores, e cada cor seus tamanhos e fotos. O estoque é
            por tamanho.
          </p>
        </div>
      </div>

      <FormularioProduto categorias={categorias} />

      {grupos.length === 0 ? (
        <Vazio
          titulo="Nenhum produto cadastrado"
          descricao="Cadastre o primeiro produto com as cores e os tamanhos para poder vender e para o site ter o que mostrar."
        />
      ) : (
        <ul className="space-y-4">
          {grupos.map((g) => {
            const info = modelosInfo.get(g.modeloId)
            const noSite = info?.no_catalogo ?? true
            const semAtacado = g.variacoes.every((v) => v.preco_atacado_centavos === null)
            const pecas = g.variacoes.reduce((s, v) => s + v.estoque_atual, 0)

            // Preço mostrado como faixa quando as variações divergem (ex.: GG
            // mais caro). Na maioria dos produtos é um valor só.
            const varejos = g.variacoes.map((v) => v.preco_centavos)
            const atacados = g.variacoes
              .map((v) => v.preco_atacado_centavos)
              .filter((x): x is number => x !== null)
            const faixa = (lista: number[]) =>
              lista.length === 0
                ? "—"
                : Math.min(...lista) === Math.max(...lista)
                  ? dinheiro(lista[0])
                  : `${dinheiro(Math.min(...lista))} – ${dinheiro(Math.max(...lista))}`

            return (
              <li key={g.modeloId}>
                <Cartao className="p-4">
                  {/* cabeçalho do produto */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-texto">{g.nome}</p>
                      <p className="text-xs text-texto-suave">
                        {info?.categorias?.nome ?? "Sem categoria"} ·{" "}
                        <span className="numeros">
                          {g.cores.length} {g.cores.length === 1 ? "cor" : "cores"} ·{" "}
                          {g.variacoes.length}{" "}
                          {g.variacoes.length === 1 ? "variação" : "variações"} · {pecas}{" "}
                          {pecas === 1 ? "peça" : "peças"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-texto-suave">
                          Varejo
                        </p>
                        <p className="numeros text-sm font-semibold text-texto">
                          {faixa(varejos)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-texto-suave">
                          Atacado
                        </p>
                        <p className="numeros text-sm font-semibold text-texto">
                          {faixa(atacados)}
                        </p>
                      </div>

                      {semAtacado ? (
                        <Selo tom="alerta">Falta preço de atacado</Selo>
                      ) : (
                        <form action={alternarCatalogo}>
                          <input type="hidden" name="modelo_id" value={g.modeloId} />
                          <input type="hidden" name="atual" value={String(noSite)} />
                          <button type="submit" className="cursor-pointer">
                            <Selo tom={noSite ? "ok" : "neutro"}>
                              {noSite ? "No site" : "Fora do site"}
                            </Selo>
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* uma faixa por cor: fotos da cor + tamanhos com saldo */}
                  <ul className="mt-4 divide-y divide-borda-suave/70 border-t border-borda-suave/70">
                    {g.cores.map((c) => (
                      <li
                        key={c.chave}
                        className="grid gap-3 py-3 sm:grid-cols-[9rem_1fr] sm:items-start"
                      >
                        <div>
                          <p className="text-sm font-semibold text-texto">{c.cor}</p>
                          <p className="numeros text-xs text-texto-suave">
                            {c.variacoes.reduce((s, v) => s + v.estoque_atual, 0)} peças
                          </p>
                        </div>

                        <div className="space-y-3">
                          <FotosDaCor
                            modeloId={g.modeloId}
                            cor={c.cor}
                            fotos={fotos
                              .filter(
                                (f) =>
                                  f.modelo_id === g.modeloId && chaveCor(f.cor) === c.chave,
                              )
                              .map((f) => ({
                                id: f.id,
                                url: f.url,
                                caminho: f.caminho,
                                ordem: f.ordem,
                              }))}
                          />

                          <ul className="flex flex-wrap gap-1.5">
                            {c.variacoes.map((v) => (
                              <li
                                key={v.id}
                                title={`Código ${v.sku}`}
                                className={
                                  v.estoque_atual === 0
                                    ? "rounded-lg border border-erro/25 bg-erro-fundo px-2.5 py-1 text-xs text-erro"
                                    : v.estoque_atual <= v.estoque_minimo
                                      ? "rounded-lg border border-alerta/25 bg-alerta-fundo px-2.5 py-1 text-xs text-alerta"
                                      : "rounded-lg border border-borda-suave bg-fundo/70 px-2.5 py-1 text-xs text-texto"
                                }
                              >
                                <span className="font-semibold">{v.tamanho}</span>
                                <span className="numeros ml-1.5">{v.estoque_atual} un</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 border-t border-borda-suave/70 pt-3">
                    <NovaVariacao modeloId={g.modeloId} nome={g.nome} />
                  </div>
                </Cartao>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

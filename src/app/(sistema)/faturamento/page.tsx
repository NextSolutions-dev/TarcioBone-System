import { Cartao, Indicador, Titulo, Vazio } from "@/lib/componentes"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { LinhaFaturamento, ResumoFaturamento } from "@/lib/supabase/types"
import { diasAtrasISO, dinheiro, hojeISO } from "@/lib/utils"

export const metadata = { title: "Faturamento" }

const ATALHOS = [
  { rotulo: "Hoje", dias: 0 },
  { rotulo: "7 dias", dias: 6 },
  { rotulo: "30 dias", dias: 29 },
  { rotulo: "90 dias", dias: 89 },
]

export default async function PaginaFaturamento({
  searchParams,
}: PageProps<"/faturamento">) {
  const params = await searchParams
  const hoje = hojeISO()

  const de = typeof params.de === "string" ? params.de : diasAtrasISO(29)
  const ate = typeof params.ate === "string" ? params.ate : hoje

  const supabase = await criarClienteServidor()

  const [resumo, porProduto] = await Promise.all([
    supabase.rpc("resumo_faturamento", { _de: de, _ate: ate }),
    supabase.rpc("faturamento_por_produto", { _de: de, _ate: ate }),
  ])

  const total = (resumo.data?.[0] ?? null) as ResumoFaturamento | null
  const linhas = (porProduto.data ?? []) as LinhaFaturamento[]

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Faturamento</h1>

      <div>
        <p className="font-display text-xl font-bold text-texto">Faturamento</p>
        <p className="text-sm text-texto-suave">
          Calculado a partir das vendas registradas — nada é lançado à mão.
        </p>
      </div>

      {/* Período */}
      <Cartao className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="de"
              className="block text-[11px] font-medium uppercase tracking-wider text-texto-suave"
            >
              De
            </label>
            <input
              id="de"
              name="de"
              type="date"
              defaultValue={de}
              max={ate}
              className="h-11 rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ate"
              className="block text-[11px] font-medium uppercase tracking-wider text-texto-suave"
            >
              Até
            </label>
            <input
              id="ate"
              name="ate"
              type="date"
              defaultValue={ate}
              max={hoje}
              className="h-11 rounded-lg border border-borda-suave bg-campo px-3 text-sm outline-none focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
            />
          </div>

          <button
            type="submit"
            className="h-11 rounded-lg bg-marca px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-vivo"
          >
            Aplicar
          </button>

          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            {ATALHOS.map((atalho) => (
              <a
                key={atalho.rotulo}
                href={`/faturamento?de=${diasAtrasISO(atalho.dias)}&ate=${hoje}`}
                className="flex h-11 items-center rounded-lg border border-borda-suave px-3.5 text-xs font-medium text-texto-suave transition-colors hover:border-acento/40 hover:text-acento"
              >
                {atalho.rotulo}
              </a>
            ))}
          </div>
        </form>
      </Cartao>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador destaque rotulo="Faturado no período" valor={dinheiro(total?.total_centavos ?? 0)} />
        <Indicador rotulo="Vendas" valor={String(total?.vendas ?? 0)} />
        <Indicador rotulo="Peças vendidas" valor={String(total?.pecas ?? 0)} />
        <Indicador rotulo="Ticket médio" valor={dinheiro(total?.ticket_centavos ?? 0)} />
      </div>

      {/* Detalhamento por produto — o pedido literal do cliente */}
      <Cartao>
        <div className="border-b border-borda-suave px-4 py-3">
          <Titulo>Detalhamento por produto</Titulo>
          <p className="mt-0.5 text-xs text-texto-suave">
            Quanto cada boné vendeu no período e o peso dele no faturamento.
          </p>
        </div>

        {linhas.length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo="Nenhuma venda neste período"
              descricao="Escolha outro intervalo de datas ou registre uma venda para ver o detalhamento."
            />
          </div>
        ) : (
          <div className="rolagem-suave overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-marca text-marca-texto">
                <tr className="text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold">Produto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Categoria</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Qtd.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Faturado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Participação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr
                    key={linha.produto_id}
                    className="border-b border-borda-suave/50 transition-colors even:bg-fundo/70 hover:bg-acento/5"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-texto">{linha.modelo}</p>
                      <p className="text-xs text-texto-suave">
                        {linha.cor} · {linha.sku}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-texto-suave">{linha.categoria}</td>
                    <td className="numeros px-4 py-2.5 text-right font-medium text-texto">
                      {linha.quantidade}
                    </td>
                    <td className="numeros px-4 py-2.5 text-right font-semibold text-texto">
                      {dinheiro(linha.total_centavos)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          aria-hidden
                          className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-borda-suave sm:block"
                        >
                          <span
                            className="block h-full rounded-full bg-acento-vivo"
                            style={{ width: `${Math.max(Number(linha.participacao), 3)}%` }}
                          />
                        </span>
                        <span className="numeros w-12 text-right text-texto-suave">
                          {Number(linha.participacao).toFixed(1).replace(".", ",")}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-borda">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-texto">
                    Total
                  </td>
                  <td className="numeros px-4 py-3 text-right font-semibold text-texto">
                    {total?.pecas ?? 0}
                  </td>
                  <td className="numeros px-4 py-3 text-right font-bold text-texto">
                    {dinheiro(total?.total_centavos ?? 0)}
                  </td>
                  <td className="numeros px-4 py-3 text-right text-texto-suave">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Cartao>
    </div>
  )
}

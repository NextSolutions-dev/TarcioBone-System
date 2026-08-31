import { Cartao, Selo, Titulo, Vazio } from "@/lib/componentes"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import { ROTULO_PAGAMENTO, dinheiro, momento } from "@/lib/utils"

export const metadata = { title: "Vendas" }

type ItemDaVenda = {
  quantidade: number
  preco_unitario_centavos: number
  descricao: string | null
  produtos: { modelo: string; cor: string; sku: string } | null
}

export default async function PaginaVendas() {
  const supabase = await criarClienteServidor()
  const perfil = await perfilAtual()

  const { data: vendas } = await supabase
    .from("vendas")
    .select(
      `id, numero, total_centavos, subtotal_centavos, desconto_centavos,
       desconto_motivo, frete_centavos, canal, criada_em, forma_pagamento,
       origem, cliente_nome,
       perfis ( nome ),
       venda_itens ( quantidade, preco_unitario_centavos, descricao,
                     produtos ( modelo, cor, sku ) )`,
    )
    .order("criada_em", { ascending: false })
    .limit(80)

  const lista = vendas ?? []

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Vendas</h1>

      <div>
        <p className="font-display text-xl font-bold text-texto">Vendas</p>
        <p className="text-sm text-texto-suave">
          {perfil?.papel === "dono"
            ? "Todas as vendas da loja, da mais recente para a mais antiga."
            : "As vendas que você registrou."}
        </p>
      </div>

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhuma venda registrada"
          descricao="Assim que a primeira venda for fechada na tela Vender, ela aparece aqui com os itens detalhados."
        />
      ) : (
        <Cartao>
          <div className="border-b border-borda-suave px-4 py-3">
            <Titulo>Histórico</Titulo>
          </div>

          <ul className="divide-y divide-borda-suave/60">
            {lista.map((venda) => {
              const itens = (venda.venda_itens ?? []) as unknown as ItemDaVenda[]
              const vendedor = (venda.perfis as unknown as { nome: string } | null)?.nome

              return (
                <li key={venda.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-texto">
                      Venda nº <span className="numeros">{venda.numero}</span>
                    </p>
                    {venda.cliente_nome ? (
                      <p className="text-sm text-texto-suave">{venda.cliente_nome}</p>
                    ) : null}

                    <span className="ml-auto numeros text-base font-bold text-texto">
                      {dinheiro(venda.total_centavos)}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                    <span className="numeros">{momento(venda.criada_em)}</span>
                    <span aria-hidden>·</span>
                    <span>{ROTULO_PAGAMENTO[venda.forma_pagamento]}</span>
                    {vendedor ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{vendedor}</span>
                      </>
                    ) : null}
                    {venda.canal === "atacado" ? <Selo tom="marca">Atacado</Selo> : null}
                    {venda.origem === "catalogo" ? <Selo tom="marca">Pedido do site</Selo> : null}
                  </div>

                  {venda.desconto_centavos > 0 || venda.frete_centavos > 0 ? (
                    <p className="mt-1 text-xs text-texto-suave">
                      <span className="numeros">{dinheiro(venda.subtotal_centavos)}</span> em itens
                      {venda.desconto_centavos > 0 ? (
                        <>
                          {" · "}
                          <span className="text-erro">
                            − <span className="numeros">{dinheiro(venda.desconto_centavos)}</span>
                            {venda.desconto_motivo ? ` (${venda.desconto_motivo})` : ""}
                          </span>
                        </>
                      ) : null}
                      {venda.frete_centavos > 0 ? (
                        <>
                          {" · "}
                          frete <span className="numeros">{dinheiro(venda.frete_centavos)}</span>
                        </>
                      ) : null}
                    </p>
                  ) : null}

                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {itens.map((item, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-borda-suave bg-fundo/70 px-2.5 py-1 text-xs text-texto-suave"
                      >
                        <span className="numeros font-semibold text-texto">
                          {item.quantidade}×
                        </span>{" "}
                        {item.produtos?.modelo ?? item.descricao ?? "Produto removido"}
                        {item.produtos ? ` · ${item.produtos.cor}` : ""}
                        {!item.produtos && item.descricao ? (
                          <span className="ml-1 text-[10px] uppercase tracking-wide text-acento">
                            avulso
                          </span>
                        ) : null}
                        <span className="numeros ml-1.5 text-texto-suave">
                          {dinheiro(item.preco_unitario_centavos)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}
    </div>
  )
}

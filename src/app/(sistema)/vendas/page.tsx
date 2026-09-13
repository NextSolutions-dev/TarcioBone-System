import { Cartao, Selo, Titulo, Vazio } from "@/lib/componentes"
import { IconeTroca, IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import { ROTULO_PAGAMENTO, diasDesde, dinheiro, linkWhatsApp, momento } from "@/lib/utils"

import { Troca } from "./troca"

export const metadata = { title: "Vendas" }

type ItemDaVenda = {
  id: string
  quantidade: number
  preco_unitario_centavos: number
  descricao: string | null
  produtos: { modelo: string; cor: string; sku: string } | null
}

type TrocaDaVenda = {
  id: string
  venda_item_id: string
  quantidade: number
  motivo: string
  volta_ao_estoque: boolean | null
  quantidade_nova: number | null
  criada_em: string
  produtos: { modelo: string; cor: string } | null
}

export default async function PaginaVendas() {
  const supabase = await criarClienteServidor()
  const perfil = await perfilAtual()
  const ehDono = perfil?.papel === "dono"

  const [vendasRes, cfgRes] = await Promise.all([
    supabase
      .from("vendas")
      .select(
        `id, numero, total_centavos, subtotal_centavos, desconto_centavos,
         desconto_motivo, frete_centavos, canal, criada_em, forma_pagamento,
         origem, cliente_nome,
         perfis ( nome ),
         clientes ( nome, telefone ),
         venda_itens ( id, quantidade, preco_unitario_centavos, descricao,
                       produtos ( modelo, cor, sku ) ),
         trocas ( id, venda_item_id, quantidade, motivo, volta_ao_estoque,
                  quantidade_nova, criada_em,
                  produtos:produto_novo_id ( modelo, cor ) )`,
      )
      .order("criada_em", { ascending: false })
      .limit(80),
    supabase.from("loja_config").select("troca_prazo_dias").eq("id", true).maybeSingle(),
  ])

  const lista = vendasRes.data ?? []
  const prazo = cfgRes.data?.troca_prazo_dias ?? 15

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Vendas</h1>

      <div>
        <p className="font-display text-xl font-bold text-texto">Vendas</p>
        <p className="text-sm text-texto-suave">
          {ehDono
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
              const trocas = (venda.trocas ?? []) as unknown as TrocaDaVenda[]
              const vendedor = (venda.perfis as unknown as { nome: string } | null)?.nome
              const cliente = venda.clientes as unknown as
                | { nome: string; telefone: string | null }
                | null

              const dias = diasDesde(venda.criada_em)

              const nomeDoItem = (item: ItemDaVenda) =>
                item.produtos
                  ? `${item.produtos.modelo} · ${item.produtos.cor}`
                  : (item.descricao ?? "Produto removido")

              /** Mensagem pronta sobre esta venda. Só existe com cliente
               *  cadastrado E telefone — sem número não há para quem mandar. */
              const zap = linkWhatsApp(
                cliente?.telefone,
                [
                  // Nome inteiro: no atacado o cliente costuma ser empresa, e "Olá, Loja!"
                  // (de "Loja do Zé") soa errado.
                  `Olá, ${cliente?.nome ?? ""}! Sobre o seu pedido nº ${venda.numero}:`,
                  "",
                  ...itens.map(
                    (i) =>
                      `• ${i.quantidade}x ${i.produtos?.modelo ?? i.descricao ?? "item"}` +
                      (i.produtos ? ` (${i.produtos.cor})` : ""),
                  ),
                  "",
                  `Total: ${dinheiro(venda.total_centavos)}`,
                ].join("\n"),
              )

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

                    {zap ? (
                      <a
                        href={zap}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Mandar mensagem para ${cliente?.nome}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-borda-suave text-ok transition-colors hover:border-ok/40 hover:bg-ok-fundo"
                      >
                        <IconeWhatsApp className="h-4 w-4" />
                        <span className="sr-only">Mandar mensagem sobre esta venda</span>
                      </a>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                    <span className="numeros">{momento(venda.criada_em)}</span>
                    {/* Os dias decorridos são o dado que sustenta a decisão de troca. */}
                    <span aria-hidden>·</span>
                    <span className="numeros">
                      há {dias} {dias === 1 ? "dia" : "dias"}
                    </span>
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
                    {trocas.length > 0 ? (
                      <Selo tom="alerta">
                        {trocas.length === 1 ? "1 troca" : `${trocas.length} trocas`}
                      </Selo>
                    ) : null}
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
                    {itens.map((item) => (
                      <li
                        key={item.id}
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

                  {/* Trocas já registradas: o que voltou, por quê e o que saiu no lugar. */}
                  {trocas.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {trocas.map((t) => {
                        const item = itens.find((i) => i.id === t.venda_item_id)
                        return (
                          <li
                            key={t.id}
                            className="flex items-start gap-1.5 rounded-lg border border-alerta/30 bg-alerta-fundo px-2.5 py-1.5 text-xs text-alerta"
                          >
                            <IconeTroca className="mt-px h-3.5 w-3.5 shrink-0" />
                            <span>
                              <span className="numeros font-semibold">{t.quantidade}×</span>{" "}
                              {item ? nomeDoItem(item) : "item da venda"} devolvida(s)
                              {/* null = regime novo, estoque tratado à mão; só os
                                  registros antigos dizem o que houve com o saldo. */}
                              {t.volta_ao_estoque === false ? " (não voltou ao estoque)" : ""}
                              {t.produtos ? (
                                <>
                                  {" → levou "}
                                  <span className="numeros font-semibold">
                                    {t.quantidade_nova}×
                                  </span>{" "}
                                  {t.produtos.modelo} · {t.produtos.cor}
                                </>
                              ) : null}
                              <span className="block text-alerta/80">
                                {t.motivo} · {momento(t.criada_em)}
                              </span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}

                  {ehDono ? (
                    <Troca
                      numero={venda.numero}
                      diasDaVenda={dias}
                      prazo={prazo}
                      itens={itens.map((i) => ({
                        id: i.id,
                        rotulo: nomeDoItem(i),
                        quantidade: i.quantidade,
                        jaTrocado: trocas
                          .filter((t) => t.venda_item_id === i.id)
                          .reduce((soma, t) => soma + t.quantidade, 0),
                      }))}
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}
    </div>
  )
}

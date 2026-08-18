import Link from "next/link"

import { Cartao, Indicador, Selo, Titulo, Vazio } from "@/lib/componentes"
import { IconeAlerta } from "@/lib/icones"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import type { LinhaFaturamento, ResumoFaturamento } from "@/lib/supabase/types"
import { ROTULO_PAGAMENTO, dataCurta, diasAtrasISO, dinheiro, hojeISO } from "@/lib/utils"

export const metadata = { title: "Painel" }

export default async function PaginaPainel() {
  const supabase = await criarClienteServidor()
  const perfil = await perfilAtual()

  const hoje = hojeISO()
  const inicioMes = `${hoje.slice(0, 7)}-01`

  const [resumoMes, resumoHoje, topProdutos, baixoEstoque, ultimasVendas] =
    await Promise.all([
      supabase.rpc("resumo_faturamento", { _de: inicioMes, _ate: hoje }),
      supabase.rpc("resumo_faturamento", { _de: hoje, _ate: hoje }),
      supabase.rpc("faturamento_por_produto", { _de: diasAtrasISO(30), _ate: hoje }),
      supabase
        .from("produtos")
        .select("id, modelo, cor, sku, estoque_atual, estoque_minimo")
        .eq("ativo", true)
        .order("estoque_atual"),
      supabase
        .from("vendas")
        .select("id, numero, total_centavos, criada_em, forma_pagamento, origem, cliente_nome")
        .order("criada_em", { ascending: false })
        .limit(6),
    ])

  const mes = (resumoMes.data?.[0] ?? null) as ResumoFaturamento | null
  const dia = (resumoHoje.data?.[0] ?? null) as ResumoFaturamento | null
  const top = ((topProdutos.data ?? []) as LinhaFaturamento[]).slice(0, 5)
  const alertas = (baixoEstoque.data ?? []).filter(
    (p) => p.estoque_atual <= p.estoque_minimo,
  )

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Painel</h1>

      <div>
        <p className="font-display text-xl font-bold text-texto">
          Olá, {perfil?.nome.split(" ")[0]}
        </p>
        <p className="text-sm text-texto-suave">
          {perfil?.papel === "dono"
            ? "Resumo da loja no mês corrente."
            : "Resumo das suas vendas no mês corrente."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          destaque
          rotulo="Faturamento do mês"
          valor={dinheiro(mes?.total_centavos ?? 0)}
          apoio={`${mes?.vendas ?? 0} vendas · ${mes?.pecas ?? 0} peças`}
        />
        <Indicador
          rotulo="Hoje"
          valor={dinheiro(dia?.total_centavos ?? 0)}
          apoio={`${dia?.vendas ?? 0} vendas`}
        />
        <Indicador
          rotulo="Ticket médio do mês"
          valor={dinheiro(mes?.ticket_centavos ?? 0)}
          apoio="Por venda registrada"
        />
        <Indicador
          rotulo="Itens em alerta"
          valor={String(alertas.length)}
          apoio="No estoque mínimo ou abaixo"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Mais vendidos */}
        <Cartao className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-borda-suave px-4 py-3">
            <Titulo>Mais vendidos · últimos 30 dias</Titulo>
            <Link
              href="/faturamento"
              className="text-xs font-medium text-acento underline-offset-4 hover:underline"
            >
              Ver detalhamento
            </Link>
          </div>

          {top.length === 0 ? (
            <div className="p-4">
              <Vazio
                titulo="Ainda sem vendas no período"
                descricao="Assim que a primeira venda for registrada, o ranking por produto aparece aqui."
              />
            </div>
          ) : (
            <ul className="divide-y divide-borda-suave/60">
              {top.map((linha) => (
                <li key={linha.produto_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto">
                      {linha.modelo}
                    </p>
                    <p className="truncate text-xs text-texto-suave">
                      {linha.cor} · {linha.categoria}
                    </p>
                  </div>

                  <div
                    aria-hidden
                    className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-fundo sm:block"
                  >
                    <div
                      className="h-full rounded-full bg-acento-vivo"
                      style={{ width: `${Math.max(Number(linha.participacao), 4)}%` }}
                    />
                  </div>

                  <div className="w-24 shrink-0 text-right">
                    <p className="numeros text-sm font-semibold text-texto">
                      {dinheiro(linha.total_centavos)}
                    </p>
                    <p className="numeros text-xs text-texto-suave">
                      {linha.quantidade} un · {linha.participacao}%
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {/* Estoque em alerta */}
        <Cartao>
          <div className="border-b border-borda-suave px-4 py-3">
            <Titulo>Precisa repor</Titulo>
          </div>

          {alertas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-texto-suave">
              Nenhum produto abaixo do mínimo.
            </p>
          ) : (
            <ul className="divide-y divide-borda-suave/60">
              {alertas.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-alerta">
                    <IconeAlerta />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto">{p.modelo}</p>
                    <p className="truncate text-xs text-texto-suave">{p.cor}</p>
                  </div>
                  <Selo tom={p.estoque_atual === 0 ? "erro" : "alerta"}>
                    {p.estoque_atual === 0 ? "Esgotado" : `${p.estoque_atual} un`}
                  </Selo>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      {/* Últimas vendas */}
      <Cartao>
        <div className="flex items-center justify-between border-b border-borda-suave px-4 py-3">
          <Titulo>Últimas vendas</Titulo>
          <Link
            href="/vendas"
            className="text-xs font-medium text-acento underline-offset-4 hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {(ultimasVendas.data ?? []).length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo="Nenhuma venda ainda"
              descricao="Registre a primeira venda pela tela Vender — o estoque e o faturamento se atualizam sozinhos."
            />
          </div>
        ) : (
          <ul className="divide-y divide-borda-suave/60">
            {(ultimasVendas.data ?? []).map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-texto">
                    Venda nº <span className="numeros">{v.numero}</span>
                    {v.cliente_nome ? (
                      <span className="font-normal text-texto-suave"> · {v.cliente_nome}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {dataCurta(v.criada_em)} · {ROTULO_PAGAMENTO[v.forma_pagamento]}
                  </p>
                </div>
                {v.origem === "catalogo" ? <Selo tom="marca">Do site</Selo> : null}
                <span className="numeros shrink-0 text-sm font-semibold text-texto">
                  {dinheiro(v.total_centavos)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  )
}

import { Cartao, Selo, Titulo, Vazio } from "@/lib/componentes"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import type { Produto } from "@/lib/supabase/types"
import { dinheiro, momento } from "@/lib/utils"

import { FormularioEntrada } from "./formulario-entrada"

export const metadata = { title: "Estoque" }

export default async function PaginaEstoque() {
  const supabase = await criarClienteServidor()
  const perfil = await perfilAtual()
  const ehDono = perfil?.papel === "dono"

  const [produtosRes, movimentosRes] = await Promise.all([
    supabase.from("produtos").select("*").eq("ativo", true).order("estoque_atual"),
    supabase
      .from("estoque_movimentos")
      .select("id, tipo, quantidade, motivo, criado_em, produtos ( modelo, cor )")
      .order("criado_em", { ascending: false })
      .limit(25),
  ])

  const produtos = (produtosRes.data ?? []) as Produto[]
  const movimentos = movimentosRes.data ?? []

  const valorEmEstoque = produtos.reduce(
    (soma, p) => soma + p.estoque_atual * p.preco_centavos,
    0,
  )
  const emAlerta = produtos.filter((p) => p.estoque_atual <= p.estoque_minimo)

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Estoque</h1>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-texto">Estoque</p>
          <p className="text-sm text-texto-suave">
            O saldo se move sozinho a cada venda — aqui só entram reposições e correções.
          </p>
        </div>

        <div className="flex gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-texto-suave">
              Peças
            </p>
            <p className="numeros font-display text-lg font-bold text-texto">
              {produtos.reduce((s, p) => s + p.estoque_atual, 0)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-texto-suave">
              Valor em estoque
            </p>
            <p className="numeros font-display text-lg font-bold text-texto">
              {dinheiro(valorEmEstoque)}
            </p>
          </div>
        </div>
      </div>

      {ehDono ? (
        <Cartao className="p-4">
          <div className="mb-3">
            <Titulo>Lançar entrada</Titulo>
          </div>
          <FormularioEntrada produtos={produtos} />
        </Cartao>
      ) : null}

      {emAlerta.length > 0 ? (
        <div className="rounded-xl border border-alerta/25 bg-alerta-fundo px-4 py-3">
          <p className="text-sm font-medium text-alerta">
            {emAlerta.length} produto(s) no mínimo ou abaixo:{" "}
            <span className="font-normal">
              {emAlerta.map((p) => `${p.modelo} (${p.cor})`).join(", ")}
            </span>
          </p>
        </div>
      ) : null}

      <Cartao>
        <div className="border-b border-borda-suave px-4 py-3">
          <Titulo>Saldo por produto</Titulo>
        </div>

        {produtos.length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo="Nenhum produto cadastrado"
              descricao="Cadastre os bonés na tela Produtos para começar a controlar o estoque."
            />
          </div>
        ) : (
          <div className="rolagem-suave overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="bg-marca text-marca-texto">
                <tr className="text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold">Produto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Código</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Preço</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-borda-suave/50 transition-colors even:bg-fundo/70 hover:bg-acento/5"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-texto">{p.modelo}</p>
                      <p className="text-xs text-texto-suave">{p.cor}</p>
                    </td>
                    <td className="numeros px-4 py-2.5 text-texto-suave">{p.sku}</td>
                    <td className="numeros px-4 py-2.5 text-right text-texto">
                      {dinheiro(p.preco_centavos)}
                    </td>
                    <td className="numeros px-4 py-2.5 text-right font-semibold text-texto">
                      {p.estoque_atual}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.estoque_atual === 0 ? (
                        <Selo tom="erro">Esgotado</Selo>
                      ) : p.estoque_atual <= p.estoque_minimo ? (
                        <Selo tom="alerta">Repor</Selo>
                      ) : (
                        <Selo tom="ok">Em dia</Selo>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <Cartao>
        <div className="border-b border-borda-suave px-4 py-3">
          <Titulo>Últimos movimentos</Titulo>
          <p className="mt-0.5 text-xs text-texto-suave">
            Cada linha é um fato registrado. É desta lista que o saldo acima nasce.
          </p>
        </div>

        {movimentos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-texto-suave">
            Nenhum movimento ainda.
          </p>
        ) : (
          <ul className="divide-y divide-borda-suave/60">
            {movimentos.map((m) => {
              const produto = m.produtos as unknown as { modelo: string; cor: string } | null
              const entrada = m.quantidade > 0

              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={`numeros w-12 shrink-0 text-sm font-bold ${
                      entrada ? "text-ok" : "text-erro"
                    }`}
                  >
                    {entrada ? "+" : ""}
                    {m.quantidade}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-texto">
                      {produto ? `${produto.modelo} · ${produto.cor}` : "Produto removido"}
                    </p>
                    <p className="truncate text-xs text-texto-suave">
                      {m.motivo ?? "—"} · <span className="numeros">{momento(m.criado_em)}</span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
    </div>
  )
}

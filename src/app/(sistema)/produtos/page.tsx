import { redirect } from "next/navigation"

import { Cartao, Selo, Titulo, Vazio } from "@/lib/componentes"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import type { Categoria, Produto } from "@/lib/supabase/types"
import { dinheiro } from "@/lib/utils"

import { alternarCatalogo } from "./acoes"
import { FotoProduto } from "./foto-produto"
import { FormularioProduto } from "./formulario-produto"

export const metadata = { title: "Produtos" }

export default async function PaginaProdutos() {
  const perfil = await perfilAtual()
  // Tela de dono. A RLS já impede a escrita; isto evita a tela em branco.
  if (perfil?.papel !== "dono") redirect("/painel")

  const supabase = await criarClienteServidor()

  const [produtosRes, categoriasRes] = await Promise.all([
    supabase.from("produtos").select("*, categorias ( nome )").order("modelo").order("cor"),
    supabase.from("categorias").select("*").order("ordem"),
  ])

  const produtos = (produtosRes.data ?? []) as (Produto & {
    categorias: { nome: string } | null
  })[]
  const categorias = (categoriasRes.data ?? []) as Categoria[]

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Produtos</h1>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-texto">Produtos</p>
          <p className="text-sm text-texto-suave">
            O que está marcado como vitrine aparece no site na hora.
          </p>
        </div>
        <FormularioProduto categorias={categorias} />
      </div>

      <Cartao>
        <div className="border-b border-borda-suave px-4 py-3">
          <Titulo>Catálogo da loja</Titulo>
        </div>

        {produtos.length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo="Nenhum produto cadastrado"
              descricao="Cadastre o primeiro boné para poder vender e para o site ter o que mostrar."
            />
          </div>
        ) : (
          <div className="rolagem-suave overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead className="bg-marca text-marca-texto">
                <tr className="text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold">Foto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Produto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Categoria</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Código</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Varejo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Atacado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Estoque</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Vitrine do site</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-borda-suave/50 transition-colors even:bg-fundo/70 hover:bg-acento/5"
                  >
                    <td className="px-4 py-2.5">
                      <FotoProduto
                        produtoId={p.id}
                        fotoUrl={p.foto_url}
                        nome={`${p.modelo} ${p.cor}`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-texto">{p.modelo}</p>
                      <p className="text-xs text-texto-suave">{p.cor}</p>
                    </td>
                    <td className="px-4 py-2.5 text-texto-suave">
                      {p.categorias?.nome ?? "—"}
                    </td>
                    <td className="numeros px-4 py-2.5 text-texto-suave">{p.sku}</td>
                    <td className="numeros px-4 py-2.5 text-right font-semibold text-texto">
                      {dinheiro(p.preco_centavos)}
                    </td>
                    <td className="numeros px-4 py-2.5 text-right text-texto">
                      {p.preco_atacado_centavos === null ? (
                        <span className="text-xs text-texto-suave">—</span>
                      ) : (
                        dinheiro(p.preco_atacado_centavos)
                      )}
                    </td>
                    <td className="numeros px-4 py-2.5 text-right text-texto">
                      {p.estoque_atual}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <form action={alternarCatalogo} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="atual" value={String(p.no_catalogo)} />
                        <button type="submit" className="cursor-pointer">
                          <Selo
                            tom={
                              !p.no_catalogo
                                ? "neutro"
                                : p.preco_atacado_centavos === null
                                  ? "alerta"
                                  : "ok"
                            }
                          >
                            {!p.no_catalogo
                              ? "Fora do site"
                              : p.preco_atacado_centavos === null
                                ? "Falta preço de atacado"
                                : "No site"}
                          </Selo>
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </div>
  )
}

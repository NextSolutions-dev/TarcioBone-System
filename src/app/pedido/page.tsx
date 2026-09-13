import Link from "next/link"

import { Bone } from "@/lib/bone"
import { IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { VariacaoCatalogo } from "@/lib/supabase/types"
import { dinheiro } from "@/lib/utils"
import { chaveCor } from "@/lib/variacoes"

import { paraVariacaoLoja, type VariacaoLoja } from "../catalogo/tipos"

export const metadata = {
  title: "Seu pedido",
  description: "Os itens do pedido, com foto e valor.",
}

/**
 * Página pública do pedido — é o que resolve "já ir pra mensagem do cliente com
 * as imagens do produto". O WhatsApp não anexa imagem por link, só texto; então
 * a mensagem leva o endereço desta página.
 *
 * Decisão importante: **o pedido não é gravado**. Os itens viajam na própria
 * URL (`?i=SKU:QTD,SKU:QTD`) e a página busca as variações no catálogo público.
 * Assim:
 *   - não nasce venda que ninguém confirmou (nem movimento de estoque fantasma);
 *   - o visitante continua sem NENHUMA permissão de escrita no banco, que seria
 *     porta aberta para spam;
 *   - o link continua funcionando depois, porque descreve o que foi pedido.
 * O preço mostrado é sempre o atual — se a tabela mudar, o link reflete a mudança.
 *
 * Desde a chegada de cor e tamanho, cada código (SKU) é uma variação: a foto é
 * a da cor pedida, e o tamanho vai escrito.
 */
export default async function PaginaPedido({ searchParams }: PageProps<"/pedido">) {
  const params = await searchParams
  const bruto = typeof params.i === "string" ? params.i : ""

  // "POLO-PRE-M:2,BONE-AZU-UNIC:3" -> [{sku, quantidade}]
  const pedidos = bruto
    .split(",")
    .map((parte) => {
      const [sku, qtd] = parte.split(":")
      const quantidade = Number(qtd)
      if (!sku || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 9999) {
        return null
      }
      return { sku: sku.trim().slice(0, 32), quantidade }
    })
    .filter((x): x is { sku: string; quantidade: number } => x !== null)
    .slice(0, 60)

  const supabase = await criarClienteServidor()

  const [itensRes, cfgRes] = await Promise.all([
    pedidos.length
      ? supabase
          .from("catalogo_variacoes")
          .select("*")
          .in(
            "sku",
            pedidos.map((p) => p.sku),
          )
      : Promise.resolve({ data: [] as VariacaoCatalogo[] }),
    supabase
      .from("loja_config")
      .select("nome_loja, whatsapp_publico")
      .eq("id", true)
      .maybeSingle(),
  ])

  const catalogo = paraVariacaoLoja((itensRes.data ?? []) as VariacaoCatalogo[])

  // Só as fotos dos modelos pedidos — uma consulta, a capa de cada cor.
  const modelosPedidos = [...new Set(catalogo.map((c) => c.modelo_id))]
  const { data: fotos } = modelosPedidos.length
    ? await supabase
        .from("modelo_fotos")
        .select("modelo_id, cor, url, ordem")
        .in("modelo_id", modelosPedidos)
        .order("ordem")
    : { data: [] }

  function fotoDa(v: VariacaoLoja) {
    return (
      (fotos ?? []).find(
        (f) => f.modelo_id === v.modelo_id && chaveCor(f.cor) === chaveCor(v.cor),
      )?.url ?? null
    )
  }

  const loja = cfgRes.data?.nome_loja ?? "Loja"
  const whatsapp = cfgRes.data?.whatsapp_publico ?? null

  const linhas = pedidos
    .map((p) => {
      const item = catalogo.find((c) => c.sku === p.sku)
      return item ? { item, quantidade: p.quantidade } : null
    })
    .filter((x): x is { item: VariacaoLoja; quantidade: number } => x !== null)

  const total = linhas.reduce((soma, l) => soma + l.quantidade * l.item.preco_centavos, 0)
  const pecas = linhas.reduce((soma, l) => soma + l.quantidade, 0)
  const sumiram = pedidos.length - linhas.length

  return (
    <div className="malha min-h-dvh bg-onix pb-20">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/catalogo" className="font-cartaz text-xl tracking-[0.06em] text-creme">
          {loja}
        </Link>
        <Link
          href="/catalogo"
          className="font-etiqueta text-[11px] uppercase tracking-widest text-fumaca transition-colors hover:text-ouro"
        >
          Ver a coleção
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5">
        <h1 className="font-cartaz text-[clamp(2rem,7vw,3.5rem)] leading-none text-creme">
          Seu pedido
        </h1>
        <div className="mt-4 h-[3px] w-full bg-ouro" />

        {linhas.length === 0 ? (
          <div className="mt-10 border border-dashed border-linha p-8 text-center">
            <p className="font-cartaz text-xl text-creme">Pedido vazio</p>
            <p className="mt-2 text-sm text-cinza">
              O link não trouxe nenhum item que ainda esteja no catálogo. Monte o pedido de
              novo na coleção.
            </p>
            <Link
              href="/catalogo"
              className="mt-5 inline-flex h-11 items-center bg-ouro px-5 font-etiqueta text-[11px] uppercase tracking-widest text-onix"
            >
              Ir para a coleção
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-3">
              {linhas.map((l) => {
                const foto = fotoDa(l.item)
                const unico = /^[uú]nico$/i.test(l.item.tamanho.trim())
                return (
                  <li
                    key={l.item.sku}
                    className="flex items-center gap-4 border border-linha bg-carvao p-3"
                  >
                    <div className="h-24 w-20 shrink-0 overflow-hidden bg-onix">
                      {foto ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={foto}
                          alt={`${l.item.modelo} ${l.item.cor}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Bone cor={l.item.cor} className="h-full w-full p-1" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-cartaz text-lg leading-tight text-creme">
                        {l.item.modelo}
                      </p>
                      <p className="mt-0.5 font-etiqueta text-xs uppercase tracking-widest text-cinza">
                        {l.item.cor}
                        {unico ? "" : ` · tam. ${l.item.tamanho}`}
                      </p>
                      <p className="numeros mt-1 font-etiqueta text-xs text-fumaca">
                        {l.quantidade} × {dinheiro(l.item.preco_centavos)}
                      </p>
                    </div>

                    <p className="numeros shrink-0 font-cartaz text-lg text-creme">
                      {dinheiro(l.quantidade * l.item.preco_centavos)}
                    </p>
                  </li>
                )
              })}
            </ul>

            {sumiram > 0 ? (
              <p className="mt-3 border border-linha bg-carvao px-3 py-2 font-etiqueta text-[11px] uppercase tracking-wider text-fumaca">
                {sumiram} {sumiram === 1 ? "item saiu" : "itens saíram"} do catálogo desde
                que o pedido foi montado
              </p>
            ) : null}

            <div className="mt-6 flex items-end justify-between border-t-2 border-linha pt-4">
              <p className="font-etiqueta text-[11px] uppercase tracking-widest text-fumaca">
                {pecas} {pecas === 1 ? "peça" : "peças"}
              </p>
              <p className="numeros font-cartaz text-3xl text-creme">{dinheiro(total)}</p>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-fumaca">
              Valores de hoje. Frete, prazo e forma de pagamento são combinados na conversa.
            </p>

            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 bg-[#25D366] font-etiqueta text-xs font-medium uppercase tracking-widest text-onix transition-transform hover:scale-[1.01]"
              >
                <IconeWhatsApp className="h-5 w-5" />
                Falar sobre este pedido
              </a>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

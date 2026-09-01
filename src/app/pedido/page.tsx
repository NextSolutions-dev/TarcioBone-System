import Link from "next/link"

import { Bone } from "@/lib/bone"
import { IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { ItemCatalogo } from "@/lib/supabase/types"
import { dinheiro } from "@/lib/utils"

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
 * URL (`?i=SKU:QTD,SKU:QTD`) e a página busca os produtos no catálogo público.
 * Assim:
 *   - não nasce venda que ninguém confirmou (nem movimento de estoque fantasma);
 *   - o visitante continua sem NENHUMA permissão de escrita no banco, que seria
 *     porta aberta para spam;
 *   - o link continua funcionando depois, porque descreve o que foi pedido.
 * O preço mostrado é sempre o atual — se a tabela mudar, o link reflete a mudança.
 */
export default async function PaginaPedido({ searchParams }: PageProps<"/pedido">) {
  const params = await searchParams
  const bruto = typeof params.i === "string" ? params.i : ""

  // "ABR-001:2,TRK-002:3" -> [{sku, quantidade}]
  const pedidos = bruto
    .split(",")
    .map((parte) => {
      const [sku, qtd] = parte.split(":")
      const quantidade = Number(qtd)
      if (!sku || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 9999) {
        return null
      }
      return { sku: sku.trim().slice(0, 24), quantidade }
    })
    .filter((x): x is { sku: string; quantidade: number } => x !== null)
    .slice(0, 60)

  const supabase = await criarClienteServidor()

  const [itensRes, cfgRes] = await Promise.all([
    pedidos.length
      ? supabase
          .from("catalogo_publico")
          .select("*")
          .in("sku", pedidos.map((p) => p.sku))
      : Promise.resolve({ data: [] as ItemCatalogo[] }),
    supabase
      .from("loja_config")
      .select("nome_loja, whatsapp_publico")
      .eq("id", true)
      .maybeSingle(),
  ])

  const catalogo = (itensRes.data ?? []) as ItemCatalogo[]
  const loja = cfgRes.data?.nome_loja ?? "Loja"
  const whatsapp = cfgRes.data?.whatsapp_publico ?? null

  const linhas = pedidos
    .map((p) => {
      const item = catalogo.find((c) => c.sku === p.sku)
      return item ? { item, quantidade: p.quantidade } : null
    })
    .filter((x): x is { item: ItemCatalogo; quantidade: number } => x !== null)

  const total = linhas.reduce(
    (soma, l) => soma + l.quantidade * (l.item.preco_centavos ?? 0),
    0,
  )
  const pecas = linhas.reduce((soma, l) => soma + l.quantidade, 0)
  const sumiram = pedidos.length - linhas.length

  return (
    <div className="malha min-h-dvh bg-concreto pb-20">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/catalogo" className="font-cartaz text-lg tracking-[0.28em] text-tinta">
          {loja}
        </Link>
        <Link
          href="/catalogo"
          className="font-mono text-[11px] uppercase tracking-widest text-fumaca transition-colors hover:text-royal"
        >
          Ver a coleção
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5">
        <h1 className="font-cartaz text-[clamp(2rem,7vw,3.5rem)] uppercase leading-none tracking-tight text-tinta">
          Seu pedido
        </h1>
        <div className="mt-4 h-[3px] w-full bg-tinta" />

        {linhas.length === 0 ? (
          <div className="mt-10 border border-dashed border-linha p-8 text-center">
            <p className="font-cartaz text-lg uppercase text-tinta">Pedido vazio</p>
            <p className="mt-2 text-sm text-grafite">
              O link não trouxe nenhum item que ainda esteja no catálogo. Monte o pedido de
              novo na coleção.
            </p>
            <Link
              href="/catalogo"
              className="mt-5 inline-flex h-11 items-center bg-tinta px-5 font-mono text-[11px] uppercase tracking-widest text-white"
            >
              Ir para a coleção
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-3">
              {linhas.map((l) => (
                <li
                  key={l.item.sku}
                  className="flex items-center gap-4 border border-linha bg-papel p-3"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden bg-concreto">
                    {l.item.foto_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={l.item.foto_url}
                        alt={`${l.item.modelo} ${l.item.cor}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Bone cor={l.item.cor ?? ""} className="h-full w-full p-1" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-cartaz text-base uppercase leading-tight text-tinta">
                      {l.item.modelo}
                    </p>
                    <p className="text-sm text-grafite">{l.item.cor}</p>
                    <p className="numeros mt-1 font-mono text-xs text-fumaca">
                      {l.quantidade} × {dinheiro(l.item.preco_centavos)}
                    </p>
                  </div>

                  <p className="numeros shrink-0 font-cartaz text-lg text-tinta">
                    {dinheiro(l.quantidade * (l.item.preco_centavos ?? 0))}
                  </p>
                </li>
              ))}
            </ul>

            {sumiram > 0 ? (
              <p className="mt-3 border border-linha bg-papel px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-fumaca">
                {sumiram} {sumiram === 1 ? "item saiu" : "itens saíram"} do catálogo desde
                que o pedido foi montado
              </p>
            ) : null}

            <div className="mt-6 flex items-end justify-between border-t-2 border-tinta pt-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-fumaca">
                {pecas} {pecas === 1 ? "peça" : "peças"}
              </p>
              <p className="numeros font-cartaz text-3xl text-tinta">{dinheiro(total)}</p>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-fumaca">
              Valores de hoje. Frete, prazo e forma de pagamento são combinados na conversa.
            </p>

            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 bg-[#25D366] font-mono text-xs uppercase tracking-widest text-tinta transition-transform hover:scale-[1.01]"
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

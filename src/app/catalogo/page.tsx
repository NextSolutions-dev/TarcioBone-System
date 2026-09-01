import Link from "next/link"

import { Bone } from "@/lib/bone"
import { IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { Bloco, ItemCatalogo } from "@/lib/supabase/types"

import { Vitrine } from "./vitrine"

export const metadata = {
  title: "Catálogo",
  description: "Monte seu pedido e finalize no WhatsApp.",
}

export const revalidate = 30

export default async function PaginaCatalogo() {
  const supabase = await criarClienteServidor()

  // Tudo que a página mostra vem do banco: o dono edita pela tela Ajustes e o
  // catálogo muda na hora, sem deploy nosso.
  const [itensRes, cfgRes, blocosRes] = await Promise.all([
    supabase.from("catalogo_publico").select("*").order("categoria").order("modelo"),
    supabase
      .from("loja_config")
      .select(
        "nome_loja, whatsapp_publico, hero_eyebrow, hero_titulo, hero_destaque, hero_texto, rodape_texto, pedido_minimo_pecas",
      )
      .eq("id", true)
      .maybeSingle(),
    supabase.from("catalogo_blocos").select("*").eq("ativo", true).order("ordem"),
  ])

  const itens = (itensRes.data ?? []) as ItemCatalogo[]
  const categorias = [...new Set(itens.map((i) => i.categoria ?? "Sem categoria"))]
  const blocos = (blocosRes.data ?? []) as Bloco[]

  const cfg = cfgRes.data
  const whatsapp = cfg?.whatsapp_publico ?? null
  const loja = cfg?.nome_loja ?? "Loja"
  const minimo = cfg?.pedido_minimo_pecas ?? 0

  const diferenciais = blocos.filter((b) => b.tipo === "diferencial")
  const passos = blocos.filter((b) => b.tipo === "passo")

  const titulo = cfg?.hero_titulo ?? "Monte seu pedido."
  const destaque = cfg?.hero_destaque ?? null
  // O destaque é pintado dentro do título; se não estiver lá, o título sai inteiro.
  const [antes, depois] =
    destaque && titulo.includes(destaque) ? titulo.split(destaque) : [titulo, null]

  const desfile = itens.slice(0, 8)

  return (
    <div className="malha min-h-dvh bg-concreto pb-36">
      <header className="mx-auto flex max-w-[92rem] items-center justify-between px-5 py-5 sm:px-8">
        <p className="font-cartaz text-lg tracking-[0.28em] text-tinta">{loja}</p>
        <Link
          href="/login"
          className="font-mono text-[11px] uppercase tracking-widest text-fumaca transition-colors hover:text-royal"
        >
          Área da loja
        </Link>
      </header>

      {/* ---------------------------------------------------------------- hero */}
      <section className="mx-auto max-w-[92rem] px-5 pt-6 sm:px-8 sm:pt-12">
        {cfg?.hero_eyebrow ? (
          <p className="pousa font-mono text-[11px] uppercase tracking-[0.22em] text-fumaca">
            {cfg.hero_eyebrow}
          </p>
        ) : null}

        <h1 className="clip-aba mt-5 font-cartaz text-[clamp(2.6rem,9vw,7rem)] uppercase leading-[0.92] tracking-[-0.02em] text-tinta">
          <span className="block overflow-hidden">
            <span className="block">
              {antes}
              {depois !== null ? <span className="text-royal">{destaque}</span> : null}
              {depois}
            </span>
          </span>
        </h1>

        <div className="mt-8 flex flex-col gap-7 sm:mt-10 lg:flex-row lg:items-end lg:justify-between">
          {cfg?.hero_texto ? (
            <p className="pousa max-w-md text-[15px] leading-relaxed text-grafite sm:text-base">
              {cfg.hero_texto}
            </p>
          ) : (
            <span />
          )}

          <div className="pousa flex flex-wrap gap-3">
            <a
              href="#colecao"
              className="botao-varre flex h-12 items-center border border-tinta px-6 font-mono text-[11px] uppercase tracking-widest text-tinta transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 focus-visible:ring-offset-concreto"
            >
              Ver a coleção
            </a>
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center gap-2 bg-tinta px-6 font-mono text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 focus-visible:ring-offset-concreto"
              >
                <IconeWhatsApp className="h-4 w-4" />
                Falar com a loja
              </a>
            ) : null}
          </div>
        </div>

        {itens.length > 0 ? (
          <div className="relative mt-12 sm:mt-16">
            <div className="overflow-hidden">
              <div className="desfila flex w-max items-end gap-8 pr-8 sm:gap-12 sm:pr-12">
                {[...desfile, ...desfile].map((item, i) => (
                  <div key={`${item.id}-${i}`} className="w-36 shrink-0 sm:w-48">
                    {item.foto_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.foto_url}
                        alt=""
                        className="h-32 w-full object-contain sm:h-40"
                      />
                    ) : (
                      <Bone cor={item.cor ?? ""} className="h-auto w-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="risca-aba h-[3px] w-full bg-tinta" />
          </div>
        ) : (
          <div className="risca-aba mt-12 h-[3px] w-full bg-tinta sm:mt-16" />
        )}
      </section>

      {/* -------------------------------------------------------- diferenciais */}
      {diferenciais.length > 0 ? (
        <section className="mx-auto mt-20 max-w-[92rem] px-5 sm:mt-28 sm:px-8">
          <div className="flex items-baseline justify-between gap-4 border-b border-tinta pb-3">
            <h2 className="font-cartaz text-2xl uppercase tracking-tight text-tinta sm:text-3xl">
              Por que comprar aqui
            </h2>
          </div>

          <ul className="grid gap-x-8 gap-y-10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {diferenciais.map((b) => (
              <li key={b.id}>
                {b.rotulo ? (
                  <p className="font-mono text-[11px] uppercase tracking-widest text-royal">
                    {b.rotulo}
                  </p>
                ) : null}
                <p className="mt-3 font-cartaz text-xl uppercase leading-tight tracking-tight text-tinta">
                  {b.titulo}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-grafite">{b.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ coleção */}
      <section id="colecao" className="mx-auto mt-24 max-w-[92rem] px-5 sm:mt-32 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-tinta pb-3">
          <h2 className="font-cartaz text-2xl uppercase tracking-tight text-tinta sm:text-3xl">
            A coleção
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-widest text-fumaca">
            {itens.length} {itens.length === 1 ? "modelo" : "modelos"}
            {minimo > 0 ? ` · pedido mínimo ${minimo} peças` : ""}
          </p>
        </div>

        <Vitrine
          itens={itens}
          categorias={categorias}
          whatsapp={whatsapp}
          loja={loja}
          minimo={minimo}
        />
      </section>

      {/* ------------------------------------------------------ como comprar */}
      {passos.length > 0 ? (
        <section className="mx-auto mt-24 max-w-[92rem] px-5 sm:mt-32 sm:px-8">
          <div className="bg-tinta px-6 py-12 sm:px-12 sm:py-16">
            <h2 className="font-cartaz text-2xl uppercase tracking-tight text-white sm:text-3xl">
              Como comprar
            </h2>

            <ol className="mt-10 grid gap-10 sm:grid-cols-3">
              {passos.map((b) => (
                <li key={b.id} className="border-t border-white/25 pt-5">
                  {b.rotulo ? (
                    <p className="font-mono text-[11px] tracking-widest text-royal-claro">
                      {b.rotulo}
                    </p>
                  ) : null}
                  <p className="mt-3 font-cartaz text-xl uppercase tracking-tight text-white">
                    {b.titulo}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{b.texto}</p>
                </li>
              ))}
            </ol>

            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-12 inline-flex h-12 items-center gap-2 bg-white px-6 font-mono text-[11px] uppercase tracking-widest text-tinta transition-colors hover:bg-royal hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-claro focus-visible:ring-offset-2 focus-visible:ring-offset-tinta"
              >
                <IconeWhatsApp className="h-4 w-4" />
                Chamar no WhatsApp
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="mx-auto mt-20 max-w-[92rem] px-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-6">
          <p className="font-cartaz text-base tracking-[0.28em] text-tinta">{loja}</p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-fumaca">
            {cfg?.rodape_texto ?? "Catálogo online"}
          </p>
        </div>
      </footer>
    </div>
  )
}

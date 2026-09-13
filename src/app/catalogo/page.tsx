import Image from "next/image"
import Link from "next/link"

import { Bone } from "@/lib/bone"
import { IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { Bloco, VariacaoCatalogo } from "@/lib/supabase/types"
import { agruparPorModelo, capaDoModelo } from "@/lib/variacoes"

import { paraVariacaoLoja } from "./tipos"
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
  // Variações (modelo + cor + tamanho) e as fotos de cada cor. O visitante lê
  // uma view e uma tabela com grant por coluna: sabe se tem, nunca quanto tem.
  const [variacoesRes, fotosRes, cfgRes, blocosRes] = await Promise.all([
    supabase.from("catalogo_variacoes").select("*").order("modelo"),
    supabase.from("modelo_fotos").select("modelo_id, cor, url, ordem").order("ordem"),
    supabase
      .from("loja_config")
      .select(
        "nome_loja, whatsapp_publico, hero_eyebrow, hero_titulo, hero_destaque, hero_texto, rodape_texto, pedido_minimo_pecas",
      )
      .eq("id", true)
      .maybeSingle(),
    supabase.from("catalogo_blocos").select("*").eq("ativo", true).order("ordem"),
  ])

  const variacoes = paraVariacaoLoja((variacoesRes.data ?? []) as VariacaoCatalogo[])
  const fotos = fotosRes.data ?? []
  const grupos = agruparPorModelo(variacoes, fotos)
  const categorias = [...new Set(variacoes.map((v) => v.categoria))].filter(
    (c) => c !== "Sem categoria",
  )
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

  // O desfile do topo mostra um produto por vez, na foto de capa — de preferência
  // de uma cor que ainda tem peça.
  const desfile = grupos.slice(0, 8).map((g) => ({
    id: g.modeloId,
    ...capaDoModelo(g, (v) => v.disponivel),
  }))

  return (
    <div className="malha min-h-dvh bg-onix pb-36">
      <header className="mx-auto flex max-w-[92rem] items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          {/* A logo é a marca; o nome ao lado existe para quem lê em leitor de
              tela e para quando a imagem não carrega. */}
          <Image
            src="/simbolo-tarcio.png"
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-lg"
          />
          <p className="font-cartaz text-xl tracking-[0.06em] text-creme">{loja}</p>
        </div>
        <Link
          href="/login"
          className="font-etiqueta text-[11px] uppercase tracking-widest text-fumaca transition-colors hover:text-ouro"
        >
          Área da loja
        </Link>
      </header>

      {/* ---------------------------------------------------------------- hero */}
      <section className="mx-auto max-w-[92rem] px-5 pt-6 sm:px-8 sm:pt-12">
        {cfg?.hero_eyebrow ? (
          <p className="pousa font-etiqueta text-[11px] uppercase tracking-[0.22em] text-fumaca">
            {cfg.hero_eyebrow}
          </p>
        ) : null}

        {/* Caixa alta e tracking negativo eram da condensada. Serifada de
            contraste alto pede caixa mista e espaçamento neutro — é assim que
            "Tarcio" aparece na própria logo. */}
        <h1 className="clip-aba mt-5 font-cartaz text-[clamp(2.4rem,7.5vw,5.6rem)] leading-[1.04] tracking-[-0.01em] text-creme">
          <span className="block overflow-hidden">
            <span className="block">
              {antes}
              {depois !== null ? <span className="text-ouro">{destaque}</span> : null}
              {depois}
            </span>
          </span>
        </h1>

        <div className="mt-8 flex flex-col gap-7 sm:mt-10 lg:flex-row lg:items-end lg:justify-between">
          {cfg?.hero_texto ? (
            <p className="pousa max-w-md text-[15px] leading-relaxed text-cinza sm:text-base">
              {cfg.hero_texto}
            </p>
          ) : (
            <span />
          )}

          <div className="pousa flex flex-wrap gap-3">
            <a
              href="#colecao"
              className="botao-varre flex h-12 items-center border border-linha px-6 font-etiqueta text-[11px] uppercase tracking-widest text-creme transition-colors hover:text-onix focus-visible:text-onix focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro focus-visible:ring-offset-2 focus-visible:ring-offset-onix"
            >
              Ver a coleção
            </a>
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center gap-2 bg-ouro px-6 font-etiqueta text-[11px] uppercase tracking-widest text-onix transition-colors hover:bg-ouro-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro focus-visible:ring-offset-2 focus-visible:ring-offset-onix"
              >
                <IconeWhatsApp className="h-4 w-4" />
                Falar com a loja
              </a>
            ) : null}
          </div>
        </div>

        {desfile.length > 0 ? (
          <div className="relative mt-12 sm:mt-16">
            <div className="overflow-hidden">
              <div className="desfila flex w-max items-end gap-8 pr-8 sm:gap-12 sm:pr-12">
                {[...desfile, ...desfile].map((item, i) => (
                  <div key={`${item.id}-${i}`} className="w-32 shrink-0 sm:w-44">
                    {item.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.url}
                        alt=""
                        className="aspect-[4/5] w-full object-cover"
                      />
                    ) : (
                      <Bone cor={item.cor} className="h-auto w-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="risca-aba h-[3px] w-full bg-ouro" />
          </div>
        ) : (
          <div className="risca-aba mt-12 h-[3px] w-full bg-ouro sm:mt-16" />
        )}
      </section>

      {/* -------------------------------------------------------- diferenciais */}
      {diferenciais.length > 0 ? (
        <section className="mx-auto mt-20 max-w-[92rem] px-5 sm:mt-28 sm:px-8">
          <div className="flex items-baseline justify-between gap-4 border-b border-linha pb-3">
            <h2 className="font-cartaz text-2xl uppercase tracking-tight text-creme sm:text-3xl">
              Por que comprar aqui
            </h2>
          </div>

          <ul className="grid gap-x-8 gap-y-10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {diferenciais.map((b) => (
              <li key={b.id}>
                {b.rotulo ? (
                  <p className="font-etiqueta text-[11px] uppercase tracking-widest text-ouro">
                    {b.rotulo}
                  </p>
                ) : null}
                <p className="mt-3 font-cartaz text-xl uppercase leading-tight tracking-tight text-creme">
                  {b.titulo}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-cinza">{b.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ coleção */}
      <section id="colecao" className="mx-auto mt-24 max-w-[92rem] px-5 sm:mt-32 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-linha pb-3">
          <h2 className="font-cartaz text-2xl uppercase tracking-tight text-creme sm:text-3xl">
            A coleção
          </h2>
          <p className="font-etiqueta text-[11px] uppercase tracking-widest text-fumaca">
            {grupos.length} {grupos.length === 1 ? "produto" : "produtos"}
            {minimo > 0 ? ` · pedido mínimo ${minimo} peças` : ""}
          </p>
        </div>

        <Vitrine
          variacoes={variacoes}
          fotos={fotos}
          categorias={categorias}
          whatsapp={whatsapp}
          loja={loja}
          minimo={minimo}
        />
      </section>

      {/* ------------------------------------------------------ como comprar */}
      {passos.length > 0 ? (
        <section className="mx-auto mt-24 max-w-[92rem] px-5 sm:mt-32 sm:px-8">
          <div className="border border-linha bg-carvao px-6 py-12 sm:px-12 sm:py-16">
            <h2 className="font-cartaz text-2xl uppercase tracking-tight text-white sm:text-3xl">
              Como comprar
            </h2>

            <ol className="mt-10 grid gap-10 sm:grid-cols-3">
              {passos.map((b) => (
                <li key={b.id} className="border-t border-white/25 pt-5">
                  {b.rotulo ? (
                    <p className="font-etiqueta text-[11px] tracking-widest text-ouro-claro">
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
                className="mt-12 inline-flex h-12 items-center gap-2 bg-ouro px-6 font-etiqueta text-[11px] uppercase tracking-widest text-onix transition-colors hover:bg-ouro-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-claro focus-visible:ring-offset-2 focus-visible:ring-offset-carvao"
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
          <p className="font-cartaz text-base tracking-[0.28em] text-creme">{loja}</p>
          <p className="font-etiqueta text-[11px] uppercase tracking-widest text-fumaca">
            {cfg?.rodape_texto ?? "Catálogo online"}
          </p>
        </div>
      </footer>
    </div>
  )
}

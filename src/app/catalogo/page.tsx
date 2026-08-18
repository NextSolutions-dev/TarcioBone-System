import Link from "next/link"

import { Bone } from "@/lib/bone"
import { IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { ItemCatalogo } from "@/lib/supabase/types"

import { Vitrine } from "./vitrine"

export const metadata = {
  title: "Aba Reta — bonés",
  description:
    "Seis gomos, entretela firme e pesponto reforçado na aba. Escolha os seus e feche o pedido no WhatsApp.",
}

export const revalidate = 30

/** O argumento de qualidade dito em linguagem de construção, não em adjetivo:
 *  é assim que quem entende de boné julga uma peça. */
const CONSTRUCAO = [
  {
    codigo: "6 GOMOS",
    titulo: "Copa em seis painéis",
    texto: "Costurada painel a painel — o formato sobrevive à lavagem.",
  },
  {
    codigo: "ENTRETELA",
    titulo: "Frente que fica em pé",
    texto: "Entretela firme por dentro: a frente não murcha com o uso.",
  },
  {
    codigo: "PESPONTO",
    titulo: "Costura dupla na aba",
    texto: "Acompanha toda a borda. É o que impede a aba de entortar.",
  },
  {
    codigo: "ILHOSES",
    titulo: "Ventilação reforçada",
    texto: "Furo costurado com linha, não colado. Não descola.",
  },
]

const PASSOS = [
  {
    titulo: "Monte o pedido",
    texto: "Escolha modelos e cores aqui na página. A sacola vai somando.",
  },
  {
    titulo: "Mande no WhatsApp",
    texto: "O pedido chega escrito, com cada item e o total — sem retrabalho.",
  },
  {
    titulo: "Combine na conversa",
    texto: "Pagamento, entrega e prazo a gente acerta ali mesmo.",
  },
]

export default async function PaginaCatalogo() {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from("catalogo_publico")
    .select("*")
    .order("categoria")
    .order("modelo")

  const itens = (data ?? []) as ItemCatalogo[]
  const categorias = [...new Set(itens.map((i) => i.categoria ?? "Sem categoria"))]

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP ?? ""
  const loja = process.env.NEXT_PUBLIC_LOJA_NOME ?? "Aba Reta"

  // A fila que desfila sob a linha do hero — duplicada para o laço não ter emenda.
  const desfile = itens.slice(0, 8)

  return (
    <div className="malha min-h-dvh bg-concreto pb-36">
      {/* ---------------------------------------------------------------- topo */}
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
        <p className="pousa font-mono text-[11px] uppercase tracking-[0.22em] text-fumaca">
          Aba reta · Aba curva · Trucker · Dad hat
        </p>

        {/* O título sobe de trás da linha da aba — a aba esconde e revela. */}
        <h1 className="clip-aba mt-5 font-cartaz text-[clamp(3.1rem,12.5vw,9.5rem)] uppercase leading-[0.86] tracking-[-0.02em] text-tinta">
          <span className="overflow-hidden">
            <span className="block">Aba que</span>
          </span>
          <span className="mt-1 block overflow-hidden">
            <span className="block">
              continua <span className="text-royal">reta</span>.
            </span>
          </span>
        </h1>

        <div className="mt-8 flex flex-col gap-7 sm:mt-10 lg:flex-row lg:items-end lg:justify-between">
          <p className="pousa max-w-md text-[15px] leading-relaxed text-grafite sm:text-base">
            Seis gomos, entretela firme, ilhoses costurados e pesponto reforçado na
            borda. O boné sai da caixa em pé — e continua assim depois da lavagem.
          </p>

          <div className="pousa flex flex-wrap gap-3">
            <a
              href="#colecao"
              className="botao-varre flex h-12 items-center border border-tinta px-6 font-mono text-[11px] uppercase tracking-widest text-tinta transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 focus-visible:ring-offset-concreto"
            >
              Ver a coleção
            </a>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center gap-2 bg-tinta px-6 font-mono text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 focus-visible:ring-offset-concreto"
            >
              <IconeWhatsApp className="h-4 w-4" />
              Falar com a loja
            </a>
          </div>
        </div>

        {/* ------------------------------------------------ A LINHA DA ABA */}
        <div className="relative mt-12 sm:mt-16">
          {/* a fila apoiada na linha — por isso a régua vem DEPOIS dos bonés */}
          <div className="overflow-hidden">
            <div className="desfila flex w-max items-end gap-8 pr-8 sm:gap-12 sm:pr-12">
              {[...desfile, ...desfile].map((item, i) => (
                <div key={`${item.id}-${i}`} className="w-36 shrink-0 sm:w-48">
                  <Bone cor={item.cor ?? ""} className="h-auto w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="risca-aba h-[3px] w-full bg-tinta" />
        </div>
      </section>

      {/* -------------------------------------------------------- construção */}
      <section className="mx-auto mt-20 max-w-[92rem] px-5 sm:mt-28 sm:px-8">
        <div className="flex items-baseline justify-between gap-4 border-b border-tinta pb-3">
          <h2 className="font-cartaz text-2xl uppercase tracking-tight text-tinta sm:text-3xl">
            Como é feito
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-widest text-fumaca">
            Ficha de construção
          </p>
        </div>

        <ul className="grid gap-x-8 gap-y-10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {CONSTRUCAO.map((item) => (
            <li key={item.codigo}>
              <p className="font-mono text-[11px] uppercase tracking-widest text-royal">
                {item.codigo}
              </p>
              <p className="mt-3 font-cartaz text-xl uppercase leading-tight tracking-tight text-tinta">
                {item.titulo}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-grafite">{item.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ coleção */}
      <section id="colecao" className="mx-auto mt-24 max-w-[92rem] px-5 sm:mt-32 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-tinta pb-3">
          <h2 className="font-cartaz text-2xl uppercase tracking-tight text-tinta sm:text-3xl">
            A coleção
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-widest text-fumaca">
            {itens.length} modelos disponíveis
          </p>
        </div>

        <Vitrine itens={itens} categorias={categorias} whatsapp={whatsapp} loja={loja} />
      </section>

      {/* ------------------------------------------------------ como comprar */}
      <section className="mx-auto mt-24 max-w-[92rem] px-5 sm:mt-32 sm:px-8">
        <div className="bg-tinta px-6 py-12 sm:px-12 sm:py-16">
          <h2 className="font-cartaz text-2xl uppercase tracking-tight text-white sm:text-3xl">
            Como comprar
          </h2>

          {/* Aqui a numeração é honesta: é uma sequência de verdade. */}
          <ol className="mt-10 grid gap-10 sm:grid-cols-3">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} className="border-t border-white/25 pt-5">
                <p className="font-mono text-[11px] tracking-widest text-royal-claro">
                  0{i + 1}
                </p>
                <p className="mt-3 font-cartaz text-xl uppercase tracking-tight text-white">
                  {passo.titulo}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{passo.texto}</p>
              </li>
            ))}
          </ol>

          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-12 inline-flex h-12 items-center gap-2 bg-white px-6 font-mono text-[11px] uppercase tracking-widest text-tinta transition-colors hover:bg-royal hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-claro focus-visible:ring-offset-2 focus-visible:ring-offset-tinta"
          >
            <IconeWhatsApp className="h-4 w-4" />
            Chamar no WhatsApp
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------- rodapé */}
      <footer className="mx-auto mt-20 max-w-[92rem] px-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-6">
          <p className="font-cartaz text-base tracking-[0.28em] text-tinta">{loja}</p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-fumaca">
            Catálogo de demonstração · Next Solutions
          </p>
        </div>
      </footer>
    </div>
  )
}

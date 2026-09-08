import { Jost, Playfair_Display } from "next/font/google"

/** A loja tem voz própria, e ela vem da logo do Tarcio: serifada de contraste
 *  alto para o nome e os títulos, geométrica leve e bem espaçada para etiqueta.
 *  A versão anterior usava Anton (condensada, urbana) — era da marca fictícia e
 *  dizia o oposto de "boné premium".
 *  Escopo nesta rota: o sistema não carrega essas fontes. */
const cartaz = Playfair_Display({
  variable: "--font-cartaz",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
})

const etiqueta = Jost({
  variable: "--font-etiqueta",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
})

export default function LayoutPedido({ children }: LayoutProps<"/pedido">) {
  return (
    <div className={`${cartaz.variable} ${etiqueta.variable} registro-loja bg-onix text-creme`}>
      {children}
    </div>
  )
}

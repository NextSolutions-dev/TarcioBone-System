import { Anton, Space_Mono } from "next/font/google"

/** A loja tem voz própria — Anton para cartaz, Space Mono para ficha técnica.
 *  Escopo nesta rota: o sistema não carrega essas fontes. */
const cartaz = Anton({
  variable: "--font-cartaz",
  subsets: ["latin"],
  weight: "400",
})

const mono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
})

export default function LayoutLoja({ children }: LayoutProps<"/catalogo">) {
  return (
    <div className={`${cartaz.variable} ${mono.variable} bg-concreto text-tinta`}>
      {children}
    </div>
  )
}

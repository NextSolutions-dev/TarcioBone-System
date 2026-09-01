import { Anton, Space_Mono } from "next/font/google"

/** Mesma voz da loja: a página do pedido é a continuação do catálogo, não do
 *  sistema. Fontes escopadas nesta rota, como no catálogo. */
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

export default function LayoutPedido({ children }: LayoutProps<"/pedido">) {
  return (
    <div className={`${cartaz.variable} ${mono.variable} bg-concreto text-tinta`}>
      {children}
    </div>
  )
}

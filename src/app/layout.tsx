import type { Metadata, Viewport } from "next"
import { Archivo, Inter } from "next/font/google"

import "./globals.css"

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
})

const texto = Inter({
  variable: "--font-texto",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Aba Reta",
    template: "%s · Aba Reta",
  },
  description: "Venda, estoque e faturamento da loja em um só lugar.",
  applicationName: "Aba Reta",
  appleWebApp: { capable: true, title: "Aba Reta", statusBarStyle: "black-translucent" },
}

export const viewport: Viewport = {
  themeColor: "#16233d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${texto.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}

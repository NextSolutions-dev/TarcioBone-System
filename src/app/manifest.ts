import type { MetadataRoute } from "next"

/** PWA: os vendedores instalam na tela inicial do celular e abrem como app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aba Reta — Vendas e Estoque",
    short_name: "Aba Reta",
    description: "Registre a venda, acompanhe o estoque e veja o faturamento.",
    start_url: "/vender",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f9",
    theme_color: "#16233d",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

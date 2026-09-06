import type { MetadataRoute } from "next"

/** PWA: os vendedores instalam na tela inicial do celular e abrem como app.
 *  Cores tiradas da logo — o preto da marca no fundo, para o ícone não abrir
 *  numa moldura clara que a marca não tem. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tarcio Bone — Vendas e Estoque",
    short_name: "Tarcio Bone",
    description: "Registre a venda, acompanhe o estoque e veja o faturamento.",
    start_url: "/vender",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

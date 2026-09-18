import type { MetadataRoute } from "next"

/** Nada aqui é para ser achado no Google.
 *
 *  O catálogo é de atacado e, por decisão do cliente (2026-09-17), só deve ser
 *  aberto por quem recebeu o link. O sistema, então, menos ainda.
 *
 *  Isto não é proteção — quem souber o endereço entra do mesmo jeito. É parar de
 *  ser descoberto por quem não foi convidado. A proteção real continua sendo a
 *  RLS no banco (o visitante não enxerga venda, cliente nem saldo) e a senha. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  }
}

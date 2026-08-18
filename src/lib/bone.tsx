/** Boné em perfil, tingido pela cor cadastrada do produto.
 *
 *  Não é ícone: tem gomos costurados, ilhoses e pesponto contrastante na aba —
 *  os detalhes que um comprador de boné procura para julgar qualidade. Enquanto
 *  a loja não sobe as fotos, é isto que sustenta a vitrine; quando subir, troque
 *  por <Image src={foto_url}> e o layout não muda. */

type ParDeTons = { claro: string; escuro: string }

const CORES: Record<string, ParDeTons> = {
  preto: { claro: "#232a33", escuro: "#12161c" },
  branco: { claro: "#f4f5f6", escuro: "#d3d7dc" },
  "off-white": { claro: "#efeae0", escuro: "#d6cdbd" },
  marinho: { claro: "#1e3357", escuro: "#122140" },
  azul: { claro: "#2a68b8", escuro: "#1a4685" },
  vermelho: { claro: "#c23a37", escuro: "#8f2523" },
  verde: { claro: "#426b46", escuro: "#2c4a31" },
  bege: { claro: "#d9c5a3", escuro: "#bda684" },
  jeans: { claro: "#5d81a8", escuro: "#426284" },
  rosa: { claro: "#e5a3b7", escuro: "#c97f97" },
  dourado: { claro: "#d6a94f", escuro: "#a97f28" },
  cinza: { claro: "#8d949e", escuro: "#6b727c" },
}

function tons(cor: string): ParDeTons {
  const primeira = cor.toLowerCase().split("/")[0].trim()
  for (const chave of Object.keys(CORES)) {
    if (primeira.startsWith(chave)) return CORES[chave]
  }
  return { claro: "#4a5361", escuro: "#2f3641" }
}

/** Pesponto tem de aparecer: claro sobre tecido escuro, escuro sobre claro. */
function linhaDeCostura(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lum =
    (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? "rgba(20,26,34,.32)" : "rgba(255,255,255,.45)"
}

export function Bone({ cor, className = "" }: { cor: string; className?: string }) {
  const copa = tons(cor)
  const aba = cor.includes("/") ? tons(cor.split("/")[1]) : copa
  const costuraCopa = linhaDeCostura(copa.claro)
  const costuraAba = linhaDeCostura(aba.claro)

  return (
    <svg
      viewBox="0 0 260 137"
      className={className}
      role="img"
      aria-label={`Boné na cor ${cor}`}
    >
      {/* aba reta — a peça que dá nome à loja */}
      <g>
        <path
          d="M154 104 L242 104 C251 104 254 117 246 120 L158 125 C148 125 146 106 154 104 Z"
          fill={aba.claro}
          stroke="rgba(20,26,34,.22)"
          strokeWidth="1.4"
        />
        {/* sombra da própria aba, para ela não parecer adesivo */}
        <path
          d="M154 104 L242 104 C247 104 250 108 250 111 L156 114 C150 113 149 106 154 104 Z"
          fill={aba.escuro}
          opacity=".28"
        />
        {/* pesponto contrastante acompanhando a borda */}
        <path
          d="M160 110 C196 109 222 108 244 110"
          fill="none"
          stroke={costuraAba}
          strokeWidth="1.6"
          strokeDasharray="4 4.5"
          strokeLinecap="round"
        />
      </g>

      {/* copa de seis gomos */}
      <path
        d="M54 116 C54 66 82 40 122 40 C160 40 178 72 178 116 Z"
        fill={copa.claro}
        stroke="rgba(20,26,34,.22)"
        strokeWidth="1.4"
      />

      {/* volume: o gomo do fundo recebe menos luz */}
      <path
        d="M54 116 C54 66 82 40 122 40 C104 40 92 74 90 116 Z"
        fill={copa.escuro}
        opacity=".38"
      />

      {/* costuras dos gomos */}
      <g fill="none" stroke={costuraCopa} strokeWidth="1.5" strokeLinecap="round">
        <path d="M122 44 C102 68 94 92 93 115" />
        <path d="M122 44 C144 68 152 92 153 115" />
        <path d="M122 44 C122 70 122 94 122 115" opacity=".55" />
      </g>

      {/* ilhoses de ventilação */}
      <g fill={costuraCopa}>
        <circle cx="108" cy="82" r="2.6" />
        <circle cx="138" cy="82" r="2.6" />
      </g>

      {/* botão do topo */}
      <circle cx="122" cy="41" r="6" fill={copa.escuro} />
      <circle cx="122" cy="41" r="6" fill="none" stroke="rgba(20,26,34,.25)" strokeWidth="1.2" />

      {/* faixa da testa */}
      <path
        d="M56 112 L177 112 L178 116 L54 116 Z"
        fill={copa.escuro}
        opacity=".45"
      />

      {/* apoio no chão: a sombra ancora o boné na linha da aba */}
      <ellipse cx="150" cy="130" rx="86" ry="5" fill="rgba(20,26,34,.16)" />
    </svg>
  )
}

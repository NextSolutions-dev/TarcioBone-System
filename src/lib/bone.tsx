/** Ilustração de boné tingida pela cor cadastrada do produto.
 *  Placeholder honesto enquanto a loja não sobe as fotos reais: diferencia os
 *  cards na vitrine e já mostra a cor certa. Trocar por <Image> quando houver
 *  foto_url. */

const CORES: Record<string, [string, string]> = {
  preto: ["#1f2530", "#12161d"],
  branco: ["#f7f8fa", "#dfe3ea"],
  "off-white": ["#f3efe6", "#ddd6c7"],
  marinho: ["#1c3055", "#122040"],
  azul: ["#2563a8", "#17457b"],
  vermelho: ["#b83232", "#8d2224"],
  verde: ["#3f6b43", "#2b4c2f"],
  bege: ["#d8c3a0", "#bda684"],
  jeans: ["#5b7fa6", "#41618380"],
  rosa: ["#e6a2b8", "#cf7f99"],
  dourado: ["#d4a54a", "#b0822c"],
  cinza: ["#8b929c", "#6c737d"],
}

function tons(cor: string): [string, string] {
  const primeira = cor.toLowerCase().split("/")[0].trim()
  for (const chave of Object.keys(CORES)) {
    if (primeira.startsWith(chave)) return CORES[chave]
  }
  return ["#4a5568", "#2d3748"]
}

export function Bone({ cor, className = "" }: { cor: string; className?: string }) {
  const [claro, escuro] = tons(cor)
  const secundaria = cor.includes("/") ? tons(cor.split("/")[1])[0] : claro

  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label={`Boné ${cor}`}>
      {/* Contorno sutil: sem ele, bonés brancos/bege somem no fundo claro. */}
      <g stroke="rgba(22,35,61,.18)" strokeWidth="1.5">
        {/* aba */}
        <path
          d="M22 112c0-9 14-15 36-15h96c14 0 24 5 24 11 0 6-9 10-24 10H40c-11 0-18-2-18-6Z"
          fill={secundaria}
        />
        {/* copa */}
        <path
          d="M42 100c0-34 25-58 58-58s58 24 58 58c0 3-2 5-6 5H48c-4 0-6-2-6-5Z"
          fill={claro}
        />
      </g>
      {/* gomo lateral para dar volume */}
      <path d="M100 42c-20 0-36 24-38 63h-14c-4 0-6-2-6-5 0-34 25-58 58-58Z" fill={escuro} opacity=".45" />
      {/* costura central */}
      <path d="M100 43v62" stroke={escuro} strokeWidth="2" opacity=".35" fill="none" />
      {/* botão do topo */}
      <circle cx="100" cy="44" r="5" fill={escuro} />
    </svg>
  )
}

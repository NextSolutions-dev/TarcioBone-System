/** Ícones SVG inline com `currentColor` — herdam a cor do contexto.
 *  Proibido emoji/glifo com cor própria (regra do design system). */

type Props = { className?: string }

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
}

export function IconePainel({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function IconeVender({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.55L20.5 7H6.2" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </svg>
  )
}

export function IconeProdutos({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9.5 12 5l8 4.5v5L12 19l-8-4.5v-5Z" />
      <path d="M4 9.5 12 14l8-4.5M12 14v5" />
    </svg>
  )
}

export function IconeEstoque({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7h18v13H3z" />
      <path d="M3 7l2-3h14l2 3M9 12h6" />
    </svg>
  )
}

export function IconeVendas({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h5" />
    </svg>
  )
}

export function IconeFaturamento({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15v-3M12.5 15V8M17 15v-5" />
    </svg>
  )
}

export function IconeCatalogo({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z" />
    </svg>
  )
}

export function IconeSair({ className = "h-4 w-4" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M15 17v1.5A1.5 1.5 0 0 1 13.5 20h-7A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M10 12h10m0 0-3-3m3 3-3 3" />
    </svg>
  )
}

export function IconeMais({ className = "h-4 w-4" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconeMenos({ className = "h-4 w-4" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14" />
    </svg>
  )
}

export function IconeBusca({ className = "h-4 w-4" }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export function IconeWhatsApp({ className = "h-5 w-5" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2.5c-5.23 0-9.48 4.25-9.48 9.48 0 1.67.44 3.3 1.27 4.74L2.5 21.5l4.92-1.29a9.44 9.44 0 0 0 4.62 1.18h.01c5.22 0 9.47-4.25 9.47-9.48a9.42 9.42 0 0 0-2.77-6.7 9.42 9.42 0 0 0-6.71-2.71Zm5.53 15.01a7.86 7.86 0 0 1-5.53 2.29h-.01a7.87 7.87 0 0 1-4.01-1.1l-.29-.17-2.92.77.78-2.85-.19-.29a7.85 7.85 0 0 1-1.2-4.18 7.88 7.88 0 0 1 13.45-5.56 7.82 7.82 0 0 1 2.31 5.57 7.87 7.87 0 0 1-2.3 5.52Z" />
    </svg>
  )
}

export function IconeAlerta({ className = "h-4 w-4" }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4.5 21 19H3l9-14.5Z" />
      <path d="M12 10v4M12 16.5v.5" />
    </svg>
  )
}

export function IconeCarrinhoVazio({ className = "h-10 w-10" }: Props) {
  return (
    <svg {...base} strokeWidth={1.25} className={className}>
      <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.55L20.5 7H6.2" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </svg>
  )
}

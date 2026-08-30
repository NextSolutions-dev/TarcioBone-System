/** Utilitários compartilhados. Dinheiro sempre em centavos (int), nunca float —
 *  e data de calendário separada de momento (ver next-dev-integridade §4). */

/** 8990 -> "R$ 89,90" */
export function dinheiro(centavos: number | null | undefined): string {
  return ((centavos ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

/** 8990 -> "89,90" (sem símbolo, para tabelas densas) */
export function numero(centavos: number | null | undefined): string {
  return ((centavos ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** "89,90" ou "89.90" -> 8990. Devolve null se não der para ler. */
export function paraCentavos(entrada: string): number | null {
  const limpo = entrada.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  if (!limpo) return null
  const valor = Number(limpo)
  if (!Number.isFinite(valor) || valor < 0) return null
  return Math.round(valor * 100)
}

/** Data de calendário: lê o dia como está escrito, ignora fuso.
 *  Usar para prazo/vencimento/filtro — NUNCA `new Date("2026-08-18")`. */
export function parseDataCalendario(dataStr: string): Date {
  const [ano, mes, dia] = dataStr.split("T")[0].split("-").map(Number)
  return new Date(ano, mes - 1, dia)
}

/** Momento (criada_em): a conversão para o fuso do usuário é o desejado. */
export function momento(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

/** "2026-08-18" de hoje, no fuso de São Paulo (mesmo fuso que o relatório usa). */
export function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
}

export function diasAtrasISO(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
}

export const ROTULO_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
}

/** Junta classes ignorando falsy — sem dependência externa. */
export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ")
}

// ---------------------------------------------------------------------------
// Telefone — guardado só em dígitos com DDI, porque é isso que o link do
// WhatsApp consome. Máscara é assunto de exibição, nunca de armazenamento.
// ---------------------------------------------------------------------------

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "")
}

/** Normaliza o que o usuário digitou para o formato do WhatsApp (DDI + DDD + número).
 *  Devolve null quando não dá para confiar — melhor não montar link do que montar errado. */
export function telefoneParaArmazenar(entrada: string): string | null {
  const d = apenasDigitos(entrada)
  if (!d) return null
  // 10 (fixo) ou 11 (celular) dígitos: veio sem DDI, assume Brasil.
  if (d.length === 10 || d.length === 11) return `55${d}`
  if (d.length >= 12 && d.length <= 15) return d
  return null
}

/** 5581999990000 -> "(81) 99999-0000" */
export function formatarTelefone(digitos: string | null | undefined): string {
  if (!digitos) return "—"
  const semDdi = digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos
  if (semDdi.length === 11) {
    return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`
  }
  if (semDdi.length === 10) {
    return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`
  }
  return digitos
}

/** Monta o link de conversa. Sem telefone não há link — quem chama trata o null. */
export function linkWhatsApp(telefone: string | null | undefined, texto?: string): string | null {
  if (!telefone) return null
  const base = `https://wa.me/${telefone}`
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base
}

/** Sanitiza o termo ANTES de montar filtro do PostgREST.
 *  No `.or()` do supabase-js a vírgula e os parênteses são estruturais: deixar o
 *  input do usuário passar cru permite injetar condição no filtro
 *  (next-dev-seguranca §3b). A RLS limita as linhas; isto fecha o filtro. */
export function termoBuscaSeguro(entrada: string): string {
  return entrada
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

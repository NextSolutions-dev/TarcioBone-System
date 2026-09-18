"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import { nomeVariacao } from "@/lib/variacoes"

export type ItemParaAtendimento = {
  id: string
  rotulo: string
  produto_id: string | null
  quantidade: number
  disponivel: number
  preco_centavos: number
}

export type VendaParaAtendimento = {
  numero: number
  cliente_nome: string | null
  criada_em: string
  subtotal_centavos: number
  desconto_centavos: number
  frete_centavos: number
  bruto_ja_reembolsado_centavos: number
  quantidade_ja_reembolsada: number
  quantidade_vendida: number
  itens: ItemParaAtendimento[]
}

type ResultadoBusca = { erro?: string; venda?: VendaParaAtendimento }
export type EstadoAtendimento = { erro?: string; ok?: string }

async function donoAutenticado() {
  const perfil = await perfilAtual()
  return perfil?.papel === "dono"
}

export async function buscarVendaParaAtendimento(numeroBruto: string): Promise<ResultadoBusca> {
  if (!(await donoAutenticado())) return { erro: "Apenas o dono pode consultar devoluções." }
  const numero = z.coerce.number().int().positive().safeParse(numeroBruto)
  if (!numero.success) return { erro: "Informe o número da venda." }

  const supabase = await criarClienteServidor()
  const { data: venda, error } = await supabase
    .from("vendas")
    .select("id, numero, cliente_nome, criada_em, subtotal_centavos, desconto_centavos, frete_centavos")
    .eq("numero", numero.data)
    .maybeSingle()
  if (error) return { erro: error.message }
  if (!venda) return { erro: "Venda não encontrada." }

  const [itensRes, trocasRes, atendimentosRes] = await Promise.all([
    supabase.from("venda_itens")
      .select("id, produto_id, descricao, quantidade, preco_unitario_centavos, produtos(modelo, cor, tamanho)")
      .eq("venda_id", venda.id),
    supabase.from("trocas").select("venda_item_id, quantidade").eq("venda_id", venda.id),
    supabase.from("atendimentos_pos_venda")
      .select("venda_item_id, quantidade, tipo").eq("venda_id", venda.id),
  ])
  if (itensRes.error || trocasRes.error || atendimentosRes.error) {
    return { erro: itensRes.error?.message ?? trocasRes.error?.message ??
      atendimentosRes.error?.message ?? "Não foi possível carregar a venda." }
  }

  const usados = new Map<string, number>()
  for (const atendimento of [...(trocasRes.data ?? []), ...(atendimentosRes.data ?? [])]) {
    usados.set(atendimento.venda_item_id,
      (usados.get(atendimento.venda_item_id) ?? 0) + atendimento.quantidade)
  }
  const itens: ItemParaAtendimento[] = (itensRes.data ?? []).map((item) => {
    const produto = item.produtos as unknown as
      { modelo: string; cor: string; tamanho: string } | null
    return {
      id: item.id,
      produto_id: item.produto_id,
      rotulo: produto ? nomeVariacao(produto) : item.descricao ?? "Item avulso",
      quantidade: item.quantidade,
      disponivel: Math.max(0, item.quantidade - (usados.get(item.id) ?? 0)),
      preco_centavos: item.preco_unitario_centavos,
    }
  })
  const precoPorItem = new Map(
    (itensRes.data ?? []).map((item) => [item.id, item.preco_unitario_centavos]),
  )
  const reembolsos = (atendimentosRes.data ?? []).filter(
    (atendimento) => atendimento.tipo === "reembolso",
  )
  return { venda: {
    numero: venda.numero,
    cliente_nome: venda.cliente_nome,
    criada_em: venda.criada_em,
    subtotal_centavos: venda.subtotal_centavos,
    desconto_centavos: venda.desconto_centavos,
    frete_centavos: venda.frete_centavos,
    bruto_ja_reembolsado_centavos: reembolsos.reduce(
      (soma, atendimento) =>
        soma + atendimento.quantidade * (precoPorItem.get(atendimento.venda_item_id) ?? 0), 0,
    ),
    quantidade_ja_reembolsada: reembolsos.reduce(
      (soma, atendimento) => soma + atendimento.quantidade, 0,
    ),
    quantidade_vendida: (itensRes.data ?? []).reduce(
      (soma, item) => soma + item.quantidade, 0,
    ),
    itens,
  } }
}

const DadosAtendimento = z.object({
  venda_item_id: z.string().uuid("Escolha um item vendido."),
  tipo: z.enum(["troca", "reembolso"]),
  quantidade: z.coerce.number().int().positive("Informe a quantidade."),
  motivo: z.string().trim().min(2, "Informe o motivo.").max(200),
  produto_novo_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  repor_estoque: z.boolean(),
  reembolso_esperado_centavos: z.coerce.number().int().nonnegative().optional(),
  idempotency_key: z.string().uuid(),
})

export async function registrarAtendimento(
  _anterior: EstadoAtendimento,
  form: FormData,
): Promise<EstadoAtendimento> {
  if (!(await donoAutenticado())) {
    return { erro: "Apenas o dono pode realizar troca ou reembolso." }
  }
  const analise = DadosAtendimento.safeParse({
    venda_item_id: form.get("venda_item_id"),
    tipo: form.get("tipo"),
    quantidade: form.get("quantidade"),
    motivo: form.get("motivo"),
    produto_novo_id: form.get("produto_novo_id") ?? "",
    repor_estoque: form.get("repor_estoque") === "on",
    reembolso_esperado_centavos: form.get("reembolso_esperado_centavos") || undefined,
    idempotency_key: form.get("idempotency_key"),
  })
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }
  const dados = analise.data
  if (dados.tipo === "troca" && !dados.produto_novo_id) {
    return { erro: "Escolha a peça que o cliente levará." }
  }
  if (dados.tipo === "reembolso" && dados.reembolso_esperado_centavos === undefined) {
    return { erro: "Consulte o valor do reembolso antes de confirmar." }
  }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc("registrar_atendimento_pos_venda", {
    _venda_item_id: dados.venda_item_id,
    _tipo: dados.tipo,
    _quantidade: dados.quantidade,
    _motivo: dados.motivo,
    _produto_novo_id: dados.tipo === "troca" ? dados.produto_novo_id : null,
    _repor_estoque: dados.repor_estoque,
    _idempotency_key: dados.idempotency_key,
    _reembolso_esperado_centavos: dados.tipo === "reembolso"
      ? dados.reembolso_esperado_centavos : null,
  })
  if (error) return { erro: error.message }

  for (const rota of ["/estoque", "/vendas", "/produtos", "/painel", "/faturamento", "/catalogo"]) {
    revalidatePath(rota)
  }
  return { ok: dados.tipo === "reembolso" ? "Reembolso registrado." : "Troca registrada." }
}

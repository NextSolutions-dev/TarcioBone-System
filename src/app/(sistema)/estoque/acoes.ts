"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"

const Entrada = z.object({
  produto_id: z.string().uuid("Produto inválido."),
  quantidade: z.coerce
    .number()
    .int("Use um número inteiro.")
    .refine((n) => n !== 0, "Informe uma quantidade diferente de zero."),
  motivo: z.string().trim().max(120).optional(),
})

export type EstadoEntrada = { erro?: string; ok?: string }

export async function darEntrada(
  _anterior: EstadoEntrada,
  form: FormData,
): Promise<EstadoEntrada> {
  // Defesa em camadas: o banco já barra (RPC checa eh_dono), mas a ação
  // reconfere antes de agir.
  const perfil = await perfilAtual()
  if (!perfil || perfil.papel !== "dono") {
    return { erro: "Apenas o dono pode movimentar o estoque." }
  }

  const analise = Entrada.safeParse({
    produto_id: form.get("produto_id"),
    quantidade: form.get("quantidade"),
    motivo: form.get("motivo"),
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc("registrar_entrada_estoque", {
    _produto_id: analise.data.produto_id,
    _quantidade: analise.data.quantidade,
    _motivo: analise.data.motivo || "Entrada de mercadoria",
  })

  if (error) return { erro: error.message }

  revalidatePath("/estoque")
  revalidatePath("/painel")

  const verbo = analise.data.quantidade > 0 ? "adicionada(s)" : "retirada(s)"
  return { ok: `${Math.abs(analise.data.quantidade)} peça(s) ${verbo}.` }
}

/** Troca manual: uma peça volta ao estoque e outra sai no lugar. O motivo é
 *  opcional porque o essencial — o que entrou e o que saiu — já vai escrito no
 *  histórico pelo próprio banco. */
const TrocaEstoque = z.object({
  produto_entra_id: z.string().uuid("Escolha a peça que volta."),
  quantidade_entra: z.coerce.number().int().positive("Quantidade da peça que volta."),
  produto_sai_id: z.string().uuid("Escolha a peça que sai."),
  quantidade_sai: z.coerce.number().int().positive("Quantidade da peça que sai."),
  motivo: z.string().trim().max(120).optional(),
  idempotency_key: z.string().uuid(),
})

export type EstadoTrocaEstoque = { erro?: string; ok?: string }

export async function registrarTrocaEstoque(
  _anterior: EstadoTrocaEstoque,
  form: FormData,
): Promise<EstadoTrocaEstoque> {
  const perfil = await perfilAtual()
  if (!perfil || perfil.papel !== "dono") {
    return { erro: "Apenas o dono pode registrar troca no estoque." }
  }

  const analise = TrocaEstoque.safeParse({
    produto_entra_id: form.get("produto_entra_id"),
    quantidade_entra: form.get("quantidade_entra"),
    produto_sai_id: form.get("produto_sai_id"),
    quantidade_sai: form.get("quantidade_sai"),
    motivo: form.get("motivo") || undefined,
    idempotency_key: form.get("idempotency_key"),
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const d = analise.data
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc("registrar_troca_estoque", {
    _produto_entra_id: d.produto_entra_id,
    _quantidade_entra: d.quantidade_entra,
    _produto_sai_id: d.produto_sai_id,
    _quantidade_sai: d.quantidade_sai,
    _motivo: d.motivo || null,
    _idempotency_key: d.idempotency_key,
  })

  if (error) return { erro: error.message }

  revalidatePath("/estoque")
  revalidatePath("/produtos")
  revalidatePath("/painel")
  revalidatePath("/catalogo")

  return { ok: "Troca registrada: o saldo das duas peças já foi ajustado." }
}

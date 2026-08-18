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

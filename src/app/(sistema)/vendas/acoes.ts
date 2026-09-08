"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"

/** Peça nova é opcional: dá para só registrar a devolução, sem levar outra
 *  na hora. Mas se vier produto, tem de vir quantidade — e vice-versa. */
const Troca = z
  .object({
    venda_item_id: z.string().uuid("Item inválido."),
    quantidade: z.coerce.number().int().positive("Informe quantas peças voltaram."),
    motivo: z
      .string()
      .trim()
      .min(3, "Descreva o motivo da troca.")
      .max(280, "Motivo muito longo."),
    volta_ao_estoque: z.coerce.boolean(),
    produto_novo_id: z.string().uuid().nullish(),
    quantidade_nova: z.coerce.number().int().positive().nullish(),
    idempotency_key: z.string().uuid(),
  })
  .refine((d) => !d.produto_novo_id || !!d.quantidade_nova, {
    message: "Informe a quantidade da peça nova.",
  })

export type EstadoTroca = { erro?: string; ok?: string }

export async function registrarTroca(
  _anterior: EstadoTroca,
  form: FormData,
): Promise<EstadoTroca> {
  // Defesa em camadas: a RPC já checa `eh_dono`, mas a ação reconfere antes
  // de gastar uma ida ao banco.
  const perfil = await perfilAtual()
  if (!perfil || perfil.papel !== "dono") {
    return { erro: "Apenas o dono pode registrar troca." }
  }

  const produtoNovo = (form.get("produto_novo_id") as string) || null

  const analise = Troca.safeParse({
    venda_item_id: form.get("venda_item_id"),
    quantidade: form.get("quantidade"),
    motivo: form.get("motivo"),
    // Checkbox ausente no FormData significa desmarcado.
    volta_ao_estoque: form.get("volta_ao_estoque") !== null,
    produto_novo_id: produtoNovo,
    quantidade_nova: produtoNovo ? form.get("quantidade_nova") : null,
    idempotency_key: form.get("idempotency_key"),
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const d = analise.data
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc("registrar_troca", {
    _venda_item_id: d.venda_item_id,
    _quantidade: d.quantidade,
    _motivo: d.motivo,
    _volta_ao_estoque: d.volta_ao_estoque,
    _produto_novo_id: d.produto_novo_id ?? null,
    _quantidade_nova: d.produto_novo_id ? (d.quantidade_nova ?? null) : null,
    _idempotency_key: d.idempotency_key,
  })

  if (error) return { erro: error.message }

  // A troca mexe em saldo, então tudo que mostra estoque precisa recarregar.
  revalidatePath("/vendas")
  revalidatePath("/estoque")
  revalidatePath("/produtos")
  revalidatePath("/painel")

  return { ok: `Troca de ${d.quantidade} peça(s) registrada.` }
}

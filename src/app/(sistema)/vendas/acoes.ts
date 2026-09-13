"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"

/** A troca da venda é só REGISTRO: qual peça, quantas e por quê. Quem move o
 *  estoque é o dono, na tela Estoque — decisão de 2026-09-13, depois que o
 *  padrão automático devolveu bonés com defeito ao saldo vendável. */
const Troca = z.object({
  venda_item_id: z.string().uuid("Item inválido."),
  quantidade: z.coerce.number().int().positive("Informe quantas peças voltaram."),
  motivo: z
    .string()
    .trim()
    .min(3, "Descreva o motivo da troca.")
    .max(280, "Motivo muito longo."),
  idempotency_key: z.string().uuid(),
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

  const analise = Troca.safeParse({
    venda_item_id: form.get("venda_item_id"),
    quantidade: form.get("quantidade"),
    motivo: form.get("motivo"),
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
    _idempotency_key: d.idempotency_key,
  })

  if (error) return { erro: error.message }

  // Só a lista de vendas muda: o registro não toca em estoque.
  revalidatePath("/vendas")

  return {
    ok: `Troca de ${d.quantidade} peça(s) registrada. Ajuste o estoque na tela Estoque.`,
  }
}

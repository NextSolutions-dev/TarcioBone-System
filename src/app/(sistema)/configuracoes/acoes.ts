"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import { telefoneParaArmazenar } from "@/lib/utils"

const Entrada = z.object({
  nome_loja: z.string().trim().min(2, "Informe o nome da loja.").max(60),
  whatsapp: z.string().trim().optional(),
  // Só chega marcado quando o dono confirmou que a mensagem de teste chegou.
  confirmou_teste: z.string().optional(),
})

export type EstadoConfig = { erro?: string; ok?: string }

export async function salvarConfig(
  _anterior: EstadoConfig,
  form: FormData,
): Promise<EstadoConfig> {
  // Defesa em camadas: a RLS já barra, mas a ação reconfere antes de agir.
  const perfil = await perfilAtual()
  if (!perfil || perfil.papel !== "dono") {
    return { erro: "Apenas o dono pode alterar a configuração da loja." }
  }

  const analise = Entrada.safeParse({
    nome_loja: form.get("nome_loja"),
    whatsapp: form.get("whatsapp"),
    confirmou_teste: form.get("confirmou_teste") ?? undefined,
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const bruto = analise.data.whatsapp?.trim() ?? ""
  let numero: string | null = null

  if (bruto) {
    numero = telefoneParaArmazenar(bruto)
    if (!numero) {
      return { erro: "Número inválido. Use DDD + número, como (81) 90000-0000." }
    }
  }

  const confirmou = analise.data.confirmou_teste === "on"

  // A regra que protege o cliente final: número só entra no catálogo depois
  // que o dono mandou a mensagem de teste e confirmou que chegou.
  const ativo = Boolean(numero) && confirmou

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from("loja_config")
    .update({
      nome_loja: analise.data.nome_loja,
      whatsapp: numero,
      whatsapp_ativo: ativo,
      whatsapp_testado_em: ativo ? new Date().toISOString() : null,
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil.id,
    })
    .eq("id", true)

  if (error) return { erro: error.message }

  revalidatePath("/configuracoes")
  revalidatePath("/catalogo")

  if (!numero) {
    return { ok: "Configuração salva. Sem número, o catálogo não mostra WhatsApp." }
  }
  if (!ativo) {
    return {
      ok: "Número guardado, mas ainda NÃO aparece no catálogo — falta confirmar o teste.",
    }
  }
  return { ok: "Pronto. O catálogo já está usando este número." }
}

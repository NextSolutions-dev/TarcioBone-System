"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import { telefoneParaArmazenar } from "@/lib/utils"

const Entrada = z.object({
  nome: z.string().trim().min(2, "Informe o nome do cliente.").max(80),
  telefone: z.string().trim().optional(),
  cidade: z.string().trim().max(60).optional(),
  observacao: z.string().trim().max(280).optional(),
})

export type EstadoCliente = { erro?: string; ok?: string }

export async function cadastrarCliente(
  _anterior: EstadoCliente,
  form: FormData,
): Promise<EstadoCliente> {
  // Vendedor cadastra cliente no balcão — não é tela só de dono. Mas perfil
  // inativo não grava nada.
  const perfil = await perfilAtual()
  if (!perfil) return { erro: "Sessão expirada. Entre de novo." }

  const analise = Entrada.safeParse({
    nome: form.get("nome"),
    telefone: form.get("telefone"),
    cidade: form.get("cidade"),
    observacao: form.get("observacao"),
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const bruto = analise.data.telefone?.trim() ?? ""
  let telefone: string | null = null

  if (bruto) {
    telefone = telefoneParaArmazenar(bruto)
    if (!telefone) {
      return { erro: "Telefone inválido. Use DDD + número, como (81) 90000-0000." }
    }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from("clientes").insert({
    nome: analise.data.nome,
    telefone,
    cidade: analise.data.cidade || null,
    observacao: analise.data.observacao || null,
    criado_por: perfil.id,
  })

  if (error) return { erro: error.message }

  revalidatePath("/clientes")
  revalidatePath("/vender")

  return { ok: `${analise.data.nome} cadastrado.` }
}

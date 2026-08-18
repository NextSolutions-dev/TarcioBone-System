"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import { paraCentavos } from "@/lib/utils"

const Novo = z.object({
  sku: z.string().trim().min(2, "Informe o código.").max(24).toUpperCase(),
  modelo: z.string().trim().min(2, "Informe o modelo."),
  cor: z.string().trim().min(2, "Informe a cor."),
  categoria_id: z.string().uuid().optional().or(z.literal("")),
  preco: z.string().trim().min(1, "Informe o preço."),
  estoque_minimo: z.coerce.number().int().min(0).default(3),
  descricao: z.string().trim().max(280).optional(),
  no_catalogo: z.string().optional(),
})

export type EstadoProduto = { erro?: string; ok?: string }

async function exigirDono() {
  const perfil = await perfilAtual()
  if (!perfil || perfil.papel !== "dono") return null
  return perfil
}

export async function criarProduto(
  _anterior: EstadoProduto,
  form: FormData,
): Promise<EstadoProduto> {
  if (!(await exigirDono())) {
    return { erro: "Apenas o dono pode cadastrar produtos." }
  }

  const analise = Novo.safeParse({
    sku: form.get("sku"),
    modelo: form.get("modelo"),
    cor: form.get("cor"),
    categoria_id: form.get("categoria_id"),
    preco: form.get("preco"),
    estoque_minimo: form.get("estoque_minimo") || 3,
    descricao: form.get("descricao"),
    no_catalogo: form.get("no_catalogo") ?? undefined,
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const centavos = paraCentavos(analise.data.preco)
  if (centavos === null) return { erro: "Preço inválido. Use o formato 89,90." }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from("produtos").insert({
    sku: analise.data.sku,
    modelo: analise.data.modelo,
    cor: analise.data.cor,
    categoria_id: analise.data.categoria_id || null,
    preco_centavos: centavos,
    estoque_minimo: analise.data.estoque_minimo,
    descricao: analise.data.descricao || null,
    no_catalogo: analise.data.no_catalogo === "on",
  })

  if (error) {
    if (error.code === "23505") return { erro: "Já existe um produto com esse código." }
    return { erro: error.message }
  }

  revalidatePath("/produtos")
  revalidatePath("/estoque")
  revalidatePath("/catalogo")

  return { ok: `${analise.data.modelo} cadastrado. Dê entrada no estoque para vender.` }
}

/** Liga/desliga a vitrine do site sem mexer no sistema. */
export async function alternarCatalogo(form: FormData) {
  if (!(await exigirDono())) return

  const id = String(form.get("id") ?? "")
  const atual = String(form.get("atual") ?? "") === "true"
  if (!id) return

  const supabase = await criarClienteServidor()
  await supabase.from("produtos").update({ no_catalogo: !atual }).eq("id", id)

  revalidatePath("/produtos")
  revalidatePath("/catalogo")
}

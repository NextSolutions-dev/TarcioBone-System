"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"

async function exigirDono() {
  const perfil = await perfilAtual()
  return perfil?.papel === "dono" ? perfil : null
}

function revalidar() {
  revalidatePath("/configuracoes")
  revalidatePath("/catalogo")
}

export type EstadoCatalogo = { erro?: string; ok?: string }

// ---------------------------------------------------------------- textos do topo

const Textos = z.object({
  hero_eyebrow: z.string().trim().max(80).optional(),
  hero_titulo: z.string().trim().min(3, "O título não pode ficar vazio.").max(120),
  hero_destaque: z.string().trim().max(60).optional(),
  hero_texto: z.string().trim().max(400).optional(),
  rodape_texto: z.string().trim().max(200).optional(),
  pedido_minimo_pecas: z.coerce.number().int().min(0).max(9999).default(0),
})

export async function salvarTextos(
  _anterior: EstadoCatalogo,
  form: FormData,
): Promise<EstadoCatalogo> {
  const perfil = await exigirDono()
  if (!perfil) return { erro: "Apenas o dono pode editar o catálogo." }

  const analise = Textos.safeParse({
    hero_eyebrow: form.get("hero_eyebrow"),
    hero_titulo: form.get("hero_titulo"),
    hero_destaque: form.get("hero_destaque"),
    hero_texto: form.get("hero_texto"),
    rodape_texto: form.get("rodape_texto"),
    pedido_minimo_pecas: form.get("pedido_minimo_pecas") || 0,
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const d = analise.data
  const destaque = d.hero_destaque?.trim() || null

  // O destaque é pintado dentro do título. Se não existir lá, a cor não aparece
  // e o dono fica sem entender por quê — melhor avisar do que falhar calado.
  if (destaque && !d.hero_titulo.includes(destaque)) {
    return {
      erro: `O trecho em destaque ("${destaque}") precisa aparecer exatamente dentro do título.`,
    }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from("loja_config")
    .update({
      hero_eyebrow: d.hero_eyebrow || null,
      hero_titulo: d.hero_titulo,
      hero_destaque: destaque,
      hero_texto: d.hero_texto || null,
      rodape_texto: d.rodape_texto || null,
      pedido_minimo_pecas: d.pedido_minimo_pecas,
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil.id,
    })
    .eq("id", true)

  if (error) return { erro: error.message }

  revalidar()
  return { ok: "Textos do catálogo atualizados." }
}

// --------------------------------------------------------------------- blocos

const Bloco = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  tipo: z.enum(["diferencial", "passo"]),
  rotulo: z.string().trim().max(40).optional(),
  titulo: z.string().trim().min(2, "Informe o título do bloco.").max(80),
  texto: z.string().trim().min(2, "Informe o texto do bloco.").max(300),
  ordem: z.coerce.number().int().min(0).max(99).default(0),
})

export async function salvarBloco(
  _anterior: EstadoCatalogo,
  form: FormData,
): Promise<EstadoCatalogo> {
  const perfil = await exigirDono()
  if (!perfil) return { erro: "Apenas o dono pode editar o catálogo." }

  const analise = Bloco.safeParse({
    id: form.get("id") ?? "",
    tipo: form.get("tipo"),
    rotulo: form.get("rotulo"),
    titulo: form.get("titulo"),
    texto: form.get("texto"),
    ordem: form.get("ordem") || 0,
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const d = analise.data
  const supabase = await criarClienteServidor()

  const campos = {
    tipo: d.tipo,
    rotulo: d.rotulo || null,
    titulo: d.titulo,
    texto: d.texto,
    ordem: d.ordem,
  }

  const { error } = d.id
    ? await supabase.from("catalogo_blocos").update(campos).eq("id", d.id)
    : await supabase.from("catalogo_blocos").insert(campos)

  if (error) return { erro: error.message }

  revalidar()
  return { ok: d.id ? "Bloco atualizado." : "Bloco adicionado." }
}

export async function alternarBloco(form: FormData) {
  if (!(await exigirDono())) return

  const id = String(form.get("id") ?? "")
  const atual = String(form.get("atual") ?? "") === "true"
  if (!id) return

  const supabase = await criarClienteServidor()
  await supabase.from("catalogo_blocos").update({ ativo: !atual }).eq("id", id)

  revalidar()
}

export async function removerBloco(form: FormData) {
  if (!(await exigirDono())) return

  const id = String(form.get("id") ?? "")
  if (!id) return

  const supabase = await criarClienteServidor()
  await supabase.from("catalogo_blocos").delete().eq("id", id)

  revalidar()
}

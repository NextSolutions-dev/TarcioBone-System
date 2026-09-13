"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import { paraCentavos } from "@/lib/utils"

export type EstadoProduto = { erro?: string; ok?: string }

async function exigirDono() {
  const perfil = await perfilAtual()
  if (!perfil || perfil.papel !== "dono") return null
  return perfil
}

/** Uma linha do formulário: uma cor e os tamanhos dela, separados por vírgula.
 *  "P, M, G" vira três variações; vazio vira tamanho único. */
const LinhaCor = z.object({
  cor: z.string().trim().min(1, "Toda linha precisa de uma cor.").max(40),
  tamanhos: z.string().trim().max(200),
})

function expandirVariacoes(linhas: z.infer<typeof LinhaCor>[]) {
  const vistas = new Set<string>()
  const variacoes: { cor: string; tamanho: string }[] = []

  for (const linha of linhas) {
    const tamanhos = linha.tamanhos
      .split(/[,;/]/)
      .map((t) => t.trim())
      .filter(Boolean)

    for (const tamanho of tamanhos.length ? tamanhos : ["Único"]) {
      // Repetição no próprio formulário: o banco já ignoraria, mas contar
      // variação que não existe faria a mensagem de sucesso mentir.
      const chave = `${linha.cor.toLowerCase()}|${tamanho.toLowerCase()}`
      if (vistas.has(chave)) continue
      vistas.add(chave)
      variacoes.push({ cor: linha.cor, tamanho: tamanho.slice(0, 20) })
    }
  }
  return variacoes
}

function lerLinhas(form: FormData) {
  let bruto: unknown = null
  try {
    bruto = JSON.parse(String(form.get("variacoes") ?? "[]"))
  } catch {
    // cai no safeParse abaixo com null, que devolve a mensagem de erro
  }
  return z.array(LinhaCor).min(1, "Informe pelo menos uma cor.").safeParse(bruto)
}

function lerPreco(bruto: FormDataEntryValue | null, obrigatorio: boolean) {
  const texto = String(bruto ?? "").trim()
  if (!texto) return obrigatorio ? { erro: true as const } : { valor: null }
  const valor = paraCentavos(texto)
  return valor === null ? { erro: true as const } : { valor }
}

const Modelo = z.object({
  nome: z.string().trim().min(2, "Informe o nome do produto.").max(80),
  categoria_id: z.string().uuid().optional().or(z.literal("")),
  descricao: z.string().trim().max(400).optional(),
  estoque_minimo: z.coerce.number().int().min(0).max(9999).default(3),
  idempotency_key: z.string().uuid(),
})

/** Produto novo com todas as cores e tamanhos de uma vez. O modelo e as
 *  variações nascem na mesma transação (`criar_modelo`): não existe produto
 *  vazio esperando a cor chegar numa segunda tela. */
export async function criarModelo(
  _anterior: EstadoProduto,
  form: FormData,
): Promise<EstadoProduto> {
  if (!(await exigirDono())) {
    return { erro: "Apenas o dono pode cadastrar produtos." }
  }

  const dados = Modelo.safeParse({
    nome: form.get("nome"),
    categoria_id: form.get("categoria_id") ?? "",
    descricao: form.get("descricao") || undefined,
    estoque_minimo: form.get("estoque_minimo") || 3,
    idempotency_key: form.get("idempotency_key"),
  })
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Confira os dados." }
  }

  const linhas = lerLinhas(form)
  if (!linhas.success) {
    return { erro: linhas.error.issues[0]?.message ?? "Informe as cores e os tamanhos." }
  }

  const varejo = lerPreco(form.get("preco"), true)
  if ("erro" in varejo) return { erro: "Preço de varejo inválido. Use o formato 89,90." }

  const atacado = lerPreco(form.get("preco_atacado"), false)
  if ("erro" in atacado) return { erro: "Preço de atacado inválido. Use o formato 69,90." }

  const variacoes = expandirVariacoes(linhas.data)
  const cores = new Set(variacoes.map((v) => v.cor.toLowerCase())).size

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc("criar_modelo", {
    _nome: dados.data.nome,
    _preco_centavos: varejo.valor ?? 0,
    _variacoes: variacoes,
    _preco_atacado_centavos: atacado.valor ?? undefined,
    _descricao: dados.data.descricao || undefined,
    _categoria_id: dados.data.categoria_id || undefined,
    _estoque_minimo: dados.data.estoque_minimo,
    _idempotency_key: dados.data.idempotency_key,
  })

  if (error) return { erro: error.message }

  revalidarTelas()

  return {
    ok:
      `${dados.data.nome}: ${cores} ${cores === 1 ? "cor" : "cores"} e ` +
      `${variacoes.length} ${variacoes.length === 1 ? "variação" : "variações"}. ` +
      (atacado.valor === null
        ? "Sem preço de atacado, não vai aparecer no catálogo."
        : "Envie as fotos de cada cor e dê entrada no estoque para vender."),
  }
}

/** Chegou cor ou tamanho novo de um produto que já existe. Os preços são
 *  herdados das variações que ele já tem. Repetir a mesma variação é inofensivo:
 *  o banco a ignora, então duplo clique não duplica nada. */
export async function adicionarVariacoes(
  _anterior: EstadoProduto,
  form: FormData,
): Promise<EstadoProduto> {
  if (!(await exigirDono())) {
    return { erro: "Apenas o dono pode cadastrar produtos." }
  }

  const modeloId = z.string().uuid().safeParse(form.get("modelo_id"))
  if (!modeloId.success) return { erro: "Produto inválido." }

  const linha = LinhaCor.safeParse({
    cor: form.get("cor"),
    tamanhos: form.get("tamanhos") ?? "",
  })
  if (!linha.success) {
    return { erro: linha.error.issues[0]?.message ?? "Informe a cor." }
  }

  const variacoes = expandirVariacoes([linha.data])

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc("adicionar_variacoes", {
    _modelo_id: modeloId.data,
    _variacoes: variacoes,
  })

  if (error) return { erro: error.message }

  revalidarTelas()

  const criadas = data ?? 0
  if (criadas === 0) {
    return { ok: "Essas variações já existiam — nada novo foi criado." }
  }
  return {
    ok: `${criadas} ${criadas === 1 ? "variação criada" : "variações criadas"} em ${linha.data.cor}.`,
  }
}

/** Liga/desliga o produto inteiro no site, com todas as cores e tamanhos. */
export async function alternarCatalogo(form: FormData) {
  if (!(await exigirDono())) return

  const id = z.string().uuid().safeParse(form.get("modelo_id"))
  const atual = String(form.get("atual") ?? "") === "true"
  if (!id.success) return

  const supabase = await criarClienteServidor()
  await supabase.from("modelos").update({ no_catalogo: !atual }).eq("id", id.data)

  revalidatePath("/produtos")
  revalidatePath("/catalogo")
}

function revalidarTelas() {
  revalidatePath("/produtos")
  revalidatePath("/estoque")
  revalidatePath("/vender")
  revalidatePath("/catalogo")
}

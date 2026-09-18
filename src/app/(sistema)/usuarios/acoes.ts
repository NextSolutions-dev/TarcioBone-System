"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { chaveAdminConfigurada, criarClienteAdmin } from "@/lib/supabase/admin"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"

export type EstadoUsuario = { erro?: string; ok?: string }

/** Decisão do cliente (2026-09-18): a loja tem no máximo 3 donos. O banco
 *  também garante isso (migração 18) — aqui é só para a mensagem ser humana
 *  antes de a conta de login chegar a existir. */
const MAX_DONOS = 3

const SEM_CHAVE =
  "Falta a chave de administrador no ambiente (SUPABASE_SECRET_KEY). Sem ela o " +
  "sistema não consegue criar nem apagar conta de login."

async function exigirDono() {
  const perfil = await perfilAtual()
  if (!perfil || perfil.papel !== "dono") return null
  return perfil
}

const NovoUsuario = z.object({
  nome: z.string().trim().min(2, "Informe o nome de quem vai usar.").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  // 72 é o teto do bcrypt; abaixo de 8 não vale chamar de senha.
  senha: z
    .string()
    .min(8, "A senha precisa de pelo menos 8 caracteres.")
    .max(72, "Senha longa demais."),
  papel: z.enum(["dono", "vendedor"], { message: "Escolha o cargo." }),
})

async function contarDonosAtivos() {
  const supabase = await criarClienteServidor()
  const { count } = await supabase
    .from("perfis")
    .select("id", { count: "exact", head: true })
    .eq("papel", "dono")
    .eq("ativo", true)
  return count ?? 0
}

/** Conta de login + perfil. São dois passos em sistemas diferentes: se o
 *  segundo falhar, o primeiro é desfeito — conta órfã no Auth vira gente
 *  entrando sem aparecer em lugar nenhum. */
export async function criarUsuario(
  _anterior: EstadoUsuario,
  form: FormData,
): Promise<EstadoUsuario> {
  if (!(await exigirDono())) return { erro: "Apenas o dono pode criar acessos." }
  if (!chaveAdminConfigurada()) return { erro: SEM_CHAVE }

  const dados = NovoUsuario.safeParse({
    nome: form.get("nome"),
    email: form.get("email"),
    senha: form.get("senha"),
    papel: form.get("papel"),
  })
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Confira os dados." }
  }

  if (dados.data.papel === "dono" && (await contarDonosAtivos()) >= MAX_DONOS) {
    return {
      erro: `A loja já tem ${MAX_DONOS} donos ativos. Desative ou remova um antes de criar outro.`,
    }
  }

  const admin = criarClienteAdmin()
  const criada = await admin.auth.admin.createUser({
    email: dados.data.email,
    password: dados.data.senha,
    // A loja não tem envio de e-mail configurado: a conta já nasce liberada,
    // e quem entrega a senha é o dono, pessoalmente.
    email_confirm: true,
  })

  if (criada.error || !criada.data.user) {
    const mensagem = criada.error?.message ?? ""
    return {
      erro: /already|registered|exists/i.test(mensagem)
        ? "Já existe uma conta com esse e-mail."
        : `Não foi possível criar a conta: ${mensagem}`,
    }
  }

  const supabase = await criarClienteServidor()
  const perfil = await supabase.from("perfis").insert({
    id: criada.data.user.id,
    nome: dados.data.nome,
    papel: dados.data.papel,
    ativo: true,
  })

  if (perfil.error) {
    await admin.auth.admin.deleteUser(criada.data.user.id)
    return { erro: `A conta não foi criada: ${perfil.error.message}` }
  }

  revalidatePath("/usuarios")
  return {
    ok: `${dados.data.nome} já pode entrar com ${dados.data.email}. Passe a senha pessoalmente.`,
  }
}

const Alvo = z.object({ id: z.string().uuid("Usuário inválido.") })

/** Desativar é o caminho de quem já tem movimento: o acesso fecha na hora
 *  (o layout do sistema barra perfil inativo) e o histórico continua com
 *  autor. */
export async function alternarAtivo(
  _anterior: EstadoUsuario,
  form: FormData,
): Promise<EstadoUsuario> {
  const dono = await exigirDono()
  if (!dono) return { erro: "Apenas o dono pode mexer nos acessos." }

  const alvo = Alvo.safeParse({ id: form.get("id") })
  if (!alvo.success) return { erro: "Usuário inválido." }
  if (alvo.data.id === dono.id) {
    return { erro: "Você não pode desativar o seu próprio acesso." }
  }

  const supabase = await criarClienteServidor()
  const { data: perfil, error: erroBusca } = await supabase
    .from("perfis")
    .select("nome, papel, ativo")
    .eq("id", alvo.data.id)
    .maybeSingle()

  if (erroBusca || !perfil) return { erro: "Usuário não encontrado." }

  const ativando = !perfil.ativo
  if (ativando && perfil.papel === "dono" && (await contarDonosAtivos()) >= MAX_DONOS) {
    return {
      erro: `A loja já tem ${MAX_DONOS} donos ativos. Desative um antes de reativar este.`,
    }
  }

  const { error } = await supabase
    .from("perfis")
    .update({ ativo: ativando })
    .eq("id", alvo.data.id)

  if (error) return { erro: error.message }

  revalidatePath("/usuarios")
  return {
    ok: ativando
      ? `${perfil.nome} voltou a ter acesso.`
      : `${perfil.nome} não entra mais no sistema.`,
  }
}

const NovaSenha = z.object({
  id: z.string().uuid("Usuário inválido."),
  senha: z
    .string()
    .min(8, "A senha precisa de pelo menos 8 caracteres.")
    .max(72, "Senha longa demais."),
})

/** A loja não tem envio de e-mail configurado, então não existe "esqueci minha
 *  senha": quem redefine é o dono, aqui. Sem isso, senha esquecida viraria
 *  acesso perdido para sempre. */
export async function redefinirSenha(
  _anterior: EstadoUsuario,
  form: FormData,
): Promise<EstadoUsuario> {
  if (!(await exigirDono())) return { erro: "Apenas o dono pode trocar senhas." }
  if (!chaveAdminConfigurada()) return { erro: SEM_CHAVE }

  const dados = NovaSenha.safeParse({ id: form.get("id"), senha: form.get("senha") })
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Confira os dados." }
  }

  const supabase = await criarClienteServidor()
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome")
    .eq("id", dados.data.id)
    .maybeSingle()

  if (!perfil) return { erro: "Usuário não encontrado." }

  const admin = criarClienteAdmin()
  const { error } = await admin.auth.admin.updateUserById(dados.data.id, {
    password: dados.data.senha,
  })
  if (error) return { erro: `Não foi possível trocar a senha: ${error.message}` }

  revalidatePath("/usuarios")
  return { ok: `Senha de ${perfil.nome} trocada. Passe a nova pessoalmente.` }
}

/** Remover de vez: some do Auth e da tabela. Só vale para quem nunca mexeu em
 *  nada — apagar quem já vendeu deixaria o faturamento sem autor, e o banco
 *  barra por chave estrangeira antes de qualquer tela. */
export async function removerUsuario(
  _anterior: EstadoUsuario,
  form: FormData,
): Promise<EstadoUsuario> {
  const dono = await exigirDono()
  if (!dono) return { erro: "Apenas o dono pode mexer nos acessos." }
  if (!chaveAdminConfigurada()) return { erro: SEM_CHAVE }

  const alvo = Alvo.safeParse({ id: form.get("id") })
  if (!alvo.success) return { erro: "Usuário inválido." }
  if (alvo.data.id === dono.id) {
    return { erro: "Você não pode remover o seu próprio acesso." }
  }

  const supabase = await criarClienteServidor()
  const { data: perfil, error: erroBusca } = await supabase
    .from("perfis")
    .select("nome, papel, ativo")
    .eq("id", alvo.data.id)
    .maybeSingle()

  if (erroBusca || !perfil) return { erro: "Usuário não encontrado." }

  if (perfil.papel === "dono" && perfil.ativo && (await contarDonosAtivos()) <= 1) {
    return { erro: "A loja precisa de pelo menos um dono ativo." }
  }

  const { data: temMovimento, error: erroMovimento } = await supabase.rpc(
    "perfil_tem_movimento",
    { _id: alvo.data.id },
  )
  if (erroMovimento) return { erro: erroMovimento.message }

  if (temMovimento) {
    return {
      erro:
        `${perfil.nome} já tem movimento registrado (venda, estoque ou cadastro). ` +
        "Apagar tiraria o autor do histórico — use Desativar, que fecha o acesso na mesma hora.",
    }
  }

  // O perfil cai junto: `perfis.id` referencia `auth.users` com ON DELETE CASCADE.
  const admin = criarClienteAdmin()
  const { error } = await admin.auth.admin.deleteUser(alvo.data.id)
  if (error) return { erro: `Não foi possível remover: ${error.message}` }

  revalidatePath("/usuarios")
  return { ok: `${perfil.nome} foi removido do sistema.` }
}

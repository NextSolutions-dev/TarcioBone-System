import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "./types"

/** Cliente do lado do servidor — carrega a sessão do usuário pelos cookies.
 *  É ele quem grava em nome de quem está logado (autoria correta na base). */
export async function criarClienteServidor() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Chamado de um Server Component: o proxy já renova a sessão.
          }
        },
      },
    },
  )
}

/** Perfil do usuário logado (nome + papel). Null se não houver sessão válida. */
export async function perfilAtual() {
  const resultado = await situacaoDoAcesso()
  return resultado.perfil
}

/** Entrar no Auth e ter acesso ao sistema são coisas diferentes: o cadastro
 *  nasce no Auth, mas quem dá o papel é a tabela `perfis`. Separar os dois
 *  casos é o que permite explicar "você entrou, mas ainda não tem acesso" em
 *  vez de devolver a pessoa ao login sem dizer nada. */
export async function situacaoDoAcesso() {
  const supabase = await criarClienteServidor()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { motivo: "sem-sessao" as const, perfil: null }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, papel, ativo")
    .eq("id", user.id)
    .maybeSingle()

  if (!perfil) return { motivo: "sem-cargo" as const, perfil: null }
  if (!perfil.ativo) return { motivo: "inativo" as const, perfil: null }

  return {
    motivo: "ok" as const,
    perfil: { ...perfil, email: user.email ?? "" },
  }
}

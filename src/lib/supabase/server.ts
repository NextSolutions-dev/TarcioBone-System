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
  const supabase = await criarClienteServidor()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, papel, ativo")
    .eq("id", user.id)
    .maybeSingle()

  if (!perfil || !perfil.ativo) return null

  return { ...perfil, email: user.email ?? "" }
}

import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "./types"

/** Cliente com a chave secreta — ela **ignora a RLS**, então mora só aqui.
 *  `server-only` no topo faz o build quebrar se alguém importar este arquivo
 *  de um componente de cliente.
 *
 *  Uso único: o que o Auth exige de administrador — criar e apagar conta de
 *  login. Gravar nas tabelas continua sendo trabalho da SESSÃO do dono
 *  (`criarClienteServidor`), senão a autoria some do histórico. */
export function chaveAdminConfigurada() {
  return Boolean(process.env.SUPABASE_SECRET_KEY)
}

export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY
  if (!chave) {
    throw new Error("SUPABASE_SECRET_KEY não configurada no ambiente.")
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    // Este cliente não é de ninguém: não guarda nem renova sessão.
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

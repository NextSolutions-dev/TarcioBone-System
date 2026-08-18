"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "./types"

/** Cliente do navegador — só para telas com interação real (registrar venda).
 *  Nunca recebe chave secreta: a RLS é quem limita o que ele enxerga. */
export function criarClienteNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { criarClienteServidor } from "@/lib/supabase/server"
import { caminhoInterno } from "@/lib/utils"

const Entrada = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
  proxima: z.string().max(500).optional(),
})

export type EstadoLogin = { erro?: string }

export async function entrar(
  _anterior: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const analise = Entrada.safeParse({
    email: form.get("email"),
    senha: form.get("senha"),
    proxima: form.get("proxima"),
  })

  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Confira os dados." }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: analise.data.email,
    password: analise.data.senha,
  })

  // Mensagem sempre genérica: não confirma se o e-mail existe (anti-enumeração).
  if (error) {
    return { erro: "Credenciais inválidas." }
  }

  // O destino vem da URL, então é escolhido por quem montou o link. Só página
  // deste site passa — ver `caminhoInterno` para o porquê.
  redirect(caminhoInterno(analise.data.proxima, "/painel"))
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect("/login")
}

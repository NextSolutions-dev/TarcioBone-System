import { redirect } from "next/navigation"

import { Cartao, Selo } from "@/lib/componentes"
import { chaveAdminConfigurada, criarClienteAdmin } from "@/lib/supabase/admin"
import { criarClienteServidor, perfilAtual } from "@/lib/supabase/server"
import type { Perfil } from "@/lib/supabase/types"
import { momento } from "@/lib/utils"

import { FormularioUsuario } from "./formulario-usuario"
import { LinhaUsuario } from "./linha-usuario"

export const metadata = { title: "Usuários" }

const MAX_DONOS = 3

export default async function PaginaUsuarios() {
  const eu = await perfilAtual()
  // Tela de dono. A RLS já impede a escrita; isto evita a tela em branco.
  if (eu?.papel !== "dono") redirect("/painel")

  const supabase = await criarClienteServidor()
  const { data } = await supabase.from("perfis").select("*").order("criado_em")
  const perfis = (data ?? []) as Perfil[]

  // O e-mail mora no Auth, não em `perfis` — copiar para cá criaria duas
  // verdades. Sem a chave de administrador a tela abre igual, só sem o e-mail.
  const temChave = chaveAdminConfigurada()
  let emails = new Map<string, string>()
  if (temChave) {
    const { data: contas } = await criarClienteAdmin().auth.admin.listUsers({
      perPage: 200,
    })
    emails = new Map(
      (contas?.users ?? []).map((u) => [u.id, u.email ?? "—"] as const),
    )
  }

  // Quem já vendeu, mexeu no estoque ou cadastrou cliente não pode ser apagado
  // sem levar o autor do histórico junto — a tela só oferece o que é possível.
  const movimentos = await Promise.all(
    perfis.map(async (p) => {
      const { data: tem } = await supabase.rpc("perfil_tem_movimento", { _id: p.id })
      return [p.id, Boolean(tem)] as const
    }),
  )
  const temMovimento = new Map(movimentos)

  const donosAtivos = perfis.filter((p) => p.papel === "dono" && p.ativo).length

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Usuários</h1>

      <div>
        <p className="font-display text-xl font-bold text-texto">Usuários</p>
        <p className="text-sm text-texto-suave">
          Quem entra no sistema e com qual cargo. O vendedor registra vendas; o dono
          vê o faturamento e mexe em produtos, ajustes e acessos.
        </p>
      </div>

      {!temChave ? (
        <p
          role="alert"
          className="rounded-lg border border-alerta/30 bg-alerta-fundo px-3.5 py-2.5 text-sm text-alerta"
        >
          Falta a chave de administrador no ambiente (<code>SUPABASE_SECRET_KEY</code>).
          A lista abaixo funciona, mas criar e remover acesso fica indisponível até ela
          ser cadastrada.
        </p>
      ) : null}

      <FormularioUsuario
        donosAtivos={donosAtivos}
        maxDonos={MAX_DONOS}
        desabilitado={!temChave}
      />

      <Cartao className="divide-y divide-borda-suave/70">
        {perfis.map((p) => (
          <LinhaUsuario
            key={p.id}
            id={p.id}
            nome={p.nome}
            email={emails.get(p.id) ?? null}
            papel={p.papel}
            ativo={p.ativo}
            desde={momento(p.criado_em)}
            souEu={p.id === eu.id}
            temMovimento={temMovimento.get(p.id) ?? true}
            podeRemover={temChave}
          />
        ))}
      </Cartao>

      <p className="text-xs text-texto-suave">
        <Selo tom="marca">{donosAtivos} de {MAX_DONOS} donos</Selo>{" "}
        A loja aceita no máximo {MAX_DONOS} donos ativos e nunca fica sem nenhum — essa
        regra vale no banco, não só nesta tela.
      </p>
    </div>
  )
}

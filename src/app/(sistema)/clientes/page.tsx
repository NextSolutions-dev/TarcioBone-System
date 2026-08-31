import { Cartao, Titulo, Vazio } from "@/lib/componentes"
import { IconeBusca, IconeWhatsApp } from "@/lib/icones"
import { criarClienteServidor } from "@/lib/supabase/server"
import type { Cliente } from "@/lib/supabase/types"
import { apenasDigitos, formatarTelefone, linkWhatsApp, termoBuscaSeguro } from "@/lib/utils"

import { FormularioCliente } from "./formulario-cliente"

export const metadata = { title: "Clientes" }

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const params = await searchParams
  const bruto = typeof params.busca === "string" ? params.busca : ""

  const supabase = await criarClienteServidor()

  let consulta = supabase
    .from("clientes")
    .select("*")
    .eq("ativo", true)
    .order("nome")
    .limit(200)

  if (bruto.trim()) {
    // Sanitiza ANTES de montar o filtro: no `.or()` do PostgREST a vírgula e os
    // parênteses são estruturais (next-dev-seguranca §3b).
    const termo = termoBuscaSeguro(bruto)
    const digitos = apenasDigitos(bruto)

    if (digitos.length >= 4) {
      consulta = consulta.or(`nome.ilike.%${termo}%,telefone.ilike.%${digitos}%`)
    } else if (termo) {
      consulta = consulta.ilike("nome", `%${termo}%`)
    }
  }

  const { data } = await consulta
  const clientes = (data ?? []) as Cliente[]

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Clientes</h1>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-texto">Clientes</p>
          <p className="text-sm text-texto-suave">
            Quem tem WhatsApp aqui pode receber mensagem depois da venda.
          </p>
        </div>
        <FormularioCliente />
      </div>

      <form className="relative max-w-md">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-suave">
          <IconeBusca />
        </span>
        <input
          type="search"
          name="busca"
          defaultValue={bruto}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar cliente"
          className="h-11 w-full rounded-lg border border-borda-suave bg-campo pl-10 pr-3.5 text-sm text-texto outline-none transition-colors focus:border-acento/60 focus:ring-2 focus:ring-acento/25"
        />
      </form>

      <Cartao>
        <div className="flex items-center justify-between border-b border-borda-suave px-4 py-3">
          <Titulo>{bruto.trim() ? "Resultado da busca" : "Todos os clientes"}</Titulo>
          <span className="numeros text-xs text-texto-suave">
            {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
          </span>
        </div>

        {clientes.length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo={bruto.trim() ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              descricao={
                bruto.trim()
                  ? "Tente outro nome ou número. A busca por telefone precisa de pelo menos 4 dígitos."
                  : "Cadastre o primeiro cliente para poder mandar mensagem depois da venda. Venda de balcão continua funcionando sem cadastro."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-borda-suave/60">
            {clientes.map((c) => {
              const zap = linkWhatsApp(c.telefone)
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto">{c.nome}</p>
                    <p className="truncate text-xs text-texto-suave">
                      <span className="numeros">{formatarTelefone(c.telefone)}</span>
                      {c.cidade ? ` · ${c.cidade}` : ""}
                    </p>
                    {c.observacao ? (
                      <p className="mt-0.5 truncate text-xs text-texto-suave/80">
                        {c.observacao}
                      </p>
                    ) : null}
                  </div>

                  {zap ? (
                    <a
                      href={zap}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Conversar com ${c.nome}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-borda-suave text-ok transition-colors hover:border-ok/40 hover:bg-ok-fundo"
                    >
                      <IconeWhatsApp className="h-5 w-5" />
                      <span className="sr-only">Conversar no WhatsApp</span>
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-texto-suave">sem telefone</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
    </div>
  )
}

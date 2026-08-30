import Link from "next/link"

import { FormularioLogin } from "./formulario"

export const metadata = { title: "Entrar" }

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const proxima = typeof params.proxima === "string" ? params.proxima : undefined

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Lado da marca — some no celular para o formulário ficar acima da dobra */}
      <section className="relative hidden overflow-hidden bg-marca p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-acento-vivo/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-marca-vivo/50 blur-3xl"
        />

        <p className="font-display text-2xl font-extrabold uppercase tracking-[0.2em] text-white">
          Aba Reta
        </p>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-extrabold leading-tight text-white">
            A venda entra pelo celular.
            <br />
            O estoque baixa sozinho.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-marca-texto">
            Seis vendedores registrando ao mesmo tempo, o faturamento sempre calculado
            a partir do que realmente saiu — e o catálogo do site lendo o mesmo estoque.
          </p>
        </div>

        <p className="relative text-xs text-marca-texto/70">
          Demonstração · Next Solutions
        </p>
      </section>

      {/* Lado do formulário */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <p className="font-display text-xl font-extrabold uppercase tracking-[0.2em] text-marca lg:hidden">
            Aba Reta
          </p>

          <h1 className="mt-6 font-display text-2xl font-bold text-texto lg:mt-0">
            Entrar no sistema
          </h1>
          <p className="mt-1.5 text-sm text-texto-suave">
            Use o e-mail e a senha que a loja cadastrou para você.
          </p>

          <div className="mt-8">
            <FormularioLogin proxima={proxima} />
          </div>

          {/* O bloco de credenciais de demonstração saiu daqui em 2026-08-30:
              este passou a ser o sistema de um cliente real. Ele continua na
              cópia da vitrine (`varejoflow-vitrine`), que é onde serve. */}
          <p className="mt-8 text-center text-sm text-texto-suave">
            <Link
              href="/catalogo"
              className="font-medium text-acento underline-offset-4 transition-colors hover:underline"
            >
              Ver o catálogo da loja
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

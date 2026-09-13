import Image from "next/image"
import Link from "next/link"

import { FormularioLogin } from "./formulario"

export const metadata = { title: "Entrar" }

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const proxima = typeof params.proxima === "string" ? params.proxima : undefined
  const acesso = typeof params.acesso === "string" ? params.acesso : undefined

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

        {/* Painel largo: cabe a marca inteira. Repetir o nome ao lado seria
            dizer duas vezes a mesma coisa. */}
        {/* Versão sem fundo: a arte original é dourada sobre preto chapado, e o
            painel é preto com brilho dourado — com fundo, a logo aparecia dentro
            de um retângulo preto recortado no degradê. */}
        <Image
          src="/logo-tarcio-transparente.png"
          alt="Tarcio Boné"
          width={1200}
          height={643}
          priority
          className="relative h-auto w-64"
        />

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
          Sistema por Next Solutions
        </p>
      </section>

      {/* Lado do formulário */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Image
              src="/simbolo-tarcio.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg"
            />
            <p className="font-display text-xl font-extrabold tracking-[0.12em] text-marca">
              Tarcio Boné
            </p>
          </div>

          <h1 className="mt-6 font-display text-2xl font-bold text-texto lg:mt-0">
            Entrar no sistema
          </h1>
          <p className="mt-1.5 text-sm text-texto-suave">
            Use o e-mail e a senha que a loja cadastrou para você.
          </p>

          {acesso ? (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-alerta/30 bg-alerta-fundo px-3.5 py-2.5 text-sm text-alerta"
            >
              {acesso === "inativo"
                ? "Seu acesso existe, mas está desativado. Peça ao dono da loja para reativar."
                : "Sua conta entrou, mas ainda não tem acesso liberado neste sistema. Peça ao dono da loja para liberar o seu usuário."}
            </p>
          ) : null}

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

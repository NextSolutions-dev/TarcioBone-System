import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/** Rotas abertas: o site público do catálogo e o login.
 *  Todo o resto exige sessão — e a permissão real ainda é a RLS no banco. */
const ROTAS_PUBLICAS = ["/login", "/catalogo", "/pedido"]

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          resposta = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Renova a sessão a cada navegação (não remover: sem isto o login expira sozinho).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const caminho = request.nextUrl.pathname
  const ehPublica = ROTAS_PUBLICAS.some(
    (rota) => caminho === rota || caminho.startsWith(`${rota}/`),
  )

  if (!user && !ehPublica) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("proxima", caminho)
    return NextResponse.redirect(url)
  }

  if (user && caminho === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/painel"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return resposta
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icone-.*\\.png|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

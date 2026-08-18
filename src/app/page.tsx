import { redirect } from "next/navigation"

export default function Raiz() {
  // Sem sessão o proxy manda para /login; com sessão, o painel é a porta de entrada.
  redirect("/painel")
}

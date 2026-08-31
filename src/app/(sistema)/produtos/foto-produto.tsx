"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { caminhoDaFoto, prepararFoto } from "@/lib/imagem"
import { criarClienteNavegador } from "@/lib/supabase/client"

export function FotoProduto({
  produtoId,
  fotoUrl,
  nome,
}: {
  produtoId: string
  fotoUrl: string | null
  nome: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => criarClienteNavegador(), [])
  const inputRef = useRef<HTMLInputElement>(null)

  const [url, setUrl] = useState(fotoUrl)
  const [enviando, setEnviando] = useState(false)
  const enviandoRef = useRef(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(arquivo: File) {
    // Trava de envio em voo: escolher arquivo duas vezes rápido não pode virar
    // dois uploads concorrentes gravando caminhos diferentes no mesmo produto.
    if (enviandoRef.current) return
    enviandoRef.current = true
    setEnviando(true)
    setErro(null)

    try {
      const { arquivo: jpeg } = await prepararFoto(arquivo)
      const caminho = caminhoDaFoto(produtoId)

      const { error: erroUpload } = await supabase.storage
        .from("produtos")
        .upload(caminho, jpeg, { contentType: "image/jpeg", upsert: false })

      if (erroUpload) {
        setErro(
          erroUpload.message.includes("row-level security")
            ? "Só o dono pode trocar a foto do produto."
            : erroUpload.message,
        )
        return
      }

      const { data: pub } = supabase.storage.from("produtos").getPublicUrl(caminho)

      const { error: erroBanco } = await supabase
        .from("produtos")
        .update({ foto_url: pub.publicUrl })
        .eq("id", produtoId)

      if (erroBanco) {
        setErro(erroBanco.message)
        return
      }

      setUrl(pub.publicUrl)
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.")
    } finally {
      enviandoRef.current = false
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        title={url ? `Trocar a foto de ${nome}` : `Adicionar foto de ${nome}`}
        className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-borda-suave bg-fundo transition-colors hover:border-acento/50 disabled:cursor-wait"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Foto de ${nome}`} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[10px] font-medium uppercase tracking-wider text-texto-suave">
            {enviando ? "…" : "Foto"}
          </span>
        )}

        {enviando ? (
          <span className="absolute inset-0 grid place-items-center bg-superficie/80 text-[10px] font-medium text-texto">
            Enviando…
          </span>
        ) : null}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void enviar(f)
        }}
      />

      {erro ? (
        <p role="alert" className="max-w-40 text-[11px] leading-tight text-erro">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { IconeMais } from "@/lib/icones"
import { caminhoDaFotoCor, prepararFoto } from "@/lib/imagem"
import { criarClienteNavegador } from "@/lib/supabase/client"

export type FotoGuardada = { id: string; url: string; caminho: string; ordem: number }

/** Fotos de UMA cor de um produto. Trocar a cor no catálogo troca estas fotos —
 *  por isso elas moram na cor, não no produto nem no tamanho. */
export function FotosDaCor({
  modeloId,
  cor,
  fotos,
}: {
  modeloId: string
  cor: string
  fotos: FotoGuardada[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => criarClienteNavegador(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const ocupadoRef = useRef(false)

  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(arquivos: FileList) {
    // Trava em voo: escolher arquivos de novo no meio do envio não pode disparar
    // um segundo lote concorrente gravando ordens repetidas.
    if (ocupadoRef.current) return
    ocupadoRef.current = true
    setErro(null)

    const lista = Array.from(arquivos).slice(0, 8)
    let ordem = fotos.reduce((maior, f) => Math.max(maior, f.ordem), -1) + 1

    try {
      for (const [i, arquivo] of lista.entries()) {
        setEnviando(`Enviando ${i + 1} de ${lista.length}…`)

        const { arquivo: jpeg } = await prepararFoto(arquivo)
        const caminho = caminhoDaFotoCor(modeloId, cor)

        const { error: erroUpload } = await supabase.storage
          .from("produtos")
          .upload(caminho, jpeg, { contentType: "image/jpeg", upsert: false })

        if (erroUpload) {
          setErro(
            erroUpload.message.includes("row-level security")
              ? "Só o dono pode enviar foto de produto."
              : erroUpload.message,
          )
          return
        }

        const { data: pub } = supabase.storage.from("produtos").getPublicUrl(caminho)

        const { error: erroBanco } = await supabase
          .from("modelo_fotos")
          .insert({ modelo_id: modeloId, cor, url: pub.publicUrl, caminho, ordem })

        if (erroBanco) {
          // Não deixa arquivo órfão no armazenamento se a linha não nasceu.
          await supabase.storage.from("produtos").remove([caminho])
          setErro(erroBanco.message)
          return
        }
        ordem += 1
      }
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.")
    } finally {
      ocupadoRef.current = false
      setEnviando(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function excluir(foto: FotoGuardada) {
    if (ocupadoRef.current) return
    ocupadoRef.current = true
    setErro(null)
    setEnviando("Removendo…")

    try {
      const { error } = await supabase.from("modelo_fotos").delete().eq("id", foto.id)
      if (error) {
        setErro(error.message)
        return
      }
      // A linha saiu primeiro: se apagar o arquivo falhar, sobra só um arquivo
      // sem uso — nunca uma foto quebrada aparecendo no catálogo.
      if (foto.caminho) await supabase.storage.from("produtos").remove([foto.caminho])
      router.refresh()
    } finally {
      ocupadoRef.current = false
      setEnviando(null)
    }
  }

  return (
    <div className="space-y-1.5">
      <ul className="flex flex-wrap items-center gap-2">
        {fotos.map((f, i) => (
          <li key={f.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.url}
              alt={`${cor}, foto ${i + 1}`}
              className="h-16 w-16 rounded-lg border border-borda-suave bg-fundo object-cover"
            />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 rounded bg-marca/85 px-1 text-[9px] font-semibold uppercase tracking-wide text-white">
                capa
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void excluir(f)}
              disabled={enviando !== null}
              aria-label={`Remover a foto ${i + 1} de ${cor}`}
              className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-borda-suave bg-superficie text-xs font-bold text-texto-suave shadow-sm transition-colors hover:border-erro/40 hover:text-erro disabled:cursor-wait"
            >
              ×
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando !== null}
            className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-borda text-[10px] font-medium uppercase tracking-wide text-texto-suave transition-colors hover:border-acento/60 hover:text-acento disabled:cursor-wait"
          >
            <IconeMais />
            Foto
          </button>
        </li>
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void enviar(e.target.files)
        }}
      />

      {enviando ? <p className="text-[11px] text-texto-suave">{enviando}</p> : null}
      {erro ? (
        <p role="alert" className="text-[11px] text-erro">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

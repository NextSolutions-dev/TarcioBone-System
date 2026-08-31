/** Preparo de foto de produto antes do upload.
 *
 *  Faz duas coisas que resolvem dois problemas diferentes:
 *
 *  1. **Converte para JPEG.** Foto de iPhone chega em HEIC, sobe e simplesmente
 *     não aparece — foi o que aconteceu no ShalomFlow. O `canvas` decodifica o
 *     que o navegador souber abrir e devolve sempre JPEG.
 *  2. **Reduz o tamanho.** Foto de celular vem com 4000px e 5 MB. No catálogo
 *     ela é exibida com no máximo ~600px de largura, então o resto é banda
 *     jogada fora — e banda é justamente o que estoura o plano free do
 *     Supabase (5 GB/mês de egress).
 */

const LADO_MAXIMO = 1400
const QUALIDADE = 0.82

export type FotoPreparada = { arquivo: Blob; largura: number; altura: number }

export async function prepararFoto(arquivo: File): Promise<FotoPreparada> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.")
  }

  const bitmap = await carregarBitmap(arquivo)

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement("canvas")
  canvas.width = largura
  canvas.height = altura

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Não foi possível processar a imagem neste navegador.")

  // Fundo branco: JPEG não tem transparência, e sem isto PNG transparente
  // vira fundo preto.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(bitmap, 0, 0, largura, altura)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALIDADE),
  )

  if (!blob) throw new Error("Não foi possível converter a imagem.")

  return { arquivo: blob, largura, altura }
}

/** `createImageBitmap` é o caminho rápido; o `<img>` é a rede de segurança para
 *  navegador que não o tenha. */
async function carregarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(arquivo)
    } catch {
      // formato que o decodificador rápido não abriu — cai para o <img>
    }
  }

  const url = URL.createObjectURL(arquivo)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () =>
        reject(
          new Error(
            "Este formato de imagem não abre no navegador. Tente salvar como JPEG ou PNG.",
          ),
        )
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Caminho gerado pelo sistema — nunca o nome original do arquivo, que é
 *  entrada de usuário e pode carregar caminho ou caractere hostil. */
export function caminhoDaFoto(produtoId: string): string {
  return `${produtoId}/${Date.now()}.jpg`
}

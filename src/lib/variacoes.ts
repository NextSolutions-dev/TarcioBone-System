/** Agrupamento de variações: modelo → cor → tamanho.
 *
 *  No banco cada linha de `produtos` é uma VARIAÇÃO (modelo + cor + tamanho) —
 *  é ela que tem saldo e é vendida. Na tela o cliente pensa ao contrário: vê o
 *  produto, escolhe a cor, depois o tamanho. Este arquivo faz essa ponte, e é o
 *  mesmo para o catálogo, a tela de venda e o cadastro — as três telas agrupam
 *  do mesmo jeito, então nunca discordam sobre quais cores um produto tem. */

export type VariacaoBase = {
  id: string
  modelo_id: string
  modelo: string
  cor: string
  tamanho: string
}

export type FotoBase = { modelo_id: string; cor: string; url: string; ordem: number }

export type GrupoCor<V> = {
  cor: string
  chave: string
  fotos: string[]
  variacoes: V[]
}

export type GrupoModelo<V> = {
  modeloId: string
  nome: string
  cores: GrupoCor<V>[]
  variacoes: V[]
}

/** "Preto " e "preto" são a mesma cor — o índice único do banco pensa igual. */
export function chaveCor(cor: string): string {
  return cor.trim().toLowerCase()
}

/** Ordem de etiqueta, não alfabética: P antes de M antes de G. Números em ordem
 *  numérica (36, 38, 40). O que não se encaixa ("Único", "Ajustável") vai para o
 *  fim, em ordem alfabética. */
const ORDEM_LETRAS = ["RN", "PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "G1", "G2", "G3", "G4"]

export function compararTamanhos(a: string, b: string): number {
  const na = Number(a.replace(",", "."))
  const nb = Number(b.replace(",", "."))
  const numA = a.trim() !== "" && !Number.isNaN(na)
  const numB = b.trim() !== "" && !Number.isNaN(nb)
  if (numA && numB) return na - nb

  const ia = ORDEM_LETRAS.indexOf(a.trim().toUpperCase())
  const ib = ORDEM_LETRAS.indexOf(b.trim().toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1 || numA) return -1
  if (ib !== -1 || numB) return 1

  return a.localeCompare(b, "pt-BR")
}

export function agruparPorModelo<V extends VariacaoBase>(
  variacoes: V[],
  fotos: FotoBase[] = [],
): GrupoModelo<V>[] {
  const fotosPorCor = new Map<string, FotoBase[]>()
  for (const f of fotos) {
    const k = `${f.modelo_id}|${chaveCor(f.cor)}`
    fotosPorCor.set(k, [...(fotosPorCor.get(k) ?? []), f])
  }

  const modelos = new Map<string, GrupoModelo<V>>()

  for (const v of variacoes) {
    let modelo = modelos.get(v.modelo_id)
    if (!modelo) {
      modelo = { modeloId: v.modelo_id, nome: v.modelo, cores: [], variacoes: [] }
      modelos.set(v.modelo_id, modelo)
    }
    modelo.variacoes.push(v)

    const chave = chaveCor(v.cor)
    let grupo = modelo.cores.find((c) => c.chave === chave)
    if (!grupo) {
      const lista = (fotosPorCor.get(`${v.modelo_id}|${chave}`) ?? [])
        .slice()
        .sort((x, y) => x.ordem - y.ordem)
      grupo = { cor: v.cor.trim(), chave, fotos: lista.map((f) => f.url), variacoes: [] }
      modelo.cores.push(grupo)
    }
    grupo.variacoes.push(v)
  }

  for (const modelo of modelos.values()) {
    for (const cor of modelo.cores) {
      cor.variacoes.sort((a, b) => compararTamanhos(a.tamanho, b.tamanho))
    }
  }

  return [...modelos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

/** Rótulo único de uma variação, para lista, recibo e mensagem. O tamanho só
 *  aparece quando diz algo: "Boné · Preto" em vez de "Boné · Preto · Único". */
export function nomeVariacao(v: { modelo: string; cor: string; tamanho?: string | null }): string {
  const tamanho = v.tamanho?.trim()
  const partes = [v.modelo, v.cor]
  if (tamanho && tamanho.toLowerCase() !== "único" && tamanho.toLowerCase() !== "unico") {
    partes.push(tamanho)
  }
  return partes.join(" · ")
}

/** Primeira foto disponível do modelo — preferindo uma cor que ainda tem peça. */
export function capaDoModelo<V extends VariacaoBase>(
  modelo: GrupoModelo<V>,
  temPeca: (v: V) => boolean,
): { url: string | null; cor: string } {
  const comFotoEPeca = modelo.cores.find((c) => c.fotos.length > 0 && c.variacoes.some(temPeca))
  const comFoto = modelo.cores.find((c) => c.fotos.length > 0)
  const escolhida = comFotoEPeca ?? comFoto ?? modelo.cores[0]
  return { url: escolhida?.fotos[0] ?? null, cor: escolhida?.cor ?? "" }
}

import { cx } from "./utils"

type Tom = "ok" | "alerta" | "erro" | "neutro" | "marca"

const TONS: Record<Tom, string> = {
  ok: "border-ok/25 bg-ok-fundo text-ok",
  alerta: "border-alerta/25 bg-alerta-fundo text-alerta",
  erro: "border-erro/25 bg-erro-fundo text-erro",
  neutro: "border-borda-suave bg-fundo text-texto-suave",
  marca: "border-marca/20 bg-marca/5 text-marca",
}

/** Status é sempre cor + texto — nunca só cor (acessibilidade). */
export function Selo({
  tom = "neutro",
  children,
  className,
}: {
  tom?: Tom
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Cartao({
  children,
  className,
  escuro = false,
}: {
  children: React.ReactNode
  className?: string
  escuro?: boolean
}) {
  // O fundo é escolhido aqui, nunca sobrescrito por className: duas classes de
  // background na mesma string não têm precedência garantida no Tailwind.
  return (
    <div
      className={cx(
        "rounded-xl border shadow-sm",
        escuro ? "border-marca bg-marca" : "border-borda-suave bg-superficie",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Número grande do painel. */
export function Indicador({
  rotulo,
  valor,
  apoio,
  destaque = false,
}: {
  rotulo: string
  valor: string
  apoio?: string
  destaque?: boolean
}) {
  return (
    <Cartao escuro={destaque} className="p-4">
      <p
        className={cx(
          "text-[11px] font-medium uppercase tracking-wider",
          destaque ? "text-marca-texto" : "text-texto-suave",
        )}
      >
        {rotulo}
      </p>
      <p
        className={cx(
          "numeros mt-1.5 font-display text-2xl font-bold",
          destaque ? "text-white" : "text-texto",
        )}
      >
        {valor}
      </p>
      {apoio ? (
        <p
          className={cx(
            "mt-0.5 text-xs",
            destaque ? "text-marca-texto/80" : "text-texto-suave",
          )}
        >
          {apoio}
        </p>
      ) : null}
    </Cartao>
  )
}

/** Estado vazio desenhado: o que houve + o que fazer. */
export function Vazio({
  titulo,
  descricao,
  icone,
  acao,
}: {
  titulo: string
  descricao: string
  icone?: React.ReactNode
  acao?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-borda px-6 py-12 text-center">
      {icone ? <div className="mb-3 text-texto-suave/60">{icone}</div> : null}
      <p className="font-display text-base font-semibold text-texto">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-texto-suave">{descricao}</p>
      {acao ? <div className="mt-4">{acao}</div> : null}
    </div>
  )
}

export function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg font-bold tracking-tight text-texto">{children}</h2>
  )
}

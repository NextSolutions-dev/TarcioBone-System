/** Remonta a cada navegação — é o que dispara a cascata de entrada. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="cascata">{children}</div>
}

import { Sparkles } from 'lucide-react'

export function Brand() {
  return (
    <div className="brand" aria-label="Lumina">
      <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
      <span className="brand-name">lumina</span>
    </div>
  )
}

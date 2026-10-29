import { useEffect, useState } from 'react'
import { promotions } from '../config/promotions.js'

const EVERY = Number(import.meta.env.VITE_PROMO_SECONDS || 10) * 1000

export default function Promo({ className = '' }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (promotions.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % promotions.length), EVERY)
    return () => clearInterval(t)
  }, [])
  const p = promotions[i]
  if (!p) return null
  return (
    <div className={`flex items-center gap-6 rounded-2xl border border-white/10 bg-white/[.06] px-7 py-4 ${className}`}>
      {p.image && <img src={p.image} alt="" className="h-16 w-28 rounded-lg object-cover" />}
      <div key={i} className="anim-rise min-w-0">
        <p className="font-display text-2xl leading-tight">{p.title}</p>
        <p className="mt-0.5 truncate text-white/65">{p.text}</p>
      </div>
      {promotions.length > 1 && (
        <div className="ml-auto flex gap-1.5" aria-hidden>{promotions.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? 'w-6 bg-sky' : 'w-1.5 bg-white/25'}`} />)}</div>
      )}
    </div>
  )
}

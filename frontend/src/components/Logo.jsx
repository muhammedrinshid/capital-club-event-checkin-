import { useState } from 'react'

/** Club logo. Replace /public/logo.svg (or set VITE_LOGO_URL). Falls back to text if the file is missing. */
export default function Logo({ className = 'h-10' }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <span className="font-display text-2xl">Capital Club Dubai</span>
  return <img src={import.meta.env.VITE_LOGO_URL || '/logo.png'} alt="Capital Club Dubai" onError={() => setBroken(true)} className={`w-auto ${className}`} draggable={false} />
}

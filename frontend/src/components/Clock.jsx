import { useEffect, useState } from 'react'

export default function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t) }, [])
  return (
    <div className="text-right">
      <p className="font-display text-4xl leading-none">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      <p className="mt-1 text-white/60">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </div>
  )
}

/** Poster shown whole (never cropped) inside a framed matte, so any shape of image looks intentional. */
export default function PosterFrame({ event, className = '' }) {
  return (
    <div className={`relative size-full overflow-hidden rounded-3xl bg-deep shadow-[0_30px_80px_-30px_rgba(0,0,0,.7)] ring-1 ring-white/10 ${className}`}>
      {event.poster ? (
        <>
          <img src={event.poster} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-50 blur-2xl" />
          <div className="absolute inset-0 bg-deep/40" />
          <img src={event.poster} alt={event.name} draggable={false} className="relative size-full object-contain p-5" />
        </>
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-navy via-[#12386a] to-sky/50 p-10 text-center">
          <span className="font-display text-5xl leading-tight">{event.name}</span>
        </div>
      )}
    </div>
  )
}

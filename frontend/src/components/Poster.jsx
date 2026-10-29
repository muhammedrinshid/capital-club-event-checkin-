/** Event poster, or a navy fallback carrying the event name when no image was uploaded. */
export default function Poster({ event, className = '', blur = false }) {
  if (event.poster) {
    return <img src={event.poster} alt="" draggable={false} className={`size-full object-cover ${className}`} />
  }
  return (
    <div className={`grid size-full place-items-center bg-gradient-to-br from-navy via-[#12386a] to-sky/60 p-6 text-center ${className}`}>
      <span className={`font-display leading-tight ${blur ? 'text-5xl' : 'text-2xl'}`}>{event.name}</span>
    </div>
  )
}

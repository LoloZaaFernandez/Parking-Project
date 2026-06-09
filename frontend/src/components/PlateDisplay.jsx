export default function PlateDisplay({ plate, size = 'lg', animate = false }) {
  if (!plate) return null

  const sizes = {
    sm: 'text-base px-2 py-0.5 border-2',
    md: 'text-xl px-3 py-1 border-2',
    lg: 'text-3xl px-4 py-2 border-4',
    xl: 'text-4xl px-5 py-3 border-4',
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded shadow-lg
        bg-yellow-300 text-black font-mono font-black tracking-widest
        ${sizes[size] ?? sizes.lg}
        border-black
        ${animate ? 'animate-plate-pop' : ''}
      `}
    >
      {plate}
    </div>
  )
}

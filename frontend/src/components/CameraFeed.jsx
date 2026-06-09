import { useRef, useState } from 'react'

const STREAM_URL = 'http://localhost:8000/camera/stream'

export default function CameraFeed({ className = '' }) {
  const [error, setError] = useState(false)
  const imgRef = useRef(null)

  return (
    <div className={`relative bg-black rounded-xl overflow-hidden ${className}`}>
      {!error ? (
        <img
          ref={imgRef}
          src={STREAM_URL}
          alt="Camera feed"
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-3">
          <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14
                 M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm">Sin señal de cámara</p>
          <button
            onClick={() => setError(false)}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}

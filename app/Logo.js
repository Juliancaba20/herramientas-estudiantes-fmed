// Marca del sitio: un libro abierto con un destello. Es el mismo dibujo que app/icon.svg.
export default function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a5a54" />
          <stop offset=".55" stopColor="#0f766e" />
          <stop offset="1" stopColor="#ff7a63" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logo-g)" />
      <g transform="translate(-4.8 -0.2) scale(1.15)">{/* libro */}
        <path d="M30 25C25 21.5 18 21 12 23v22.5c6-2 13-1.5 18 2z" fill="#fff" />
        <path d="M34 25c5-3.5 12-4 18-2v22.5c-6-2-13-1.5-18 2z" fill="#fff" />
        <path d="M32 6c.8 5.2 2.8 7.2 8 8-5.2.8-7.2 2.8-8 8-.8-5.2-2.8-7.2-8-8 5.2-.8 7.2-2.8 8-8z" fill="#ffe3dc" />
      </g>
    </svg>
  );
}

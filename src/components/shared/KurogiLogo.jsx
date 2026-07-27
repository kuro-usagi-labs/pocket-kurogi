export default function KurogiLogo({ size = 64, className = '' }) {
  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-orange-50 ${className}`}
      style={{ width: size, height: size }}
      aria-label="Kurogi"
      role="img"
    >
      <svg
        viewBox="0 0 96 96"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="48" cy="48" r="46" fill="#FFF1EC" />
        <path d="M33 33C27 19 27 8 34 6C41 4 45 17 43 31" fill="#fff" stroke="#0B172A" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M62 33C68 19 68 8 61 6C54 4 50 17 52 31" fill="#fff" stroke="#0B172A" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M36 30C38 18 38 13 36 11" stroke="#E8542E" strokeWidth="3" strokeLinecap="round" />
        <path d="M59 30C57 18 57 13 59 11" stroke="#E8542E" strokeWidth="3" strokeLinecap="round" />
        <path d="M21 80C27 66 36 59 48 59C60 59 69 66 75 80C68 88 59 92 48 92C37 92 28 88 21 80Z" fill="#071427" />
        <path d="M31 73C36 77 41 79 48 79C55 79 60 77 65 73" stroke="#E8542E" strokeWidth="3" strokeLinecap="round" />
        <path d="M23 48C23 35 33 26 48 26C63 26 73 35 73 48C73 62 62 72 48 72C34 72 23 62 23 48Z" fill="#fff" stroke="#0B172A" strokeWidth="3.4" />
        <circle cx="39" cy="48" r="3" fill="#0B172A" />
        <circle cx="57" cy="48" r="3" fill="#0B172A" />
        <path d="M46 55C47 56 49 56 50 55" stroke="#0B172A" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M34 58C31 57 29 57 26 58" stroke="#0B172A" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M62 58C65 57 67 57 70 58" stroke="#0B172A" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="48" cy="84" r="4" fill="#E8542E" />
        <path d="M48 81V87M45 84H51" stroke="#071427" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}

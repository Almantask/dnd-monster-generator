export function KoboldRunner({ className = 'w-32 h-28' }: { className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 160 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md overflow-visible"
      >
        <defs>
          <style>{`
            @keyframes koboldBob {
              0%, 100% { transform: translateY(0px) rotate(2deg); }
              50% { transform: translateY(-7px) rotate(6deg); }
            }
            @keyframes koboldLegLeft {
              0% { transform: rotate(-38deg); }
              50% { transform: rotate(38deg); }
              100% { transform: rotate(-38deg); }
            }
            @keyframes koboldLegRight {
              0% { transform: rotate(38deg); }
              50% { transform: rotate(-38deg); }
              100% { transform: rotate(38deg); }
            }
            @keyframes koboldArmLeft {
              0% { transform: rotate(30deg); }
              50% { transform: rotate(-30deg); }
              100% { transform: rotate(30deg); }
            }
            @keyframes koboldArmRight {
              0% { transform: rotate(-35deg); }
              50% { transform: rotate(35deg); }
              100% { transform: rotate(-35deg); }
            }
            @keyframes koboldTail {
              0%, 100% { transform: rotate(0deg); }
              50% { transform: rotate(-18deg); }
            }
            @keyframes torchFlame {
              0%, 100% { transform: scale(1) rotate(-3deg); filter: drop-shadow(0 0 4px #f6ad55); }
              50% { transform: scale(1.18, 0.92) rotate(4deg); filter: drop-shadow(0 0 8px #ed8936); }
            }
            @keyframes dustPuff1 {
              0% { transform: translate(45px, 118px) scale(0.2); opacity: 0.9; }
              100% { transform: translate(15px, 110px) scale(1.3); opacity: 0; }
            }
            @keyframes dustPuff2 {
              0% { transform: translate(50px, 120px) scale(0.3); opacity: 0.8; }
              100% { transform: translate(25px, 114px) scale(1.5); opacity: 0; }
            }
            .anim-bob { animation: koboldBob 0.38s ease-in-out infinite; transform-origin: 75px 85px; }
            .anim-leg-l { animation: koboldLegLeft 0.38s ease-in-out infinite; transform-origin: 68px 90px; }
            .anim-leg-r { animation: koboldLegRight 0.38s ease-in-out infinite; transform-origin: 82px 90px; }
            .anim-arm-l { animation: koboldArmLeft 0.38s ease-in-out infinite; transform-origin: 62px 64px; }
            .anim-arm-r { animation: koboldArmRight 0.38s ease-in-out infinite; transform-origin: 88px 64px; }
            .anim-tail { animation: koboldTail 0.38s ease-in-out infinite; transform-origin: 52px 86px; }
            .anim-flame { animation: torchFlame 0.3s ease-in-out infinite; transform-origin: 122px 32px; }
            .anim-dust-1 { animation: dustPuff1 0.38s ease-out infinite; }
            .anim-dust-2 { animation: dustPuff2 0.38s ease-out infinite 0.19s; }
          `}</style>
        </defs>

        {/* Running Dust Puffs */}
        <circle cx="0" cy="0" r="7" fill="#b79c6d" className="anim-dust-1" />
        <circle cx="0" cy="0" r="5" fill="#a08250" className="anim-dust-2" />

        {/* Speed / Running lines on the floor */}
        <g stroke="#922610" strokeWidth="2" strokeDasharray="6 8" opacity="0.35">
          <line x1="10" y1="126" x2="150" y2="126" />
        </g>

        {/* Left (Back) Leg */}
        <g className="anim-leg-l">
          <path
            d="M68 90 L60 108 L48 116"
            stroke="#9c4221"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Foot Claws */}
          <path d="M48 116 L40 118 M48 116 L42 122" stroke="#4a1505" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Tail */}
        <g className="anim-tail">
          <path
            d="M54 84 C40 82 22 75 16 62 C14 58 18 56 22 60 C28 66 38 74 52 80"
            fill="#c05621"
            stroke="#822000"
            strokeWidth="2"
          />
          {/* Tail Spines */}
          <polygon points="26,60 22,54 30,58" fill="#dd6b20" />
          <polygon points="36,68 33,62 40,66" fill="#dd6b20" />
          <polygon points="46,75 44,70 50,74" fill="#dd6b20" />
        </g>

        {/* Kobold Torso & Head (Bobs up/down together) */}
        <g className="anim-bob">
          {/* Back Arm & Scroll */}
          <g className="anim-arm-l">
            <path d="M62 64 L48 74 L40 68" stroke="#9c4221" strokeWidth="5.5" strokeLinecap="round" />
            {/* Rolled parchment scroll in back hand */}
            <rect x="34" y="60" width="14" height="6" rx="2" fill="#fdf1dc" stroke="#822000" strokeWidth="1.5" transform="rotate(-15 34 60)" />
            <line x1="38" y1="62" x2="44" y2="60" stroke="#922610" strokeWidth="1" />
          </g>

          {/* Main Body */}
          <ellipse cx="74" cy="76" rx="16" ry="18" fill="#c05621" stroke="#822000" strokeWidth="2.5" />
          {/* Pale Underbelly / scales */}
          <path d="M72 65 Q86 75 78 92 Q68 90 68 76 Z" fill="#dd6b20" opacity="0.9" />

          {/* Leather Vest Harness */}
          <path d="M65 62 Q74 72 74 88 M81 64 Q74 74 68 88" stroke="#4a1505" strokeWidth="2" fill="none" />
          <circle cx="73" cy="74" r="2.5" fill="#ecc94b" stroke="#4a1505" strokeWidth="1" />

          {/* Draconic Head */}
          <g transform="translate(18, -4)">
            {/* Snout & Head Base */}
            <path
              d="M58 56 C54 44 64 36 78 40 C88 43 102 46 106 52 C108 55 106 58 98 60 C88 62 76 68 64 66 C58 64 56 60 58 56 Z"
              fill="#c05621"
              stroke="#822000"
              strokeWidth="2.5"
            />
            {/* Horns */}
            <path d="M64 40 C60 30 54 22 48 20 C52 26 56 34 62 38" fill="#822000" />
            <path d="M70 38 C68 28 64 18 58 14 C62 22 65 30 68 36" fill="#822000" />

            {/* Glowing Big Dragon Eye */}
            <circle cx="78" cy="46" r="5" fill="#ecc94b" stroke="#742a2a" strokeWidth="1.5" />
            <ellipse cx="78" cy="46" rx="1.5" ry="4" fill="#1a1208" />
            <circle cx="79.5" cy="44.5" r="1.2" fill="#ffffff" />

            {/* Nostril / Snout Tooth */}
            <circle cx="101" cy="50" r="1.2" fill="#4a1505" />
            <polygon points="94,59 96,64 99,59" fill="#fdf1dc" stroke="#822000" strokeWidth="0.8" />
            <polygon points="86,61 88,65 91,61" fill="#fdf1dc" stroke="#822000" strokeWidth="0.8" />
          </g>

          {/* Front Arm with Torch */}
          <g className="anim-arm-r">
            {/* Arm */}
            <path d="M86 64 L102 68 L114 62" stroke="#c05621" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            {/* Torch Handle */}
            <line x1="110" y1="78" x2="120" y2="40" stroke="#5c2610" strokeWidth="4" strokeLinecap="round" />
            <line x1="108" y1="74" x2="114" y2="72" stroke="#922610" strokeWidth="1.5" />
            {/* Torch Head Wrap */}
            <rect x="115" y="38" width="8" height="9" rx="2" fill="#78350f" stroke="#451a03" strokeWidth="1" transform="rotate(-15 115 38)" />

            {/* Torch Flame */}
            <g className="anim-flame">
              {/* Outer Glow Flame */}
              <path
                d="M120 38 C114 26 122 14 126 8 C130 16 138 24 132 38 C128 42 122 42 120 38 Z"
                fill="#dd6b20"
                opacity="0.85"
              />
              {/* Inner Hot Yellow Flame */}
              <path
                d="M122 36 C119 28 124 18 126 14 C128 20 133 26 129 36 Z"
                fill="#ecc94b"
              />
              {/* Bright Core */}
              <ellipse cx="126" cy="33" rx="2.5" ry="4" fill="#fffaf0" />
            </g>
          </g>
        </g>

        {/* Right (Front) Leg */}
        <g className="anim-leg-r">
          <path
            d="M82 90 L92 108 L104 116"
            stroke="#c05621"
            strokeWidth="7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Foot Claws */}
          <path d="M104 116 L112 118 M104 116 L108 123" stroke="#4a1505" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}

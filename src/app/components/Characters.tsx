// Original illustrated characters as inline SVG (no real-person likeness).
// Angela: inventive host. Pip: prism-winged firefly. Professor Quark: small clockwork fox.

export function Angela({ size = 72, mood = 'smile' }: { size?: number; mood?: 'smile' | 'wow' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Angela, the inventive host">
      <defs>
        <radialGradient id="ang-skin" cx="45%" cy="40%" r="60%">
          <stop offset="0" stop-color="#c98a5e" />
          <stop offset="1" stop-color="#a2663f" />
        </radialGradient>
        <linearGradient id="ang-coat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4a2f7c" />
          <stop offset="1" stop-color="#291b46" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="49" fill="#1d1236" />
      {/* hair puff */}
      <circle cx="50" cy="26" r="22" fill="#2a1712" />
      <circle cx="33" cy="36" r="13" fill="#2a1712" />
      <circle cx="67" cy="36" r="13" fill="#2a1712" />
      {/* coat */}
      <path d="M18 100 C20 74 34 68 50 68 C66 68 80 74 82 100 Z" fill="url(#ang-coat)" />
      <path d="M50 68 L42 100 M50 68 L58 100" stroke="#ffc75b" stroke-width="3" />
      {/* face */}
      <ellipse cx="50" cy="48" rx="19" ry="21" fill="url(#ang-skin)" />
      {/* goggles on forehead */}
      <rect x="30" y="30" width="40" height="6" rx="3" fill="#71e3cf" opacity="0.9" />
      <circle cx="40" cy="33" r="6" fill="#bff7ec" stroke="#ffc75b" stroke-width="2" />
      <circle cx="60" cy="33" r="6" fill="#bff7ec" stroke="#ffc75b" stroke-width="2" />
      {/* eyes */}
      <ellipse cx="42" cy="48" rx="2.8" ry={mood === 'wow' ? 3.6 : 3} fill="#1a1030" />
      <ellipse cx="58" cy="48" rx="2.8" ry={mood === 'wow' ? 3.6 : 3} fill="#1a1030" />
      <circle cx="43" cy="47" r="0.9" fill="#fff" />
      <circle cx="59" cy="47" r="0.9" fill="#fff" />
      {/* smile */}
      {mood === 'wow' ? <ellipse cx="50" cy="59" rx="4" ry="4.5" fill="#5a1f2a" /> : <path d="M42 57 Q50 64 58 57" stroke="#5a1f2a" stroke-width="2.4" fill="none" stroke-linecap="round" />}
      <circle cx="36" cy="55" r="3" fill="#ff7f86" opacity="0.45" />
      <circle cx="64" cy="55" r="3" fill="#ff7f86" opacity="0.45" />
      {/* lightbulb pin */}
      <circle cx="72" cy="18" r="6" fill="#ffc75b" />
      <rect x="69.5" y="23" width="5" height="4" rx="1" fill="#c9b8e8" />
    </svg>
  );
}

export function Pip({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Pip, the prism-winged firefly">
      <defs>
        <radialGradient id="pip-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#fff3c4" />
          <stop offset="0.5" stop-color="#ffc75b" />
          <stop offset="1" stop-color="#ffc75b" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="pip-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff7f86" stop-opacity="0.8" />
          <stop offset="0.35" stop-color="#ffc75b" stop-opacity="0.8" />
          <stop offset="0.65" stop-color="#71e3cf" stop-opacity="0.8" />
          <stop offset="1" stop-color="#9fb4ff" stop-opacity="0.85" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="66" r="30" fill="url(#pip-glow)" />
      <path d="M48 44 L14 20 L30 52 Z" fill="url(#pip-wing)" stroke="#fff7e7" stroke-width="1.2" />
      <path d="M52 44 L86 20 L70 52 Z" fill="url(#pip-wing)" stroke="#fff7e7" stroke-width="1.2" />
      <ellipse cx="50" cy="64" rx="11" ry="15" fill="#ffe08a" />
      <circle cx="50" cy="40" r="11" fill="#3b2466" />
      <circle cx="46" cy="39" r="3" fill="#fff7e7" />
      <circle cx="55" cy="39" r="3" fill="#fff7e7" />
      <circle cx="46.6" cy="39.4" r="1.5" fill="#1a1030" />
      <circle cx="55.6" cy="39.4" r="1.5" fill="#1a1030" />
      <path d="M46 31 Q42 20 38 18 M54 31 Q58 20 62 18" stroke="#3b2466" stroke-width="2" fill="none" stroke-linecap="round" />
      <circle cx="38" cy="18" r="2.5" fill="#71e3cf" />
      <circle cx="62" cy="18" r="2.5" fill="#71e3cf" />
    </svg>
  );
}

export function Quark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Professor Quark, the clockwork fox">
      <circle cx="50" cy="50" r="49" fill="#1d1236" />
      <path d="M22 30 L34 10 L42 34 Z" fill="#d9773a" />
      <path d="M78 30 L66 10 L58 34 Z" fill="#d9773a" />
      <path d="M26 30 L34 16 L39 32 Z" fill="#fff7e7" opacity="0.7" />
      <path d="M50 82 C28 82 20 60 24 44 C28 30 40 26 50 26 C60 26 72 30 76 44 C80 60 72 82 50 82 Z" fill="#e28a45" />
      <path d="M50 82 C40 82 33 70 35 62 L50 70 L65 62 C67 70 60 82 50 82 Z" fill="#fff7e7" />
      <circle cx="39" cy="50" r="4" fill="#1a1030" />
      <circle cx="61" cy="50" r="7" fill="none" stroke="#ffc75b" stroke-width="2.5" />
      <circle cx="61" cy="50" r="4" fill="#1a1030" />
      <path d="M68 55 L76 72" stroke="#ffc75b" stroke-width="1.5" />
      <ellipse cx="50" cy="66" rx="4" ry="3" fill="#1a1030" />
      {/* gear joints */}
      <g transform="translate(28 74)">
        <circle r="7" fill="#c9b8e8" />
        <circle r="2.5" fill="#1d1236" />
      </g>
      <g transform="translate(72 74)">
        <circle r="7" fill="#c9b8e8" />
        <circle r="2.5" fill="#1d1236" />
      </g>
    </svg>
  );
}

export function Speaker({ who, size }: { who?: 'angela' | 'pip' | 'quark'; size?: number }) {
  if (who === 'angela') return <Angela size={size} />;
  if (who === 'quark') return <Quark size={size} />;
  if (who === 'pip') return <Pip size={size} />;
  return null;
}

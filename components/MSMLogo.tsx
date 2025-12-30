import React from 'react';

interface LogoProps {
    className?: string;
    showText?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'default' | 'light';
}

const MSMLogo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'md', variant = 'default' }) => {
    const sizes = {
        sm: { width: 80, height: 80, fontSize: '18px', subFontSize: '9px' },
        md: { width: 120, height: 120, fontSize: '32px', subFontSize: '13px' },
        lg: { width: 180, height: 180, fontSize: '48px', subFontSize: '18px' },
        xl: { width: 240, height: 240, fontSize: '64px', subFontSize: '24px' },
    };

    const { width, height, fontSize, subFontSize } = sizes[size];

    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Logo SVG */}
            <svg
                width={width}
                height={height}
                viewBox="0 0 240 240"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={variant === 'light' ? 'drop-shadow-[0_0_30px_rgba(0,229,255,0.5)]' : ''}
            >
                <defs>
                    <linearGradient id="steelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#B8C5D6" />
                        <stop offset="30%" stopColor="#7A8A9E" />
                        <stop offset="60%" stopColor="#4A5A6E" />
                        <stop offset="100%" stopColor="#2D3E50" />
                    </linearGradient>
                    <linearGradient id="blueWrenchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="50%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#1E40AF" />
                    </linearGradient>
                    <linearGradient id="goldWrenchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FCD34D" />
                        <stop offset="50%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                    <linearGradient id="goldBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FCD34D" />
                        <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                    <radialGradient id="darkCenter">
                        <stop offset="0%" stopColor="#1E3A52" />
                        <stop offset="100%" stopColor="#0A1628" />
                    </radialGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="textShadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="black" floodOpacity="0.8" />
                    </filter>
                </defs>

                <g transform="translate(120, 120)">

                    {/* WRENCHES AROUND THE GEAR */}
                    <g transform="rotate(-45)">
                        <path d="M 0,-85 L -8,-75 L -5,-72 L -8,-65 L -3,-60 L 3,-60 L 8,-65 L 5,-72 L 8,-75 Z" fill="url(#blueWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                        <rect x="-3" y="-95" width="6" height="15" rx="2" fill="url(#blueWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                    </g>
                    <g transform="rotate(45)">
                        <path d="M 0,-85 L -8,-75 L -5,-72 L -8,-65 L -3,-60 L 3,-60 L 8,-65 L 5,-72 L 8,-75 Z" fill="url(#goldWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                        <rect x="-3" y="-95" width="6" height="15" rx="2" fill="url(#goldWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                    </g>
                    <g transform="rotate(135)">
                        <path d="M 0,-85 L -8,-75 L -5,-72 L -8,-65 L -3,-60 L 3,-60 L 8,-65 L 5,-72 L 8,-75 Z" fill="url(#blueWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                        <rect x="-3" y="-95" width="6" height="15" rx="2" fill="url(#blueWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                    </g>
                    <g transform="rotate(-135)">
                        <path d="M 0,-85 L -8,-75 L -5,-72 L -8,-65 L -3,-60 L 3,-60 L 8,-65 L 5,-72 L 8,-75 Z" fill="url(#goldWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                        <rect x="-3" y="-95" width="6" height="15" rx="2" fill="url(#goldWrenchGradient)" filter={variant === 'light' ? 'url(#glow)' : ''} />
                    </g>

                    {/* GEAR TEETH */}
                    {[...Array(8)].map((_, i) => {
                        const angle = (i * 360) / 8;
                        return (
                            <g key={i} transform={`rotate(${angle})`}>
                                <rect x="-8" y="-62" width="16" height="18" fill="url(#steelGradient)" rx="2" />
                            </g>
                        );
                    })}

                    {/* OUTER GEAR RING */}
                    <circle cx="0" cy="0" r="50" fill="url(#steelGradient)" />

                    {/* INNER DARK CIRCLE */}
                    <circle cx="0" cy="0" r="42" fill="url(#darkCenter)" />

                    {/* CHART BARS (Gold) - Slightly adjusted to separate them */}
                    <rect x="-28" y="10" width="14" height="20" fill="url(#goldBarGradient)" rx="2" filter={variant === 'light' ? 'url(#glow)' : ''} />
                    <rect x="-10" y="-5" width="14" height="35" fill="url(#goldBarGradient)" rx="2" filter={variant === 'light' ? 'url(#glow)' : ''} />
                    <rect x="8" y="-20" width="14" height="50" fill="url(#goldBarGradient)" rx="2" filter={variant === 'light' ? 'url(#glow)' : ''} />

                    {/* "MSM" TEXT OVERLAY - Centered, 3D Look */}
                    <text
                        x="0"
                        y="10"
                        textAnchor="middle"
                        fill="white"
                        stroke="#0A1628"
                        strokeWidth="1.5"
                        fontFamily="'Outfit', sans-serif"
                        fontWeight="800"
                        fontSize="38"
                        filter="url(#textShadow)"
                        style={{ letterSpacing: '1px' }}
                    >
                        MSM
                    </text>
                    <text
                        x="0"
                        y="10"
                        textAnchor="middle"
                        fill="url(#steelGradient)"
                        fillOpacity="0.9"
                        fontFamily="'Outfit', sans-serif"
                        fontWeight="800"
                        fontSize="38"
                        style={{ letterSpacing: '1px', mixBlendMode: 'overlay' }}
                    >
                        MSM
                    </text>

                </g>
            </svg>

            {/* TEXT BELOW */}
            {showText && (
                <div className="mt-6 text-center">
                    <h1
                        className={`font-bold leading-none tracking-tight ${variant === 'light'
                                ? 'text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-cyan-400 to-cyan-600 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]'
                                : 'text-[#0F3F5C]'
                            }`}
                        style={{ fontSize, fontFamily: '"Outfit", sans-serif' }}
                    >
                        MSM
                    </h1>
                    <p
                        className={`${variant === 'light' ? 'text-cyan-400/90' : 'text-[#0F3F5C]'} font-medium mt-2 whitespace-nowrap tracking-[0.25em] uppercase`}
                        style={{ fontSize: subFontSize }}
                    >
                        Sistema de Gestão
                    </p>
                    <p
                        className={`${variant === 'light' ? 'text-cyan-400/90' : 'text-[#0F3F5C]'} font-medium whitespace-nowrap tracking-[0.25em] uppercase`}
                        style={{ fontSize: subFontSize }}
                    >
                        de Produção
                    </p>
                </div>
            )}
        </div>
    );
};

export default MSMLogo;

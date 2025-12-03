import React from 'react';

interface LogoProps {
    className?: string;
    showText?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const MSMLogo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'md' }) => {
    const sizes = {
        sm: { width: 60, height: 60, fontSize: '16px', subFontSize: '8px' },
        md: { width: 100, height: 100, fontSize: '28px', subFontSize: '12px' },
        lg: { width: 150, height: 150, fontSize: '42px', subFontSize: '16px' },
        xl: { width: 200, height: 200, fontSize: '56px', subFontSize: '20px' },
    };

    const { width, height, fontSize, subFontSize } = sizes[size];

    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Logo SVG */}
            <svg
                width={width}
                height={height}
                viewBox="0 0 200 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Engrenagem */}
                <g transform="translate(100, 100)">
                    {/* Dentes da engrenagem */}
                    {[...Array(8)].map((_, i) => {
                        const angle = (i * 360) / 8;
                        return (
                            <g key={i} transform={`rotate(${angle})`}>
                                <rect
                                    x="-10"
                                    y="-70"
                                    width="20"
                                    height="25"
                                    fill="#0F3F5C"
                                    rx="3"
                                />
                            </g>
                        );
                    })}

                    {/* Círculo externo da engrenagem */}
                    <circle cx="0" cy="0" r="55" fill="#0F3F5C" />

                    {/* Círculo interno branco */}
                    <circle cx="0" cy="0" r="45" fill="white" />

                    {/* Barras do gráfico (laranja) */}
                    <rect x="-30" y="10" width="15" height="25" fill="#FF8C00" rx="2" />
                    <rect x="-10" y="-5" width="15" height="40" fill="#FF8C00" rx="2" />
                    <rect x="10" y="-20" width="15" height="55" fill="#FF8C00" rx="2" />

                    {/* Seta de crescimento */}
                    <path
                        d="M -25 5 Q 0 -15, 30 -25"
                        stroke="#0F3F5C"
                        strokeWidth="5"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <polygon
                        points="30,-25 25,-30 35,-30"
                        fill="#0F3F5C"
                    />
                    <polygon
                        points="30,-25 25,-20 35,-20"
                        fill="#0F3F5C"
                    />

                    {/* Círculo central da engrenagem */}
                    <circle cx="0" cy="0" r="12" fill="#0F3F5C" />
                </g>
            </svg>

            {/* Texto */}
            {showText && (
                <div className="mt-4 text-center">
                    <h1
                        className="font-bold text-[#0F3F5C] leading-none tracking-tight"
                        style={{ fontSize }}
                    >
                        MSM
                    </h1>
                    <p
                        className="text-[#0F3F5C] font-medium mt-1 whitespace-nowrap"
                        style={{ fontSize: subFontSize }}
                    >
                        SISTEMA DE GESTÃO
                    </p>
                    <p
                        className="text-[#0F3F5C] font-medium whitespace-nowrap"
                        style={{ fontSize: subFontSize }}
                    >
                        DE PRODUÇÃO
                    </p>
                </div>
            )}
        </div>
    );
};

export default MSMLogo;

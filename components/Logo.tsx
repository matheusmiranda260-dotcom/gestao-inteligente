import React from 'react';

export const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 100 80"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="MSM Logo"
    >
        <path
            d="M0 80V0 H20 V80 H0 Z M20 15 L50 55 L80 15 V0 H65 L50 25 L35 0 H20 V15 Z M80 80 V0 H100 V80 H80 Z"
            fill="currentColor"
            className="text-primary-600"
        />
    </svg>
);


export const LogoFull: React.FC<{ className?: string, iconClassName?: string, textClassName?: string }> = ({ className, iconClassName, textClassName }) => (
    <div className={`flex items-center gap-3 ${className}`}>
        <LogoIcon className={iconClassName || 'h-8 w-8'} />
        <span className={textClassName || 'text-2xl font-bold text-slate-800'}>
            MSM
        </span>
    </div>
);
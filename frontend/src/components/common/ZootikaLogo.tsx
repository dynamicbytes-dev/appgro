import React, { useState } from 'react';

export interface ZootikaLogoProps {
  /** Tamaño del isotipo y tipografía complementaria */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Si es true, muestra el nombre "Zootika", el badge "Multigranja" y el subtítulo */
  showText?: boolean;
  /** Variante de texto para fondos oscuros (default) o fondos claros */
  textVariant?: 'light' | 'dark' | 'auto';
  /** Clases CSS adicionales para el contenedor exterior */
  className?: string;
  /** Si se hace clic en el logo (por ejemplo para redirigir) */
  onClick?: () => void;
}

export const ZootikaLogo: React.FC<ZootikaLogoProps> = ({
  size = 'md',
  showText = false,
  textVariant = 'light',
  className = '',
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Mapeo dimensional estricto para cada variante de tamaño
  const sizeConfig = {
    sm: {
      container: 'w-8 h-8 rounded-lg p-1',
      image: 'w-6 h-6',
      title: 'text-sm font-extrabold tracking-wide',
      badge: 'text-[9px] px-1.5 py-0.2',
      subtitle: 'text-[10px]',
    },
    md: {
      container: 'w-10 h-10 rounded-xl p-1.5',
      image: 'w-7 h-7',
      title: 'text-lg font-extrabold tracking-wide',
      badge: 'text-[11px] px-2 py-0.5',
      subtitle: 'text-xs',
    },
    lg: {
      container: 'w-14 h-14 rounded-2xl p-2',
      image: 'w-10 h-10',
      title: 'text-xl font-black tracking-tight',
      badge: 'text-xs px-2.5 py-0.5',
      subtitle: 'text-xs sm:text-sm',
    },
    xl: {
      container: 'w-20 h-20 rounded-2xl p-2.5',
      image: 'w-15 h-15',
      title: 'text-2xl sm:text-3xl font-black tracking-tight',
      badge: 'text-xs px-2.5 py-0.5',
      subtitle: 'text-xs sm:text-sm',
    },
  }[size];

  const textColorClass =
    textVariant === 'dark'
      ? 'text-gray-900 dark:text-white'
      : textVariant === 'auto'
      ? 'text-gray-900 dark:text-gray-100'
      : 'text-white';

  const subtitleColorClass =
    textVariant === 'dark'
      ? 'text-gray-500 dark:text-emerald-300/80'
      : textVariant === 'auto'
      ? 'text-gray-500 dark:text-gray-400'
      : 'text-emerald-200/80';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Contenedor del Isotipo Oficial */}
      <div
        className={`relative shrink-0 flex items-center justify-center bg-[#042f24] border border-emerald-500/30 shadow-sm overflow-hidden ${sizeConfig.container}`}
      >
        {/* Isotipo Oficial (PNG de alta resolución) */}
        {!imgError && (
          <img
            src="/logo-zootika.png"
            alt="Zootika - Isotipo Oficial"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`${sizeConfig.image} object-contain transition-opacity duration-200 ${
              imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
        )}

        {/* Fallback Vectorial SVG del Isotipo Toro-Hoja */}
        {(!imgLoaded || imgError) && (
          <svg
            viewBox="0 0 100 100"
            className={`${sizeConfig.image} absolute inset-auto`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Zootika Isotipo Toro-Hoja"
          >
            {/* Cuerno izquierdo del bovino en verde bosque profundo */}
            <path
              d="M18 28C14 36 15 47 22 51C24 43 27 36 34 32C28 29 22 25 18 28Z"
              fill="#064E3B"
            />
            {/* Contorno izquierdo de la cabeza */}
            <path
              d="M23 48C20 53 14 55 12 59C17 63 25 61 28 56C30 63 32 72 36 78C38 72 36 62 33 55C31 52 28 49 23 48Z"
              fill="#10B981"
            />
            {/* Hoja central/derecha fusionada en verde esmeralda */}
            <path
              d="M48 24C65 24 84 32 86 52C87 63 76 72 65 79C64 69 66 59 73 50C62 55 53 66 49 78C47 62 45 44 48 24Z"
              fill="#10B981"
            />
            {/* Nervadura y detalle de la hoja en verde bosque */}
            <path
              d="M51 32C62 39 74 48 76 60C68 56 61 47 51 43V32Z"
              fill="#064E3B"
            />
            {/* Hocico estilizado */}
            <path
              d="M38 80C36 84 41 90 48 90C55 90 60 84 58 80C52 82 44 82 38 80Z"
              fill="#10B981"
            />
            {/* Orificio nasal izquierdo */}
            <circle cx="43" cy="85" r="2" fill="#064E3B" />
            {/* Orificio nasal derecho */}
            <circle cx="53" cy="85" r="2" fill="#064E3B" />
          </svg>
        )}
      </div>

      {/* Identidad Tipográfica Completa */}
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center gap-2">
            <span className={`${sizeConfig.title} ${textColorClass}`}>
              Zootika
            </span>
            <span
              className={`${sizeConfig.badge} bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold uppercase tracking-wider`}
            >
              Multigranja
            </span>
          </div>
          <p className={`${sizeConfig.subtitle} ${subtitleColorClass} hidden sm:block font-medium`}>
            Sistema de Gestión Agropecuaria Integral
          </p>
        </div>
      )}
    </div>
  );
};

export default ZootikaLogo;

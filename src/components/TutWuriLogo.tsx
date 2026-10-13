import React, { useState, useEffect } from 'react';
import { getActiveLogoPhotoUrl } from '../data/examData';

interface TutWuriLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const TutWuriLogo: React.FC<TutWuriLogoProps> = ({
  size = 'lg',
  className = '',
}) => {
  const [logoSrc, setLogoSrc] = useState<string>(() => getActiveLogoPhotoUrl());
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setLogoSrc(getActiveLogoPhotoUrl());
      setImgError(false);
    };
    window.addEventListener('anbk-logo-updated', handleUpdate);
    window.addEventListener('anbk-photo-updated', handleUpdate);
    return () => {
      window.removeEventListener('anbk-logo-updated', handleUpdate);
      window.removeEventListener('anbk-photo-updated', handleUpdate);
    };
  }, []);

  const sizeClasses = {
    sm: 'w-11 h-11',
    md: 'w-16 h-16',
    lg: 'w-28 h-28',
    xl: 'w-44 h-44 sm:w-52 sm:h-52',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl bg-white ${
        size === 'xl' ? 'p-0' : 'p-0.5'
      } shadow-sm border border-slate-200/80 shrink-0 overflow-hidden ${sizeClasses[size]} ${className}`}
    >
      {!imgError ? (
        <img
          src={logoSrc}
          alt="Logo Resmi Pendidikan Indonesia - Tut Wuri Handayani"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`w-full h-full object-contain rounded-xl bg-white ${
            size === 'xl' ? 'scale-125' : 'scale-110'
          }`}
        />
      ) : (
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full scale-105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Logo Tut Wuri Handayani"
        >
          <rect width="200" height="200" rx="24" fill="#FFFFFF" />
          {/* Segi Lima Biru */}
          <polygon
            points="100,12 186,74 154,178 46,178 14,74"
            fill="#0055A5"
            stroke="#003D7A"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <polygon
            points="100,20 178,77 148,171 52,171 22,77"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeOpacity="0.6"
          />
          {/* Path Melengkung untuk Tulisan TUT WURI HANDAYANI */}
          <defs>
            <path id="curveTop" d="M 38,84 A 65,65 0 0,1 162,84" />
          </defs>
          <text
            fill="#FFFFFF"
            fontSize="11.5"
            fontWeight="700"
            letterSpacing="1.2"
            textAnchor="middle"
          >
            <textPath href="#curveTop" startOffset="50%">
              TUT WURI HANDAYANI
            </textPath>
          </text>
          {/* Sayap Burung Garuda Putih */}
          <path
            d="M100 118 C75 115, 48 96, 42 78 C55 82, 72 86, 85 95 C68 92, 50 102, 48 112 C62 110, 78 114, 90 124 Z"
            fill="#FFFFFF"
          />
          <path
            d="M100 118 C125 115, 152 96, 158 78 C145 82, 128 86, 115 95 C132 92, 150 102, 152 112 C138 110, 122 114, 110 124 Z"
            fill="#FFFFFF"
          />
          {/* Ekor Garuda Putih */}
          <polygon points="90,125 110,125 116,143 84,143" fill="#FFFFFF" />
          {/* Blencong / Lampu Minyak Kuning Menyala di Tengah */}
          <path
            d="M100 54 C93 66, 92 75, 100 82 C108 75, 107 66, 100 54 Z"
            fill="#FFD700"
          />
          <path
            d="M100 60 C96 68, 96 74, 100 79 C104 74, 104 68, 100 60 Z"
            fill="#FFF3B0"
          />
          <path
            d="M84 90 C84 84, 116 84, 116 90 C112 102, 88 102, 84 90 Z"
            fill="#FFC107"
          />
          <rect x="96" y="100" width="8" height="16" rx="2" fill="#FFC107" />
          {/* Buku Terbuka Putih di Bagian Bawah */}
          <path
            d="M64 148 Q82 142 100 150 Q118 142 136 148 L136 162 Q118 156 100 164 Q82 156 64 162 Z"
            fill="#FFFFFF"
          />
          <line x1="100" y1="149" x2="100" y2="164" stroke="#0055A5" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
};

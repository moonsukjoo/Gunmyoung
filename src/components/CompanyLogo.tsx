import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const CompanyLogo: React.FC<LogoProps> = ({ className, size = '100%' }) => {
  return (
    <svg 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: size, height: size }}
    >
      {/* Blue Diamond Background */}
      <path 
        d="M100 10L185 100L100 190L15 100L100 10Z" 
        fill="#0078D4" 
      />
      
      {/* Eye Shape / Orbit (White part) */}
      <path 
        d="M30 100C30 75 60 55 100 55C140 55 170 75 170 100C170 125 140 145 100 145C60 145 30 125 30 100Z" 
        stroke="white" 
        strokeWidth="15"
        fill="none"
      />
      
      {/* Central Pupil (Darker Blue Circle) */}
      <circle cx="100" cy="100" r="30" fill="#005A9E" />
      
      {/* Swish effects to mimic the spiral look */}
      <path 
        d="M175 90C185 100 185 120 170 140M25 110C15 100 15 80 30 60" 
        stroke="white" 
        strokeWidth="8" 
        strokeLinecap="round" 
      />
    </svg>
  );
};

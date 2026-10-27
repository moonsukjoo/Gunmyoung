import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const CompanyLogo: React.FC<LogoProps> = ({ className, size = '100%' }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-primary text-white font-black text-[10px] rounded-sm select-none ${className || ''}`}
        style={{ width: size, height: size }}
      >
        건명
      </div>
    );
  }

  return (
    <img 
      src="/company_logo.png" 
      alt="건명기업 로고" 
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => {
        setError(true);
      }}
    />
  );
};

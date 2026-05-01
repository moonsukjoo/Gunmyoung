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
        className={`flex items-center justify-center bg-primary text-white font-black text-[10px] rounded-sm ${className || ''}`}
        style={{ width: size, height: size }}
        title="Logo load failed"
      >
        건명
      </div>
    );
  }

  return (
    <img 
      src="/company_logo.png" 
      alt="Company Logo" 
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => {
        console.error("Failed to load company logo. Falling back to text logo.");
        setError(true);
      }}
    />
  );
};

import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const CompanyLogo: React.FC<LogoProps> = ({ className, size = '100%' }) => {
  return (
    <img 
      src="/company_logo.png" 
      alt="Company Logo" 
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      referrerPolicy="no-referrer"
    />
  );
};

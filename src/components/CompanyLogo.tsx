import React from 'react';
import logo from '@/src/assets/logo.png';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const CompanyLogo: React.FC<LogoProps> = ({ className, size = '100%' }) => {
  return (
    <img 
      src={logo} 
      alt="Company Logo" 
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      referrerPolicy="no-referrer"
    />
  );
};

import React, { useState } from 'react';

interface MainLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const MainLogo: React.FC<MainLogoProps> = ({ size = 24, className, style }) => {
  const [loadError, setLoadError] = useState(false);

  // Choose the optimal icon asset based on rendering size for high-DPI crispness
  const iconRelPath = size > 48 ? 'icons/icon128.png' : size <= 16 ? 'icons/icon16.png' : 'icons/icon48.png';
  const logoUrl = typeof chrome !== 'undefined' && chrome?.runtime?.getURL
    ? chrome.runtime.getURL(iconRelPath)
    : iconRelPath;

  if (loadError) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff4500 0%, #ff5722 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: Math.max(Math.floor(size * 0.45), 10),
          userSelect: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          ...style
        }}
        title="RedditDIG"
      >
        D
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt="RedditDIG Logo"
      width={size}
      height={size}
      draggable={false}
      onError={() => setLoadError(true)}
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        objectFit: 'contain',
        borderRadius: '50%',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style
      }}
    />
  );
};

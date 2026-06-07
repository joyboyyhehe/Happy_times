import React from 'react';

/**
 * Centralized AppLogo component to render the Happy Times Preschool PWA logo.
 * Handles sizing variants, preserves aspect ratio, prevents layout shifts, 
 * and ensures transparent presentation with no outlines, shadows, or rounding.
 *
 * @param {object} props
 * @param {'landing'|'login'|'header'|'splash'} [props.variant='header'] - Sizing and load behavior context
 * @param {string} [props.className] - Custom classes to append
 * @param {object} [props.style] - Inline style overrides
 * @param {string} [props.alt='Happy Times Preschool'] - Alt text for accessibility
 */
export default function AppLogo({ 
  variant = 'header', 
  className = '', 
  style = {}, 
  alt = 'Happy Times Preschool',
  ...props 
}) {
  let width = 38;
  let height = 38;
  let isEager = true;

  switch (variant) {
    case 'landing':
      width = 100;
      height = 100;
      isEager = true;
      break;
    case 'login':
      width = 42;
      height = 42;
      isEager = true;
      break;
    case 'splash':
      width = 90;
      height = 90;
      isEager = true;
      break;
    case 'header':
    default:
      width = 38;
      height = 38;
      isEager = false;
      break;
  }

  const logoStyle = {
    width: width,
    height: height,
    objectFit: 'contain',
    imageRendering: 'auto',
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    borderRadius: '0',
    display: 'block',
    flexShrink: 0,
    ...style
  };

  return (
    <img
      src="/logo.png"
      alt={alt}
      className={`ht-logo-clean ht-logo-${variant} ${className}`}
      style={logoStyle}
      loading={isEager ? 'eager' : 'lazy'}
      {...props}
    />
  );
}

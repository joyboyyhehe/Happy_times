/**
 * LinkifyText — Renders text with URLs converted to tappable anchor tags.
 *
 * Props:
 *   text      {string}   — The text content to render
 *   style     {object}   — Optional style overrides for the wrapper element
 *   className {string}   — Optional className for the wrapper element
 *   maxChars  {number}   — If set, truncates text to N chars (adds "…") BEFORE linkifying
 *   lineClamp {number}   — If set, adds CSS line-clamp (for preview use)
 *
 * Handles:
 *   - https:// and http:// URLs
 *   - www.example.com (auto-prefixes https://)
 *   - Preserves newlines (whiteSpace: pre-wrap)
 *   - Opens links in a new tab safely (noopener noreferrer)
 */

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

function linkifySegments(text) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0; // reset after .test()
      const href = part.startsWith('www.') ? `https://${part}` : part;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color: '#2563EB',
            textDecoration: 'underline',
            wordBreak: 'break-all',
            fontWeight: 500,
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function LinkifyText({ text, style, className, maxChars, lineClamp }) {
  if (!text) return null;

  const displayText = maxChars && text.length > maxChars
    ? `${text.slice(0, maxChars)}…`
    : text;

  const clampStyle = lineClamp
    ? {
        display: '-webkit-box',
        WebkitLineClamp: lineClamp,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }
    : {};

  return (
    <span
      className={className}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...clampStyle,
        ...style,
      }}
    >
      {linkifySegments(displayText)}
    </span>
  );
}

/**
 * ChipSelect — Animated pill chip group for category/reason selection.
 * Wraps to multiple lines. Matches TPS submit_leave_screen.dart + create_post_screen.dart
 *
 * @param {Array<{value: string, label: string}>} options
 * @param {string} value - Currently selected value
 * @param {function} onChange - Called with new value
 * @param {boolean} [wrap] - Whether chips wrap (default true)
 */
export default function ChipSelect({ options, value, onChange, wrap = true }) {
  return (
    <div className={wrap ? 'chip-select-wrap' : 'chip-group'}>
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        const active = value === optValue;
        return (
          <button
            key={optValue}
            onClick={() => onChange(optValue)}
            className={`chip${active ? ' active' : ''}`}
            style={{ fontSize: 13, padding: '7px 14px' }}
            type="button"
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

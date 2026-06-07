/**
 * DatePickerField — Styled date input field matching TPS _dateField widget.
 * Shows uppercase label + bordered input with calendar icon.
 *
 * @param {string} label - Section label (uppercase)
 * @param {string} value - YYYY-MM-DD string
 * @param {function} onChange - Called with new YYYY-MM-DD string
 * @param {string} [min] - Min date (YYYY-MM-DD)
 * @param {string} [max] - Max date (YYYY-MM-DD)
 */
export default function DatePickerField({ label, value, onChange, min, max }) {
  return (
    <div className="date-field">
      {label && <span className="date-field-label">{label}</span>}
      <div className="date-field-input">
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
        <span style={{ fontSize: 16, color: 'var(--text-hint)', flexShrink: 0 }}>📅</span>
      </div>
    </div>
  );
}

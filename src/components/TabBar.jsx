/**
 * TabBar — In-screen horizontal tab bar (dark/light variant).
 * Matches TPS AppBar.bottom TabBar with indicator line.
 *
 * @param {Array<{key: string, label: string, count?: number}>} tabs
 * @param {string} active - Currently active tab key
 * @param {function} onChange - Called with tab key
 * @param {'dark'|'light'} [variant] - 'dark' = navy bg (header), 'light' = white bg (in content)
 */
export default function TabBar({ tabs, active, onChange, variant = 'dark' }) {
  return (
    <div className={`tab-bar${variant === 'light' ? ' tab-bar-light' : ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`tab-bar-item${active === tab.key ? ' active' : ''}`}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.label}
          {tab.count != null && tab.count > 0 && (
            <span className="tab-bar-count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

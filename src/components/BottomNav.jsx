export default function BottomNav({ items, active, onNavigate }) {
  return (
    <nav className="bottom-nav" id="bottom-nav">
      {items.map((item) => (
        <button
          key={item.key}
          id={`nav-${item.key}`}
          className={`bottom-nav-item${active === item.key ? ' active' : ''}`}
          onClick={() => onNavigate(item.key)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

import BottomSheet from './BottomSheet.jsx';
import { auth } from '../config/firebase.js';

/**
 * ProfileSheet — Avatar in header + bottom sheet with profile info.
 * Used across all 3 dashboards (Branch Admin, Super Admin, Parent).
 *
 * @param {boolean} open - Sheet visibility
 * @param {function} onClose
 * @param {string} name - Display name
 * @param {string} [phone] - Phone number
 * @param {string} [email] - Email address
 * @param {string} role - Role label string (e.g. 'Branch Admin', 'Super Admin', 'Parent')
 * @param {string} [initials] - Avatar initials fallback (auto-computed from name if omitted)
 * @param {string} [photoUrl] - Optional photo URL
 */
export function ProfileSheet({ open, onClose, name, phone, email, role, initials, photoUrl }) {
  const displayInitials = initials || (name ? name.charAt(0).toUpperCase() : '?');

  async function handleLogout() {
    onClose?.();
    // Brief delay so sheet animates closed before navigate
    setTimeout(async () => {
      await auth.signOut();
      window.location.href = '/login';
    }, 250);
  }

  return (
    <BottomSheet open={open} onClose={onClose} noHandle={false}>
      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 20 }}>
        <div
          className="avatar avatar-xl"
          style={{ width: 80, height: 80, fontSize: 28, marginBottom: 14, overflow: 'hidden' }}
        >
          {photoUrl
            ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : displayInitials
          }
        </div>

        {/* Name */}
        <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-dark)' }}>{name || 'User'}</p>

        {/* Phone / email */}
        {(phone || email) && (
          <p style={{ fontSize: 13, color: 'var(--text-hint)', marginTop: 3 }}>
            {phone || email}
          </p>
        )}

        {/* Role badge */}
        {role && (
          <span
            style={{
              display: 'inline-block',
              marginTop: 10,
              padding: '4px 14px',
              background: 'var(--accent-light)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-full)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--primary)',
            }}
          >
            {role}
          </span>
        )}

        <div style={{ width: '100%', height: 1, background: 'rgba(26,35,64,0.07)', margin: '20px 0' }} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '14px',
            background: 'var(--error-bg)',
            color: 'var(--error)',
            border: '1px solid var(--error-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>🚪</span> Log out
        </button>
      </div>
    </BottomSheet>
  );
}

/**
 * ProfileAvatar — Small 34px circle avatar for header.
 * Tap to open ProfileSheet.
 *
 * @param {string} [initials]
 * @param {string} [photoUrl]
 * @param {function} onClick
 */
export function ProfileAvatar({ initials = '?', photoUrl, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: 'var(--accent-light)',
        color: 'var(--primary)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 12,
        cursor: 'pointer',
        overflow: 'hidden',
        flexShrink: 0,
        fontFamily: 'var(--font)',
        padding: 0,
      }}
      aria-label="Profile"
    >
      {photoUrl
        ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </button>
  );
}

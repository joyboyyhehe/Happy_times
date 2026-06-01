import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import BottomNav from '../../components/BottomNav.jsx';
import { auth } from '../../config/firebase.js';
import {
  getStudentsForParent,
  getStudentAttendanceMonth,
  getFeeRecord, getPaymentHistory,
  getPostsForParent,
} from '../../services/firestore.js';

const CATEGORIES = ['All', 'Announcement', 'Event', 'Holiday', 'Circular', 'General'];

export default function ParentDashboard() {
  const { profile, user } = useAuth();
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(false);

  // Children
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  // Attendance
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [attData, setAttData] = useState({});

  // Fees
  const [feeRecord, setFeeRecord] = useState(null);
  const [payments, setPayments] = useState([]);

  // Posts
  const [posts, setPosts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');

  useEffect(() => {
    if (user) loadChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild && tab === 'attendance') loadAttendance();
    if (selectedChild && tab === 'fees') loadFees();
    if (selectedChild && tab === 'feed') loadPosts();
  }, [selectedChild, tab, attMonth, attYear]);

  async function loadChildren() {
    setLoading(true);
    const kids = await getStudentsForParent(user.uid);
    setChildren(kids);
    if (kids.length > 0) setSelectedChild(kids[0]);
    setLoading(false);
  }

  // ─── Attendance ───
  async function loadAttendance() {
    if (!selectedChild) return;
    setLoading(true);
    const data = await getStudentAttendanceMonth(
      selectedChild.id, selectedChild.branchId, selectedChild.classId, attYear, attMonth
    );
    setAttData(data);
    setLoading(false);
  }

  function getCalendarDays() {
    const firstDay = new Date(attYear, attMonth - 1, 1).getDay();
    const daysInMonth = new Date(attYear, attMonth, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }

  function getMonthStats() {
    let present = 0, absent = 0, late = 0;
    Object.values(attData).forEach(s => {
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'late') late++;
    });
    return { present, absent, late };
  }

  // ─── Fees ───
  async function loadFees() {
    if (!selectedChild) return;
    setLoading(true);
    const [fr, ph] = await Promise.all([
      getFeeRecord(selectedChild.id),
      getPaymentHistory(selectedChild.id),
    ]);
    setFeeRecord(fr);
    setPayments(ph);
    setLoading(false);
  }

  // ─── Posts ───
  async function loadPosts() {
    if (!selectedChild) return;
    setLoading(true);
    const p = await getPostsForParent(selectedChild.branchId, selectedChild.classId);
    setPosts(p);
    setLoading(false);
  }

  function handleLogout() { auth.signOut(); }

  const monthName = new Date(attYear, attMonth - 1).toLocaleString('default', { month: 'long' });
  const stats = getMonthStats();
  const filteredPosts = categoryFilter === 'All' ? posts : posts.filter(p => p.category === categoryFilter);
  const today = new Date().toISOString().slice(0, 10);

  const navItems = [
    { key: 'home', icon: '🏠', label: 'Home' },
    { key: 'attendance', icon: '📅', label: 'Attendance' },
    { key: 'fees', icon: '💰', label: 'Fees' },
    { key: 'feed', icon: '📢', label: 'Feed' },
    { key: 'profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="app-header-glass">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Happy Times Preschool</div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>
              {selectedChild ? `${selectedChild.name}'s Dashboard` : 'Dashboard'}
            </h1>
          </div>
          {/* Child switcher */}
          {children.length > 1 && (
            <select
              value={selectedChild?.id || ''}
              onChange={e => setSelectedChild(children.find(c => c.id === e.target.value))}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
                borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font)',
              }}
            >
              {children.map(c => <option key={c.id} value={c.id} style={{ color: '#1A2340' }}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* ══════════════ HOME TAB ══════════════ */}
        {tab === 'home' && (
          <div className="fade-in">
            {/* Attendance summary */}
            <div className="card mb-16">
              <div className="section-title mb-8">📅 Attendance This Month</div>
              <div className="stat-grid cols-3">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{stats.present}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Present</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--error)' }}>{stats.absent}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Absent</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{stats.late}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Late</div>
                </div>
              </div>
            </div>

            {/* Pending fees */}
            {feeRecord && feeRecord.pending > 0 && (
              <div className="card mb-16" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending Fee</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>₹{feeRecord.pending.toLocaleString()}</div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setTab('fees')}>View →</button>
                </div>
              </div>
            )}

            {/* Latest post */}
            {posts.length > 0 && (
              <div className="card" style={{ cursor: 'pointer' }} onClick={() => setTab('feed')}>
                <div className="section-title mb-8">📢 Latest Announcement</div>
                <span className={`post-category ${posts[0].category?.toLowerCase()}`}>{posts[0].category}</span>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{posts[0].title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{posts[0].body?.slice(0, 100)}...</div>
              </div>
            )}

            {!selectedChild && (
              <div className="empty-state">
                <div className="empty-state-icon">👋</div>
                <div className="empty-state-title">Welcome!</div>
                <div className="empty-state-text">No children linked to your account yet. Contact the school admin.</div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ ATTENDANCE TAB ══════════════ */}
        {tab === 'attendance' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button onClick={() => { if (attMonth === 1) { setAttMonth(12); setAttYear(attYear - 1); } else setAttMonth(attMonth - 1); }} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-mid)', padding: 8 }}>‹</button>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{monthName} {attYear}</h2>
              <button onClick={() => { if (attMonth === 12) { setAttMonth(1); setAttYear(attYear + 1); } else setAttMonth(attMonth + 1); }} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-mid)', padding: 8 }}>›</button>
            </div>

            {/* Summary */}
            <div className="stat-grid cols-3 mb-16">
              <div className="stat-card"><div className="stat-value" style={{ color: 'var(--success)', fontSize: 22 }}>{stats.present}</div><div className="stat-label">Present</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: 'var(--error)', fontSize: 22 }}>{stats.absent}</div><div className="stat-label">Absent</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: 'var(--warning)', fontSize: 22 }}>{stats.late}</div><div className="stat-label">Late</div></div>
            </div>

            {/* Calendar */}
            <div className="calendar-grid">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="calendar-day-header">{d}</div>
              ))}
              {getCalendarDays().map((day, i) => {
                if (day === null) return <div key={i} className="calendar-day empty" />;
                const dateStr = `${attYear}-${String(attMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const status = attData[dateStr];
                const isToday = dateStr === today;
                return (
                  <div key={i} className={`calendar-day ${status || ''} ${isToday ? 'today' : ''}`}>
                    {day}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <span><span className="status-dot present" /> Present</span>
              <span><span className="status-dot absent" /> Absent</span>
              <span><span className="status-dot late" /> Late</span>
            </div>
          </div>
        )}

        {/* ══════════════ FEES TAB ══════════════ */}
        {tab === 'fees' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Fee Details</h2>

            {feeRecord && (
              <div className="stat-grid cols-3 mb-16">
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: 20, color: 'var(--navy)' }}>₹{feeRecord.total.toLocaleString()}</div>
                  <div className="stat-label">Total</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: 20, color: 'var(--success)' }}>₹{feeRecord.paid.toLocaleString()}</div>
                  <div className="stat-label">Paid</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: 20, color: 'var(--primary)' }}>₹{feeRecord.pending.toLocaleString()}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>
            )}

            <div className="section-header">
              <span className="section-title">Payment History</span>
            </div>
            <div className="flex flex-col gap-8">
              {payments.map(p => (
                <div key={p.id} className="list-item">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>₹</div>
                  <div className="list-item-content">
                    <div className="list-item-title">₹{p.amount?.toLocaleString()}</div>
                    <div className="list-item-subtitle">{p.method} {p.notes ? `· ${p.notes}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{p.date?.toDate?.()?.toLocaleDateString?.() || '—'}</div>
                </div>
              ))}
              {payments.length === 0 && <div className="empty-state"><div className="empty-state-text">No payments recorded yet</div></div>}
            </div>
          </div>
        )}

        {/* ══════════════ FEED TAB ══════════════ */}
        {tab === 'feed' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Feed</h2>
            <div className="chip-group mb-16">
              {CATEGORIES.map(c => (
                <button key={c} className={`chip ${categoryFilter === c ? 'active' : ''}`} onClick={() => setCategoryFilter(c)}>
                  {c}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-10">
              {filteredPosts.map(p => (
                <div key={p.id} className="post-card">
                  <span className={`post-category ${p.category?.toLowerCase()}`}>{p.category}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.body}</div>
                  {p.imageUrls?.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto' }}>
                      {p.imageUrls.map((url, i) => (
                        <img key={i} src={url} alt="" style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: 10 }} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>
                    {p.authorName} · {p.timestamp?.toDate?.()?.toLocaleDateString?.() || '—'}
                  </div>
                </div>
              ))}
              {filteredPosts.length === 0 && (
                <div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-title">No posts</div></div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ PROFILE TAB ══════════════ */}
        {tab === 'profile' && (
          <div className="fade-in">
            <div className="profile-section">
              <div className="avatar avatar-lg" style={{ width: 72, height: 72, fontSize: 28 }}>
                {profile?.name?.[0] || user?.phoneNumber?.slice(-2) || '?'}
              </div>
              <div className="profile-name">{profile?.name || 'Parent'}</div>
              <div className="profile-role">{user?.phoneNumber || ''}</div>
            </div>

            <div className="card mb-16">
              <div className="section-title mb-12">Children</div>
              <div className="flex flex-col gap-8">
                {children.map(c => (
                  <div key={c.id} className="list-item">
                    <div className="avatar">{c.name?.[0]}</div>
                    <div className="list-item-content">
                      <div className="list-item-title">{c.name}</div>
                      <div className="list-item-subtitle">{c.classId} · {c.branchId}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn-outline" onClick={handleLogout} style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
              Logout
            </button>
          </div>
        )}
      </div>

      <BottomNav items={navItems} active={tab} onNavigate={setTab} />
    </div>
  );
}

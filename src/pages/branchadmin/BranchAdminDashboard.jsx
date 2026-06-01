import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import BottomNav from '../../components/BottomNav.jsx';
import Modal from '../../components/Modal.jsx';
import { auth } from '../../config/firebase.js';
import {
  getStudents, getBranch,
  getAttendance, setAttendanceRecord, getAttendanceLockTime, isAttendanceLocked,
  getPosts, createPost,
  getLogs, getDashboardStats,
} from '../../services/firestore.js';

const CLASSES = ['Daycare', 'Playgroup', 'Nursery', 'LKG', 'UKG'];
const CATEGORIES = ['Announcement', 'Event', 'Holiday', 'Circular', 'General'];

export default function BranchAdminDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('home');
  const [branch, setBranch] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard
  const [stats, setStats] = useState({ totalStudents: 0 });

  // Attendance
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attRecords, setAttRecords] = useState({});
  const [students, setStudents] = useState([]);
  const [lockTime, setLockTime] = useState('10:00');
  const [locked, setLocked] = useState(false);

  // Posts
  const [posts, setPosts] = useState([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', body: '', category: 'General', scope: 'branch', classId: '' });

  // Logs
  const [logs, setLogs] = useState([]);

  const branchId = profile?.branchId;

  useEffect(() => {
    if (branchId) {
      getBranch(branchId).then(setBranch);
    }
  }, [branchId]);

  useEffect(() => {
    if (tab === 'home' && branchId) loadDashboard();
    if (tab === 'posts' && branchId) loadPosts();
    if (tab === 'activity' && profile) loadLogs();
  }, [tab, branchId]);

  async function loadDashboard() {
    const s = await getDashboardStats(branchId);
    setStats(s);
  }

  // ─── Attendance ───
  async function loadAttendance() {
    if (!selectedClass) { toast.info('Select a class first'); return; }
    setLoading(true);
    try {
      const [studs, records, lt] = await Promise.all([
        getStudents(branchId, selectedClass),
        getAttendance(branchId, selectedClass, attDate),
        getAttendanceLockTime(),
      ]);
      setStudents(studs);
      setAttRecords(records);
      setLockTime(lt);
      setLocked(isAttendanceLocked(lt));
    } catch (e) { toast.error('Failed to load attendance'); }
    setLoading(false);
  }

  async function handleAttToggle(studentId, status) {
    if (locked) return;
    setAttRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
    try {
      await setAttendanceRecord(branchId, selectedClass, attDate, studentId, status);
    } catch (e) { toast.error('Failed to save'); }
  }

  // ─── Posts ───
  async function loadPosts() {
    setLoading(true);
    const p = await getPosts({ branchId });
    setPosts(p);
    setLoading(false);
  }

  async function handleCreatePost() {
    if (!postForm.title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      await createPost({
        ...postForm,
        branchId,
        classId: postForm.scope === 'class' ? postForm.classId : null,
      });
      toast.success('Post published!');
      setShowPostModal(false);
      setPostForm({ title: '', body: '', category: 'General', scope: 'branch', classId: '' });
      loadPosts();
    } catch (e) { toast.error('Failed to create post'); }
    setLoading(false);
  }

  // ─── Logs ───
  async function loadLogs() {
    setLoading(true);
    const l = await getLogs({ actorUid: profile?.id });
    setLogs(l);
    setLoading(false);
  }

  function handleLogout() { auth.signOut(); }

  const navItems = [
    { key: 'home', icon: '🏠', label: 'Home' },
    { key: 'attendance', icon: '📋', label: 'Attendance' },
    { key: 'posts', icon: '📢', label: 'Posts' },
    { key: 'activity', icon: '📝', label: 'My Activity' },
  ];

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="app-header-glass">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Branch Admin</div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{branch?.name || 'Happy Times'}</h1>
          </div>
          <button onClick={handleLogout} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, border: 'none', color: 'white',
          }}>⏻</button>
        </div>
      </div>

      <div className="page-content">
        {/* ══════════════ HOME TAB ══════════════ */}
        {tab === 'home' && (
          <div className="fade-in">
            <div className="stat-grid mb-16">
              <div className="stat-card">
                <div className="stat-value">{stats.totalStudents}</div>
                <div className="stat-label">Students</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success)' }}>—</div>
                <div className="stat-label">Today's Attendance</div>
              </div>
            </div>

            <div className="section-header">
              <span className="section-title">Quick Actions</span>
            </div>
            <div className="quick-actions">
              <button className="quick-action" onClick={() => setTab('attendance')}>
                <div className="quick-action-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>📋</div>
                Take Attendance
              </button>
              <button className="quick-action" onClick={() => setTab('posts')}>
                <div className="quick-action-icon" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>📢</div>
                New Post
              </button>
            </div>

            <div className="section-header mt-20">
              <span className="section-title">Classes</span>
            </div>
            <div className="flex flex-col gap-8">
              {CLASSES.map(c => (
                <div key={c} className="list-item" style={{ cursor: 'pointer' }} onClick={() => { setSelectedClass(c); setTab('attendance'); }}>
                  <div className="avatar" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                    {c[0]}
                  </div>
                  <div className="list-item-content">
                    <div className="list-item-title">{c}</div>
                  </div>
                  <span style={{ color: 'var(--text-hint)', fontSize: 16 }}>›</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════ ATTENDANCE TAB ══════════════ */}
        {tab === 'attendance' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Attendance</h2>

            <div className="flex gap-8 mb-12">
              <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                <option value="">Select Class</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="date" className="input" value={attDate} onChange={e => setAttDate(e.target.value)} />
            </div>

            <button className="btn btn-primary mb-12" onClick={loadAttendance}>Load Students</button>

            {locked && <div className="badge badge-locked mb-12">🔒 Locked at {lockTime}</div>}

            <div className="flex flex-col gap-8">
              {students.map(s => (
                <div key={s.id} className="list-item">
                  <div className="avatar">{s.name?.[0]}</div>
                  <div className="list-item-content">
                    <div className="list-item-title">{s.name}</div>
                  </div>
                  <div className="attendance-toggle">
                    {['present', 'absent', 'late'].map(status => (
                      <button
                        key={status}
                        className={`att-btn ${attRecords[s.id]?.status === status ? `${status}-active` : ''}`}
                        onClick={() => handleAttToggle(s.id, status)}
                        disabled={locked}
                      >
                        {status[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {students.length === 0 && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">Select a class and load</div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ POSTS TAB ══════════════ */}
        {tab === 'posts' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Posts</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPostModal(true)} style={{ width: 'auto' }}>+ New</button>
            </div>

            <div className="flex flex-col gap-10">
              {posts.map(p => (
                <div key={p.id} className="post-card">
                  <span className={`post-category ${p.category?.toLowerCase()}`}>{p.category}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>
                    {p.scope} · {p.timestamp?.toDate?.()?.toLocaleDateString?.() || '—'}
                  </div>
                </div>
              ))}
              {posts.length === 0 && !loading && (
                <div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-title">No posts</div></div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ ACTIVITY TAB ══════════════ */}
        {tab === 'activity' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>My Activity</h2>
            <div className="flex flex-col gap-8">
              {logs.map(l => (
                <div key={l.id} className="list-item">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📝</div>
                  <div className="list-item-content">
                    <div className="list-item-title" style={{ fontSize: 13 }}>{l.actionType}</div>
                    <div className="list-item-subtitle">{l.timestamp?.toDate?.()?.toLocaleString?.() || '—'}</div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <div className="empty-state"><div className="empty-state-text">No activity yet</div></div>}
            </div>
          </div>
        )}
      </div>

      {/* Post Modal */}
      <Modal open={showPostModal} onClose={() => setShowPostModal(false)} title="Create Post">
        <div className="flex flex-col gap-12">
          <div className="input-group">
            <label>Title</label>
            <input className="input" value={postForm.title} onChange={e => setPostForm(p => ({ ...p, title: e.target.value }))} placeholder="Post title" />
          </div>
          <div className="input-group">
            <label>Body</label>
            <textarea className="input" value={postForm.body} onChange={e => setPostForm(p => ({ ...p, body: e.target.value }))} placeholder="Write your announcement..." />
          </div>
          <div className="input-group">
            <label>Category</label>
            <select className="input" value={postForm.category} onChange={e => setPostForm(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Scope</label>
            <select className="input" value={postForm.scope} onChange={e => setPostForm(p => ({ ...p, scope: e.target.value }))}>
              <option value="branch">Entire Branch</option>
              <option value="class">Specific Class</option>
            </select>
          </div>
          {postForm.scope === 'class' && (
            <div className="input-group">
              <label>Class</label>
              <select className="input" value={postForm.classId} onChange={e => setPostForm(p => ({ ...p, classId: e.target.value }))}>
                <option value="">Select Class</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={handleCreatePost} disabled={loading}>
            {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Publish'}
          </button>
        </div>
      </Modal>

      <BottomNav items={navItems} active={tab} onNavigate={setTab} />
    </div>
  );
}

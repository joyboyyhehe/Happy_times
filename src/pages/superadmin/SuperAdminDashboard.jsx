import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import BottomNav from '../../components/BottomNav.jsx';
import Modal from '../../components/Modal.jsx';
import { auth } from '../../config/firebase.js';
import {
  getBranches, getStudents, getStudent, addStudent, updateStudent, deleteStudent,
  getAttendance, setAttendanceRecord, getAttendanceLockTime, setAttendanceLockTime, isAttendanceLocked,
  getFeeRecord, setFeeTotal, addPayment, getPaymentHistory,
  getPosts, createPost, deletePost,
  getLogs, getDashboardStats,
} from '../../services/firestore.js';

const CLASSES = ['Daycare', 'Playgroup', 'Nursery', 'LKG', 'UKG'];
const CATEGORIES = ['Announcement', 'Event', 'Holiday', 'Circular', 'General'];
const PAY_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('home');
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard stats
  const [stats, setStats] = useState({ totalStudents: 0, totalPending: 0 });

  // Attendance state
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attRecords, setAttRecords] = useState({});
  const [students, setStudents] = useState([]);
  const [lockTime, setLockTime] = useState('10:00');
  const [locked, setLocked] = useState(false);

  // Fees state
  const [feeSearch, setFeeSearch] = useState('');
  const [feeStudents, setFeeStudents] = useState([]);
  const [selectedFeeStudent, setSelectedFeeStudent] = useState(null);
  const [feeRecord, setFeeRecord] = useState(null);
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'Cash', notes: '' });
  const [showFeeSetModal, setShowFeeSetModal] = useState(false);
  const [feeSetForm, setFeeSetForm] = useState({ total: '', dueDate: '' });

  // Posts state
  const [posts, setPosts] = useState([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', body: '', category: 'General', scope: 'all', branchId: '', classId: '', images: [] });

  // Students state
  const [studentSearch, setStudentSearch] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: '', dob: '', branchId: '', classId: '', phone1: '', phone2: '' });
  const [selectedStudentProfile, setSelectedStudentProfile] = useState(null);

  // Logs state
  const [logs, setLogs] = useState([]);

  // Settings
  const [lockTimeInput, setLockTimeInput] = useState('10:00');

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (tab === 'home') loadDashboard();
    if (tab === 'posts') loadPosts();
    if (tab === 'logs') loadLogs();
  }, [tab]);

  async function loadBranches() {
    const b = await getBranches();
    setBranches(b);
    if (b.length > 0 && !selectedBranch) setSelectedBranch(b[0].id);
  }

  async function loadDashboard() {
    try {
      const s = await getDashboardStats();
      setStats(s);
      const lt = await getAttendanceLockTime();
      setLockTime(lt);
      setLockTimeInput(lt);
    } catch (e) { console.error(e); }
  }

  // ─── Attendance ───
  async function loadAttendance() {
    if (!selectedBranch || !selectedClass) return;
    setLoading(true);
    try {
      const [studs, records, lt] = await Promise.all([
        getStudents(selectedBranch, selectedClass),
        getAttendance(selectedBranch, selectedClass, attDate),
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
      await setAttendanceRecord(selectedBranch, selectedClass, attDate, studentId, status);
    } catch (e) { toast.error('Failed to save'); }
  }

  // ─── Fees ───
  async function searchFeeStudents() {
    if (!feeSearch.trim()) return;
    setLoading(true);
    const all = await getStudents();
    const filtered = all.filter(s => s.name?.toLowerCase().includes(feeSearch.toLowerCase()));
    setFeeStudents(filtered);
    setLoading(false);
  }

  async function selectFeeStudent(s) {
    setSelectedFeeStudent(s);
    const [fr, ph] = await Promise.all([getFeeRecord(s.id), getPaymentHistory(s.id)]);
    setFeeRecord(fr);
    setPayments(ph);
  }

  async function handleAddPayment() {
    if (!payForm.amount || Number(payForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setLoading(true);
    try {
      await addPayment(selectedFeeStudent.id, payForm);
      toast.success('Payment recorded!');
      setShowPaymentModal(false);
      setPayForm({ amount: '', method: 'Cash', notes: '' });
      const [fr, ph] = await Promise.all([getFeeRecord(selectedFeeStudent.id), getPaymentHistory(selectedFeeStudent.id)]);
      setFeeRecord(fr);
      setPayments(ph);
    } catch (e) { toast.error('Failed to add payment'); }
    setLoading(false);
  }

  async function handleSetFee() {
    if (!feeSetForm.total || Number(feeSetForm.total) <= 0) { toast.error('Enter valid total'); return; }
    setLoading(true);
    try {
      await setFeeTotal(selectedFeeStudent.id, Number(feeSetForm.total), feeSetForm.dueDate || null);
      toast.success('Fee total updated!');
      setShowFeeSetModal(false);
      const fr = await getFeeRecord(selectedFeeStudent.id);
      setFeeRecord(fr);
    } catch (e) { toast.error('Failed to set fee'); }
    setLoading(false);
  }

  // ─── Posts ───
  async function loadPosts() {
    setLoading(true);
    const p = await getPosts();
    setPosts(p);
    setLoading(false);
  }

  async function handleCreatePost() {
    if (!postForm.title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      await createPost(postForm);
      toast.success('Post published!');
      setShowPostModal(false);
      setPostForm({ title: '', body: '', category: 'General', scope: 'all', branchId: '', classId: '', images: [] });
      loadPosts();
    } catch (e) { toast.error('Failed to create post'); }
    setLoading(false);
  }

  async function handleDeletePost(postId) {
    if (!confirm('Delete this post?')) return;
    await deletePost(postId);
    toast.success('Post deleted');
    loadPosts();
  }

  // ─── Students ───
  async function loadStudents() {
    setLoading(true);
    const filters = {};
    const studs = await getStudents(selectedBranch || null, selectedClass || null);
    setAllStudents(studs);
    setLoading(false);
  }

  async function handleAddStudent() {
    if (!studentForm.name || !studentForm.branchId || !studentForm.classId) { toast.error('Fill required fields'); return; }
    setLoading(true);
    try {
      await addStudent(studentForm);
      toast.success('Student added!');
      setShowStudentModal(false);
      setStudentForm({ name: '', dob: '', branchId: '', classId: '', phone1: '', phone2: '' });
      loadStudents();
    } catch (e) { toast.error('Failed to add student'); }
    setLoading(false);
  }

  // ─── Logs ───
  async function loadLogs() {
    setLoading(true);
    const l = await getLogs({ limitCount: 100 });
    setLogs(l);
    setLoading(false);
  }

  // ─── Settings ───
  async function handleSaveLockTime() {
    await setAttendanceLockTime(lockTimeInput);
    setLockTime(lockTimeInput);
    toast.success('Lock time updated!');
  }

  function handleLogout() {
    auth.signOut();
  }

  const navItems = [
    { key: 'home', icon: '🏠', label: 'Home' },
    { key: 'attendance', icon: '📋', label: 'Attendance' },
    { key: 'fees', icon: '💰', label: 'Fees' },
    { key: 'posts', icon: '📢', label: 'Posts' },
    { key: 'more', icon: '⋯', label: 'More' },
  ];

  const [moreTab, setMoreTab] = useState('students'); // students | logs | settings

  const filteredStudents = allStudents.filter(s =>
    !studentSearch || s.name?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="app-header-glass">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Super Admin</div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Happy Times</h1>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700,
          }}>
            {profile?.name?.[0] || 'SA'}
          </div>
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
                <div className="stat-value" style={{ color: 'var(--primary)' }}>₹{(stats.totalPending || 0).toLocaleString()}</div>
                <div className="stat-label">Pending Fees</div>
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
              <button className="quick-action" onClick={() => setTab('fees')}>
                <div className="quick-action-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>💰</div>
                Record Payment
              </button>
              <button className="quick-action" onClick={() => { setTab('more'); setMoreTab('students'); }}>
                <div className="quick-action-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>👨‍🎓</div>
                Add Student
              </button>
              <button className="quick-action" onClick={() => setTab('posts')}>
                <div className="quick-action-icon" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>📢</div>
                New Post
              </button>
            </div>

            <div className="section-header mt-20">
              <span className="section-title">Branches</span>
            </div>
            <div className="flex flex-col gap-8">
              {branches.map(b => (
                <div key={b.id} className="list-item">
                  <div className="avatar" style={{ background: 'var(--accent-light)', color: 'var(--primary)' }}>
                    {b.name?.[0]}
                  </div>
                  <div className="list-item-content">
                    <div className="list-item-title">{b.name}</div>
                    <div className="list-item-subtitle">5 classes</div>
                  </div>
                </div>
              ))}
              {branches.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">🏫</div>
                  <div className="empty-state-title">No branches yet</div>
                  <div className="empty-state-text">Add branches in Firestore to get started</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ ATTENDANCE TAB ══════════════ */}
        {tab === 'attendance' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Attendance</h2>

            <div className="flex gap-8 mb-12">
              <select className="input" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                <option value="">Select Class</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex gap-8 mb-12 items-center">
              <input type="date" className="input" value={attDate} onChange={e => setAttDate(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={loadAttendance} style={{ width: 'auto' }}>Load</button>
            </div>

            {locked && <div className="badge badge-locked mb-12">🔒 Locked at {lockTime}</div>}

            {students.length > 0 && (
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
            )}

            {students.length === 0 && !loading && selectedBranch && selectedClass && (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No students found</div>
                <div className="empty-state-text">Select a branch and class, then click Load</div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ FEES TAB ══════════════ */}
        {tab === 'fees' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Fees</h2>

            {!selectedFeeStudent ? (
              <>
                <div className="flex gap-8 mb-16">
                  <div className="search-bar" style={{ flex: 1 }}>
                    <span className="search-icon">🔍</span>
                    <input
                      placeholder="Search student by name..."
                      value={feeSearch}
                      onChange={e => setFeeSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchFeeStudents()}
                    />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={searchFeeStudents} style={{ width: 'auto' }}>Search</button>
                </div>

                <div className="flex flex-col gap-8">
                  {feeStudents.map(s => (
                    <button key={s.id} className="list-item" onClick={() => selectFeeStudent(s)} style={{ cursor: 'pointer' }}>
                      <div className="avatar">{s.name?.[0]}</div>
                      <div className="list-item-content">
                        <div className="list-item-title">{s.name}</div>
                        <div className="list-item-subtitle">{s.classId} · {s.branchId}</div>
                      </div>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        ₹{((s.feeTotal || 0) - (s.feePaid || 0)).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setSelectedFeeStudent(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
                  ← Back to search
                </button>

                <div className="card mb-16">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div className="avatar avatar-lg">{selectedFeeStudent.name?.[0]}</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedFeeStudent.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedFeeStudent.classId} · {selectedFeeStudent.branchId}</div>
                    </div>
                  </div>

                  {feeRecord && (
                    <div className="stat-grid cols-3">
                      <div className="stat-card">
                        <div className="stat-value fee-total" style={{ fontSize: 20, color: 'var(--navy)' }}>₹{feeRecord.total.toLocaleString()}</div>
                        <div className="stat-label">Total</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value fee-paid" style={{ fontSize: 20, color: 'var(--success)' }}>₹{feeRecord.paid.toLocaleString()}</div>
                        <div className="stat-label">Paid</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value fee-pending" style={{ fontSize: 20, color: 'var(--primary)' }}>₹{feeRecord.pending.toLocaleString()}</div>
                        <div className="stat-label">Pending</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-8 mb-16">
                  <button className="btn btn-primary btn-sm" onClick={() => setShowPaymentModal(true)} style={{ flex: 1 }}>+ Add Payment</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowFeeSetModal(true)} style={{ flex: 1 }}>Set Fee Total</button>
                </div>

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
                  {payments.length === 0 && <div className="empty-state"><div className="empty-state-text">No payments yet</div></div>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════ POSTS TAB ══════════════ */}
        {tab === 'posts' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Posts</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPostModal(true)} style={{ width: 'auto' }}>+ New Post</button>
            </div>

            <div className="flex flex-col gap-10">
              {posts.map(p => (
                <div key={p.id} className="post-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span className={`post-category ${p.category?.toLowerCase()}`}>{p.category}</span>
                    <button onClick={() => handleDeletePost(p.id)} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-hint)' }}>🗑</button>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{p.body}</div>
                  {p.imageUrls?.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                      {p.imageUrls.map((url, i) => (
                        <img key={i} src={url} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>
                    {p.authorName} · {p.scope} · {p.timestamp?.toDate?.()?.toLocaleDateString?.() || '—'}
                  </div>
                </div>
              ))}
              {posts.length === 0 && !loading && (
                <div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-title">No posts yet</div></div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ MORE TAB ══════════════ */}
        {tab === 'more' && (
          <div className="fade-in">
            <div className="chip-group mb-16">
              {['students', 'logs', 'settings'].map(t => (
                <button key={t} className={`chip ${moreTab === t ? 'active' : ''}`} onClick={() => { setMoreTab(t); if (t === 'students') loadStudents(); if (t === 'logs') loadLogs(); }}>
                  {t === 'students' ? '👨‍🎓 Students' : t === 'logs' ? '📝 Logs' : '⚙ Settings'}
                </button>
              ))}
            </div>

            {/* Students Sub-tab */}
            {moreTab === 'students' && (
              <>
                <div className="flex gap-8 mb-12">
                  <div className="search-bar" style={{ flex: 1 }}>
                    <span className="search-icon">🔍</span>
                    <input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowStudentModal(true)} style={{ width: 'auto' }}>+ Add</button>
                </div>

                <div className="flex gap-8 mb-12">
                  <select className="input" value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); }} style={{ fontSize: 13 }}>
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ fontSize: 13 }}>
                    <option value="">All Classes</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="btn btn-outline btn-sm" onClick={loadStudents} style={{ width: 'auto' }}>Go</button>
                </div>

                <div className="flex flex-col gap-8">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="list-item">
                      <div className="avatar">{s.name?.[0]}</div>
                      <div className="list-item-content">
                        <div className="list-item-title">{s.name}</div>
                        <div className="list-item-subtitle">{s.classId} · {s.branchId}</div>
                      </div>
                    </div>
                  ))}
                  {filteredStudents.length === 0 && !loading && (
                    <div className="empty-state"><div className="empty-state-icon">👨‍🎓</div><div className="empty-state-title">No students</div><div className="empty-state-text">Add students or adjust filters</div></div>
                  )}
                </div>
              </>
            )}

            {/* Logs Sub-tab */}
            {moreTab === 'logs' && (
              <div className="flex flex-col gap-8">
                {logs.map(l => (
                  <div key={l.id} className="list-item">
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📝</div>
                    <div className="list-item-content">
                      <div className="list-item-title" style={{ fontSize: 13 }}>{l.actionType}</div>
                      <div className="list-item-subtitle">{l.actorEmail || l.actorUid} · {l.timestamp?.toDate?.()?.toLocaleString?.() || '—'}</div>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <div className="empty-state"><div className="empty-state-text">No logs yet</div></div>}
              </div>
            )}

            {/* Settings Sub-tab */}
            {moreTab === 'settings' && (
              <div className="flex flex-col gap-16">
                <div className="card">
                  <div className="section-title mb-12">Attendance Lock Time</div>
                  <div className="flex gap-8 items-center">
                    <input type="time" className="input" value={lockTimeInput} onChange={e => setLockTimeInput(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-primary btn-sm" onClick={handleSaveLockTime} style={{ width: 'auto' }}>Save</button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 8 }}>Attendance editing is disabled after this time daily</div>
                </div>

                <button className="btn btn-outline" onClick={handleLogout} style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Add Payment">
        <div className="flex flex-col gap-12">
          <div className="input-group">
            <label>Amount (₹)</label>
            <input className="input" type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
          </div>
          <div className="input-group">
            <label>Method</label>
            <select className="input" value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}>
              {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Notes (optional)</label>
            <input className="input" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Term 2 partial" />
          </div>
          <button className="btn btn-primary" onClick={handleAddPayment} disabled={loading}>
            {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Record Payment'}
          </button>
        </div>
      </Modal>

      <Modal open={showFeeSetModal} onClose={() => setShowFeeSetModal(false)} title="Set Fee Total">
        <div className="flex flex-col gap-12">
          <div className="input-group">
            <label>Total Fee (₹)</label>
            <input className="input" type="number" value={feeSetForm.total} onChange={e => setFeeSetForm(p => ({ ...p, total: e.target.value }))} placeholder="50000" />
          </div>
          <div className="input-group">
            <label>Due Date (optional)</label>
            <input className="input" type="date" value={feeSetForm.dueDate} onChange={e => setFeeSetForm(p => ({ ...p, dueDate: e.target.value }))} />
          </div>
          <button className="btn btn-primary" onClick={handleSetFee} disabled={loading}>Save</button>
        </div>
      </Modal>

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
              <option value="all">All Branches</option>
              <option value="branch">Specific Branch</option>
              <option value="class">Specific Class</option>
            </select>
          </div>
          {(postForm.scope === 'branch' || postForm.scope === 'class') && (
            <div className="input-group">
              <label>Branch</label>
              <select className="input" value={postForm.branchId} onChange={e => setPostForm(p => ({ ...p, branchId: e.target.value }))}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
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
            {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Publish Post'}
          </button>
        </div>
      </Modal>

      <Modal open={showStudentModal} onClose={() => setShowStudentModal(false)} title="Add Student">
        <div className="flex flex-col gap-12">
          <div className="input-group">
            <label>Full Name</label>
            <input className="input" value={studentForm.name} onChange={e => setStudentForm(p => ({ ...p, name: e.target.value }))} placeholder="Student name" />
          </div>
          <div className="input-group">
            <label>Date of Birth</label>
            <input className="input" type="date" value={studentForm.dob} onChange={e => setStudentForm(p => ({ ...p, dob: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Branch</label>
            <select className="input" value={studentForm.branchId} onChange={e => setStudentForm(p => ({ ...p, branchId: e.target.value }))}>
              <option value="">Select Branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Class</label>
            <select className="input" value={studentForm.classId} onChange={e => setStudentForm(p => ({ ...p, classId: e.target.value }))}>
              <option value="">Select Class</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleAddStudent} disabled={loading}>
            {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Add Student'}
          </button>
        </div>
      </Modal>

      <BottomNav items={navItems} active={tab} onNavigate={setTab} />
    </div>
  );
}

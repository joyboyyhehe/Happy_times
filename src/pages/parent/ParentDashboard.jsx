import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import BottomNav from '../../components/BottomNav.jsx';
import Modal from '../../components/Modal.jsx';
import InstallBanner from '../../components/InstallBanner.jsx';
import { auth } from '../../config/firebase.js';
import { logout } from '../../services/authService.js';
import {
  getStudentsForParent,
  getStudentAttendanceMonth,
  getFeeRecord, getPaymentHistory,
  getPostsForParent,
  updateStudent,
} from '../../services/firestore.js';
import Skeleton from '../../components/Skeleton.jsx';
import AppLogo from '../../components/AppLogo.jsx';

// Shared Components & Hooks
import { useLeaves } from '../../hooks/useLeaves.js';
import TabBar from '../../components/TabBar.jsx';
import ChipSelect from '../../components/ChipSelect.jsx';
import DatePickerField from '../../components/DatePickerField.jsx';
import ExpandableCard from '../../components/ExpandableCard.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { ProfileAvatar, ProfileSheet } from '../../components/ProfileSheet.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import LinkifyText from '../../components/LinkifyText.jsx';

const CATEGORIES = ['All', 'Announcement', 'Event', 'Holiday', 'Circular', 'General'];

export default function ParentDashboard() {
  const { profile, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const updateSyncTime = () => setLastSynced(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  const latestRequest = useRef(0);

  // Modals state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: '5', comment: '' });
  const [activeStudentProfile, setActiveStudentProfile] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ dob: '', bloodGroup: '', medicalNotes: '', phone2: '' });

  async function handleProfileSave(e) {
    e.preventDefault();
    if (!activeStudentProfile) return;
    setLoading(true);
    try {
      await updateStudent(activeStudentProfile.id, editForm);
      toast.success('Child profile updated successfully!');
      
      const updatedChild = { ...activeStudentProfile, ...editForm };
      setActiveStudentProfile(updatedChild);
      setChildren(children.map(c => c.id === activeStudentProfile.id ? updatedChild : c));
      if (selectedChild && selectedChild.id === activeStudentProfile.id) {
        setSelectedChild(updatedChild);
      }
      setIsEditingProfile(false);
    } catch (err) {
      console.error('Error updating child profile:', err);
      toast.error('Failed to save profile updates.');
    } finally {
      setLoading(false);
    }
  }

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedbackForm.comment.trim()) {
      toast.error('Please enter a feedback message');
      return;
    }
    toast.success('Thank you for your feedback!');
    setShowFeedback(false);
    setFeedbackForm({ rating: '5', comment: '' });
  };

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
    if (selectedChild) {
      loadDashboardData(selectedChild);
    }
  }, [selectedChild]);

  useEffect(() => {
    if (selectedChild && tab === 'attendance') {
      loadAttendance();
    }
  }, [attMonth, attYear]);

  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [activePostDetail, setActivePostDetail] = useState(null);

  // Leaves
  const [leaveTab, setLeaveTab] = useState('apply');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    studentId: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reason: '🤒 Illness',
    notes: '',
  });

  const { leaves, loading: leavesLoading, submitLeave, reload: reloadLeaves } = useLeaves({
    mode: 'parent',
    parentUid: user?.uid,
  });

  useEffect(() => {
    if (tab === 'leaves' && user?.uid) {
      reloadLeaves();
    }
  }, [tab, user]);

  useEffect(() => {
    if (selectedChild) {
      setLeaveForm(prev => ({ ...prev, studentId: selectedChild.id }));
    }
  }, [selectedChild]);

  const calculateDays = (from, to) => {
    if (!from || !to) return 0;
    const f = new Date(from);
    const t = new Date(to);
    const diff = t.getTime() - f.getTime();
    if (diff < 0) return 0;
    return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  async function handleLeaveSubmit() {
    const child = children.find(c => c.id === leaveForm.studentId) || selectedChild;
    if (!child) return;
    setSubmittingLeave(true);
    try {
      const res = await submitLeave({
        studentId: child.id,
        studentName: child.name,
        parentUid: user.uid,
        parentName: profile?.name || 'Parent',
        branchId: child.branchId,
        classId: child.classId,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: `${leaveForm.reason}${leaveForm.notes ? ` — ${leaveForm.notes}` : ''}`,
      });
      if (res.success) {
        toast.success('Leave request submitted successfully!');
        setLeaveForm(prev => ({
          ...prev,
          notes: '',
          fromDate: new Date().toISOString().slice(0, 10),
          toDate: new Date().toISOString().slice(0, 10),
        }));
        setLeaveTab('history');
      } else {
        toast.error(res.error || 'Failed to submit leave');
      }
    } catch (e) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setSubmittingLeave(false);
    }
  }

  async function loadDashboardData(child) {
    if (!child) return;
    latestRequest.current += 1;
    const reqId = latestRequest.current;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getStudentAttendanceMonth(child.id, child.branchId, child.classId, attYear, attMonth),
        getFeeRecord(child.id),
        getPaymentHistory(child.id),
        getPostsForParent(child.branchId, child.classId),
      ]);
      
      if (latestRequest.current !== reqId) return;

      const att = results[0].status === 'fulfilled' ? results[0].value : {};
      const fr = results[1].status === 'fulfilled' ? results[1].value : null;
      const ph = results[2].status === 'fulfilled' ? results[2].value : [];
      const p = results[3].status === 'fulfilled' ? results[3].value : [];

      if (results[0].status === 'rejected') console.error('[ParentDashboard] Attendance fetch error:', results[0].reason);
      if (results[1].status === 'rejected') console.error('[ParentDashboard] Fee record fetch error:', results[1].reason);
      if (results[2].status === 'rejected') console.error('[ParentDashboard] Payment history fetch error:', results[2].reason);
      if (results[3].status === 'rejected') console.error('[ParentDashboard] Posts fetch error:', results[3].reason);

      setAttData(att || {});
      setFeeRecord(fr || null);
      setPayments(ph || []);
      setPosts(p || []);
      updateSyncTime();
    } catch (e) {
      console.error('[ParentDashboard] Error loading dashboard data:', e);
      toast.error('Failed to load child updates. Offline data will be displayed.');
    } finally {
      if (latestRequest.current === reqId) {
        setLoading(false);
      }
    }
  }

  async function loadChildren() {
    setLoading(true);
    try {
      const kids = await getStudentsForParent(user.uid);
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0]);
      updateSyncTime();
    } catch (e) {
      console.error('[ParentDashboard] Error loading children:', e);
    } finally {
      setLoading(false);
    }
  }

  // ─── Attendance ───
  async function loadAttendance() {
    if (!selectedChild) return;
    latestRequest.current += 1;
    const reqId = latestRequest.current;
    setLoading(true);
    try {
      const data = await getStudentAttendanceMonth(
        selectedChild.id, selectedChild.branchId, selectedChild.classId, attYear, attMonth
      );
      if (latestRequest.current !== reqId) return;
      setAttData(data || {});
      updateSyncTime();
    } catch (e) {
      console.error('[ParentDashboard] Error loading attendance:', e);
    } finally {
      if (latestRequest.current === reqId) {
        setLoading(false);
      }
    }
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
    latestRequest.current += 1;
    const reqId = latestRequest.current;
    setLoading(true);
    try {
      const [fr, ph] = await Promise.all([
        getFeeRecord(selectedChild.id),
        getPaymentHistory(selectedChild.id),
      ]);
      if (latestRequest.current !== reqId) return;
      setFeeRecord(fr || null);
      setPayments(ph || []);
      updateSyncTime();
    } catch (e) {
      console.error('[ParentDashboard] Error loading fees:', e);
    } finally {
      if (latestRequest.current === reqId) {
        setLoading(false);
      }
    }
  }

  // ─── Posts ───
  async function loadPosts() {
    if (!selectedChild) return;
    latestRequest.current += 1;
    const reqId = latestRequest.current;
    setLoading(true);
    try {
      const p = await getPostsForParent(selectedChild.branchId, selectedChild.classId);
      if (latestRequest.current !== reqId) return;
      setPosts(p || []);
      updateSyncTime();
    } catch (e) {
      console.error('[ParentDashboard] Error loading posts:', e);
    } finally {
      if (latestRequest.current === reqId) {
        setLoading(false);
      }
    }
  }

  function handleLogout() { setShowLogoutConfirm(true); }

  const monthName = new Date(attYear, attMonth - 1).toLocaleString('default', { month: 'long' });
  const stats = getMonthStats();
  const filteredPosts = categoryFilter === 'All' ? posts : posts.filter(p => p.category === categoryFilter);
  const today = new Date().toISOString().slice(0, 10);

  const navItems = [
    { key: 'home', icon: '🏠', label: 'Home' },
    { key: 'attendance', icon: '📅', label: 'Attendance' },
    { key: 'leaves', icon: '📝', label: 'Leaves' },
    { key: 'fees', icon: '💰', label: 'Fees' },
    { key: 'feed', icon: '📢', label: 'Feed' },
    { key: 'profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="app-header-glass">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppLogo variant="header" />
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Happy Times Preschool</div>
              <h1
                style={{ fontSize: 18, fontWeight: 700, cursor: selectedChild ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => selectedChild && setActiveStudentProfile(selectedChild)}
                title={selectedChild ? "Click to view student details" : ""}
              >
                Parent Portal
                {selectedChild && <span style={{ fontSize: 13, opacity: 0.7 }}>({selectedChild.name}) ℹ️</span>}
              </h1>
              {lastSynced && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><span>🔄</span> Synced at {lastSynced}</div>}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <ProfileAvatar
              initials={profile?.name?.[0]}
              onClick={() => setShowProfileSheet(true)}
            />
          </div>
        </div>
      </div>

      <div className="page-content">
        <InstallBanner />
        {/* ══════════════ HOME TAB ══════════════ */}
        {tab === 'home' && (() => {
          const totalDays = stats.present + stats.absent + stats.late;
          const attendanceRate = totalDays > 0 ? Math.round(((stats.present + stats.late) / totalDays) * 100) : 100;
          return (
            <div className="fade-in">
              {/* Premium Welcome Banner */}
              <div className="welcome-banner">
                <div className="welcome-banner-content">
                  <span className="welcome-wave">👋</span>
                  <div className="welcome-text-group">
                    <h2 className="welcome-title">Hello, {profile?.name || 'Parent'}!</h2>
                    <p className="welcome-subtitle">
                      {selectedChild 
                        ? `${selectedChild.name} is enrolled in ${selectedChild.classId} (${selectedChild.branchId} branch).`
                        : 'Manage your child\'s school profiles and updates.'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedChild ? (
                <>
                  {/* SLCM Card Grid (3x2) */}
                  <div className="slcm-card-grid">
                    {/* Card 1: Attendance */}
                    <div className="slcm-card" onClick={() => setTab('attendance')}>
                      <div className="slcm-card-icon-wrapper slcm-icon-attendance">
                        <span>📅</span>
                      </div>
                      <div className="slcm-card-content">
                        <div className="slcm-card-label">Attendance</div>
                        <div className="slcm-card-val">{attendanceRate}%</div>
                        <div className="slcm-card-desc">{stats.present} Present · {stats.absent} Absent</div>
                      </div>
                    </div>

                    {/* Card 2: Fees */}
                    <div className="slcm-card" onClick={() => setTab('fees')}>
                      <div className="slcm-card-icon-wrapper slcm-icon-fees">
                        <span>💰</span>
                      </div>
                      <div className="slcm-card-content">
                        <div className="slcm-card-label">Fees</div>
                        <div className="slcm-card-val">
                          {feeRecord ? `₹${feeRecord.pending.toLocaleString()}` : '₹0'}
                        </div>
                        <div className="slcm-card-desc">
                          {feeRecord && feeRecord.pending > 0 ? 'Pending Dues' : 'Fully Paid ✓'}
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Announcements */}
                    <div className="slcm-card" onClick={() => { setTab('feed'); setCategoryFilter('Announcement'); }}>
                      <div className="slcm-card-icon-wrapper slcm-icon-announcements">
                        <span>📢</span>
                      </div>
                      <div className="slcm-card-content">
                        <div className="slcm-card-label">Announcements</div>
                        <div className="slcm-card-val">
                          {posts.filter(p => p.category === 'Announcement' || p.category === 'Circular').length}
                        </div>
                        <div className="slcm-card-desc">Circulars &amp; Notices</div>
                      </div>
                    </div>

                    {/* Card 4: Gallery */}
                    <div className="slcm-card" onClick={() => { setTab('feed'); setCategoryFilter('Event'); }}>
                      <div className="slcm-card-icon-wrapper slcm-icon-gallery">
                        <span>🖼️</span>
                      </div>
                      <div className="slcm-card-content">
                        <div className="slcm-card-label">Gallery</div>
                        <div className="slcm-card-val">
                          {posts.reduce((acc, p) => acc + (p.imageUrls?.length || 0), 0)}
                        </div>
                        <div className="slcm-card-desc">Activity Photos</div>
                      </div>
                    </div>

                    {/* Card 5: Notifications */}
                    <div className="slcm-card" onClick={() => setTab('feed')}>
                      <div className="slcm-card-icon-wrapper slcm-icon-notifications">
                        <span>🔔</span>
                      </div>
                      <div className="slcm-card-content">
                        <div className="slcm-card-label">Notifications</div>
                        <div className="slcm-card-val">{posts.length}</div>
                        <div className="slcm-card-desc">Recent Updates</div>
                      </div>
                    </div>

                    {/* Card 6: Apply Leave */}
                    <div className="slcm-card" onClick={() => { setTab('leaves'); setLeaveTab('apply'); }}>
                      <div className="slcm-card-icon-wrapper slcm-icon-leave">
                        <span>📝</span>
                      </div>
                      <div className="slcm-card-content">
                        <div className="slcm-card-label">Apply Leave</div>
                        <div className="slcm-card-val">{leaves.length}</div>
                        <div className="slcm-card-desc">
                          {leaves.filter(l => l.status === 'pending').length} Pending Approval
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pending Fees Alert Banner */}
                  {feeRecord && feeRecord.pending > 0 && (
                    <div className="slcm-alert-banner" onClick={() => setTab('fees')}>
                      <div className="slcm-alert-banner-text">
                        <strong>💳 Pending Fee Payment:</strong> You have an outstanding balance of <strong>₹{feeRecord.pending.toLocaleString()}</strong>. Tap to view payment options.
                      </div>
                      <span className="slcm-alert-banner-arrow">→</span>
                    </div>
                  )}

                  {/* Recent Activity Section */}
                  <div className="section-header">
                    <span className="section-title">📢 Latest Announcements</span>
                    <button onClick={() => setTab('feed')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>See all</button>
                  </div>
                  <div className="flex flex-col gap-10" style={{ marginBottom: 16 }}>
                    {posts.slice(0, 2).map(p => (
                      <div 
                        key={p.id} 
                        className="post-card" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => setActivePostDetail(p)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span className={`post-cat-badge ${p.category?.toLowerCase()}`}>{p.category}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                            {p.timestamp?.toDate?.()?.toLocaleDateString?.('en-IN', { day: 'numeric', month: 'short' }) || '—'}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {p.body?.length > 120 ? `${p.body.slice(0, 120)}...` : p.body}
                        </div>
                      </div>
                    ))}
                    {posts.length === 0 && (
                      <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No announcements posted yet.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">👋</div>
                  <div className="empty-state-title">Welcome!</div>
                  <div className="empty-state-text">No children linked to your account yet. Contact the school admin.</div>
                </div>
              )}
            </div>
          );
        })()}

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

            {feeRecord && feeRecord.pending > 0 && (
              <button
                className="btn btn-primary w-full mb-16"
                onClick={() => setShowPaymentModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                  boxShadow: '0 4px 12px rgba(232, 69, 26, 0.25)',
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '600'
                }}
              >
                <span>💳</span> Pay Pending Fees Online
              </button>
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

        {/* ══════════════ LEAVES TAB ══════════════ */}
        {tab === 'leaves' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Leave Requests</h2>
            
            <TabBar
              tabs={[
                { key: 'apply', label: 'Apply Leave' },
                { key: 'history', label: 'Leave History' }
              ]}
              active={leaveTab}
              onChange={setLeaveTab}
              variant="light"
            />

            <div style={{ marginTop: 16 }}>
              {/* Apply Tab */}
              {leaveTab === 'apply' && (
                <div className="card">
                  <div className="section-title mb-12">Submit Leave Request</div>
                  
                  {/* Child selection */}
                  <div className="input-group mb-12">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-hint)', marginBottom: 4 }}>Select Child</label>
                    <select
                      className="input"
                      value={leaveForm.studentId}
                      onChange={e => setLeaveForm(prev => ({ ...prev, studentId: e.target.value }))}
                    >
                      {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="mb-12">
                    <DatePickerField
                      label="From Date"
                      value={leaveForm.fromDate}
                      onChange={val => setLeaveForm(prev => ({ ...prev, fromDate: val }))}
                    />
                    <DatePickerField
                      label="To Date"
                      value={leaveForm.toDate}
                      onChange={val => setLeaveForm(prev => ({ ...prev, toDate: val }))}
                    />
                  </div>

                  {/* Duration Badge */}
                  {(() => {
                    const days = calculateDays(leaveForm.fromDate, leaveForm.toDate);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Duration:</span>
                        <span className="badge" style={{
                          background: days > 0 ? 'var(--accent-light)' : 'var(--error-bg)',
                          color: days > 0 ? 'var(--primary)' : 'var(--error)',
                          fontWeight: 700
                        }}>
                          {days > 0 ? `${days} Day${days > 1 ? 's' : ''}` : 'Invalid Range'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Reason chips */}
                  <div className="mb-16">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-hint)', marginBottom: 8 }}>Reason for Leave</label>
                    <ChipSelect
                      options={[
                        '🤒 Illness',
                        '✈️ Travel',
                        '🎉 Family Event',
                        '🏠 Personal',
                        '❓ Other'
                      ]}
                      value={leaveForm.reason}
                      onChange={val => setLeaveForm(prev => ({ ...prev, reason: val }))}
                    />
                  </div>

                  {/* Notes */}
                  <div className="input-group mb-16">
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-hint)', marginBottom: 4 }}>Details / Message (Optional)</label>
                    <textarea
                      className="input"
                      placeholder="Briefly describe the reason for leave..."
                      value={leaveForm.notes}
                      onChange={e => setLeaveForm(prev => ({ ...prev, notes: e.target.value }))}
                      style={{ minHeight: 80, fontFamily: 'inherit' }}
                    />
                  </div>

                  <button
                    className="btn btn-primary w-full"
                    onClick={handleLeaveSubmit}
                    disabled={submittingLeave || calculateDays(leaveForm.fromDate, leaveForm.toDate) <= 0}
                  >
                    {submittingLeave ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Submit Leave Request'}
                  </button>
                </div>
              )}

              {/* History Tab */}
              {leaveTab === 'history' && (
                <div className="flex flex-col gap-10">
                  {leavesLoading ? (
                    <Skeleton type="card" count={3} />
                  ) : leaves.length > 0 ? (
                    leaves.map(l => {
                      const days = calculateDays(l.fromDate, l.toDate);
                      const isPending = l.status === 'pending';
                      const isApproved = l.status === 'approved';
                      
                      const borderColor = isApproved ? 'var(--success)' : isPending ? 'var(--warning)' : 'var(--error)';
                      const statusLabel = l.status.charAt(0).toUpperCase() + l.status.slice(1);
                      const statusColorClass = isApproved ? 'badge-success' : isPending ? 'badge-warning' : 'badge-danger';
                      
                      const header = (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{l.studentName}</span>
                              <span className={`badge ${statusColorClass}`} style={{ fontSize: 10 }}>{statusLabel}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                              {l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} → ${l.toDate}`} · {days}d
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {l.reason.split(' — ')[0]}
                          </span>
                        </div>
                      );

                      return (
                        <ExpandableCard key={l.id} header={header} borderColor={borderColor}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            <div>
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Full Reason / Notes</span>
                              <span style={{ color: 'var(--text-dark)' }}>{l.reason}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Submitted At</span>
                                <span style={{ color: 'var(--text-dark)' }}>
                                  {l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                </span>
                              </div>
                              {l.reviewedAt && (
                                <div>
                                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Reviewed By</span>
                                  <span style={{ color: 'var(--text-dark)' }}>{l.reviewerName || 'Admin'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </ExpandableCard>
                      );
                    })
                  ) : (
                    <EmptyState
                      emoji="📝"
                      title="No Leave Requests"
                      subtitle="Apply for leaves and track their status here."
                      onAction={() => setLeaveTab('apply')}
                      actionLabel="Apply Leave"
                    />
                  )}
                </div>
              )}
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

            {loading ? (
              <Skeleton type="card" count={3} />
            ) : (
              <div className="flex flex-col gap-10">
                {filteredPosts.map(p => (
                  <div key={p.id} className="post-card" style={{ cursor: 'pointer' }} onClick={() => setActivePostDetail(p)}>
                    <span className={`post-cat-badge ${p.category?.toLowerCase()}`}>{p.category}</span>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      <LinkifyText text={p.body} maxChars={150} />
                    </div>
                    {p.imageUrls?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
                        {p.imageUrls.map((url, i) => (
                          <img key={i} src={url} alt="" style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: 10 }} />
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>
                      {p.authorName} · {p.timestamp?.toDate?.()?.toLocaleDateString?.('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || '—'}
                    </div>
                  </div>
                ))}
                {filteredPosts.length === 0 && (
                  <div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-title">No posts</div></div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ PROFILE TAB ══════════════ */}
        {tab === 'profile' && (
          <div className="fade-in">
            <div className="profile-header-card">
              <div className="profile-header-avatar">
                {profile?.name?.[0] || '?'}
              </div>
              <div>
                <div className="profile-header-name">{profile?.name || 'Parent'}</div>
                <div className="profile-header-phone">{user?.phoneNumber || ''}</div>
                <span className="profile-role-pill">Parent Account</span>
              </div>
            </div>

            <div className="card mb-16">
              <div className="section-title mb-12">Children</div>
              <div className="flex flex-col gap-8">
                {children.map(c => (
                  <div key={c.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setActiveStudentProfile(c)}>
                    <div className="avatar" style={{ background: 'var(--accent-light)', color: 'var(--primary)' }}>{c.name?.[0]}</div>
                    <div className="list-item-content">
                      <div className="list-item-title" style={{ fontWeight: 600 }}>{c.name}</div>
                      <div className="list-item-subtitle">{c.classId} · {c.branchId}</div>
                    </div>
                    <span style={{ color: 'var(--text-hint)', fontSize: 16 }}>›</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card mb-16" style={{ marginTop: 16 }}>
              <div className="section-title mb-12">Guidelines & Info</div>
              <div className="flex flex-col gap-12" style={{ fontSize: 14 }}>
                <button onClick={() => setShowOnboarding(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                  📘 Onboarding Guidelines
                </button>
                <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                  🔒 Privacy Policy
                </button>
                <button onClick={() => setShowFeedback(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                  💬 Give Feedback & Contact
                </button>
              </div>
            </div>

            <button className="btn btn-outline" onClick={handleLogout} style={{ color: 'var(--error)', borderColor: 'var(--error)', width: '100%' }}>
              Logout
            </button>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-hint)', marginTop: 24, paddingBottom: 16 }}>
              Happy Times PWA · v1.1.0
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Modal */}
      <Modal open={showOnboarding} onClose={() => setShowOnboarding(false)} title="Welcome to Happy Times PWA">
        <div style={{ fontSize: 14, color: 'var(--text-mid)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p>Get started with the Happy Times Preschool app in a few quick steps:</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📱</span>
            <div>
              <strong>Install the App</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Tap the Share button in Safari (iOS) or the Menu button in Chrome (Android) and choose "Add to Home Screen" to install.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <div>
              <strong>Real-time Notifications</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Grant push notification permission to instantly receive daily attendance highlights, holiday notices, and announcements.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📅</span>
            <div>
              <strong>Track Attendance & Fees</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>View calendar reports of your child's monthly present/absent stats and safely check ledger balances on the "Fees" tab.</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowOnboarding(false)} style={{ marginTop: 8 }}>Got it, thanks!</button>
        </div>
      </Modal>


      {/* Privacy Policy Modal */}
      <Modal open={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy">
        <div style={{ fontSize: 13, color: 'var(--text-mid)', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          <p><strong>Your Privacy is Our Priority</strong></p>
          <p>Happy Times Preschool PWA secures all student records, daily attendance, fee logs, and staff announcements under state-of-the-art Firestore security rules.</p>
          <p><strong>Data Safety Bounds:</strong></p>
          <ul>
            <li>No unauthorized external tracking or metadata profiling.</li>
            <li>Parent records are locked strict to their registered phone number.</li>
            <li>Critical system exceptions are trapped purely for performance monitoring.</li>
          </ul>
          <p>For additional details or data request queries, please contact your branch administrator directly.</p>
          <button className="btn btn-primary" onClick={() => setShowPrivacy(false)} style={{ marginTop: 8 }}>Close</button>
        </div>
      </Modal>

      {/* Feedback Modal */}
      <Modal open={showFeedback} onClose={() => setShowFeedback(false)} title="Give Feedback & Contact Us">
        <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-12">
          <div className="input-group">
            <label>Rating</label>
            <select className="input" value={feedbackForm.rating} onChange={e => setFeedbackForm(f => ({ ...f, rating: e.target.value }))}>
              <option value="5">⭐️⭐️⭐️⭐️⭐️ (Excellent)</option>
              <option value="4">⭐️⭐️⭐️⭐️ (Very Good)</option>
              <option value="3">⭐️⭐️⭐️ (Average)</option>
              <option value="2">⭐️⭐️ (Poor)</option>
              <option value="1">⭐️ (Terrible)</option>
            </select>
          </div>
          <div className="input-group">
            <label>Comment / Message</label>
            <textarea className="input" value={feedbackForm.comment} onChange={e => setFeedbackForm(f => ({ ...f, comment: e.target.value }))} placeholder="Share your suggestions or reach out..." style={{ minHeight: 100 }} />
          </div>
          <button type="submit" className="btn btn-primary">Send Message</button>
        </form>
      </Modal>

      {/* Student Profile Details Modal */}
      <Modal 
        open={!!activeStudentProfile} 
        onClose={() => { 
          setActiveStudentProfile(null); 
          setIsEditingProfile(false); 
        }} 
        title={isEditingProfile ? "Edit Child Details" : "Student Profile Details"}
      >
        {activeStudentProfile && (() => {
          const sId = activeStudentProfile.id;
          const defaultRegId = `HT-2026-${sId.slice(0, 5).toUpperCase()}`;
          
          if (isEditingProfile) {
            return (
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="input-group">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Child's Name (Read-only)</label>
                  <input className="input" type="text" value={activeStudentProfile.name} disabled style={{ opacity: 0.7 }} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Class (Read-only)</label>
                    <input className="input" type="text" value={activeStudentProfile.classId} disabled style={{ opacity: 0.7 }} />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Branch (Read-only)</label>
                    <input className="input" type="text" value={activeStudentProfile.branchId} disabled style={{ opacity: 0.7 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Date of Birth</label>
                    <input 
                      className="input" 
                      type="date" 
                      value={editForm.dob} 
                      onChange={e => setEditForm({ ...editForm, dob: e.target.value })} 
                    />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Blood Group</label>
                    <select 
                      className="input" 
                      value={editForm.bloodGroup} 
                      onChange={e => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Secondary Contact Number</label>
                  <input 
                    className="input" 
                    type="tel" 
                    value={editForm.phone2} 
                    placeholder="Enter secondary contact number"
                    onChange={e => setEditForm({ ...editForm, phone2: e.target.value })} 
                  />
                </div>

                <div className="input-group">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Medical Notes / Allergies</label>
                  <textarea 
                    className="input" 
                    value={editForm.medicalNotes} 
                    placeholder="E.g., Peanut allergy, asthma, etc."
                    onChange={e => setEditForm({ ...editForm, medicalNotes: e.target.value })} 
                    style={{ minHeight: 60, fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ flex: 1 }}
                    onClick={() => setIsEditingProfile(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header inside modal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 16 }}>
                <div className="avatar avatar-lg" style={{ width: 64, height: 64, fontSize: 24, background: 'var(--primary-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {activeStudentProfile.name?.[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--navy)' }}>{activeStudentProfile.name}</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {defaultRegId}</span>
                </div>
              </div>

              {/* Grid of details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', marginBottom: 2 }}>Class / Grade</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{activeStudentProfile.classId}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', marginBottom: 2 }}>Branch Location</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{activeStudentProfile.branchId}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', marginBottom: 2 }}>Date of Birth</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{activeStudentProfile.dob || '—'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', marginBottom: 2 }}>Blood Group</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{activeStudentProfile.bloodGroup || '—'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', marginBottom: 2 }}>Medical & Allergies</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{activeStudentProfile.medicalNotes || 'None'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', marginBottom: 2 }}>Current Status</span>
                  <span className="badge" style={{ background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600, padding: '2px 8px', fontSize: 11 }}>Active Student</span>
                </div>
              </div>

              {/* Contacts section */}
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 600 }}>Emergency Contact Numbers</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Primary Guardian:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{activeStudentProfile.phone1 || user?.phoneNumber || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Secondary Contact:</span>
                  <strong style={{ color: 'var(--text-dark)' }}>{activeStudentProfile.phone2 || '—'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  className="btn btn-outline" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    setEditForm({
                      dob: activeStudentProfile.dob || '',
                      bloodGroup: activeStudentProfile.bloodGroup || '',
                      medicalNotes: activeStudentProfile.medicalNotes || '',
                      phone2: activeStudentProfile.phone2 || ''
                    });
                    setIsEditingProfile(true);
                  }}
                >
                  ✏️ Edit Profile Details
                </button>
                <button className="btn btn-primary" onClick={() => setActiveStudentProfile(null)} style={{ flex: 1 }}>
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Payment Modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Pay Fees Online">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, color: 'var(--text-mid)' }}>
          <div style={{ background: 'var(--accent-light)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending Amount</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
              ₹{feeRecord ? feeRecord.pending.toLocaleString() : '0'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Option 1: Scan &amp; Pay via UPI</div>
            <div style={{
              width: 160, height: 160, background: 'white', padding: 8, borderRadius: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                  `upi://pay?pa=happytimes.preschool@icici&pn=Happy Times Preschool&am=${feeRecord ? feeRecord.pending : 0}&cu=INR&tn=Preschool Fees`
                )}`}
                alt="UPI QR Code"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Scan QR code using any UPI app (GPay, PhonePe, Paytm)
            </div>
            
            <button
              className="btn btn-outline btn-sm w-full"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, marginTop: 4 }}
              onClick={() => {
                const upiUrl = `upi://pay?pa=happytimes.preschool@icici&pn=Happy%20Times%20Preschool&am=${feeRecord ? feeRecord.pending : 0}&cu=INR&tn=Preschool%20Fees`;
                window.location.href = upiUrl;
              }}
            >
              🚀 Pay via UPI App Direct
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>Option 2: Direct Bank Transfer (IMPS/NEFT)</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Account Name:</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  Happy Times Preschool
                  <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => { navigator.clipboard.writeText('Happy Times Preschool'); toast.success('Copied Account Name!'); }}>📋</span>
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Account Number:</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  120505001234
                  <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => { navigator.clipboard.writeText('120505001234'); toast.success('Copied Account Number!'); }}>📋</span>
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  ICIC0001205
                  <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => { navigator.clipboard.writeText('ICIC0001205'); toast.success('Copied IFSC Code!'); }}>📋</span>
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Bank Name:</span>
                <strong>ICICI Bank</strong>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500, textAlign: 'center', lineHeight: 1.4 }}>
            💡 Note: Please share payment screenshot on WhatsApp to verify &amp; get receipt.
          </div>

          <button className="btn btn-outline" onClick={() => setShowPaymentModal(false)}>Close</button>
        </div>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Confirm Logout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>👋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)' }}>
            Are you sure you want to logout?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            You'll need your registered mobile number and OTP to sign back in.
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 4 }}>
            <button
              className="btn btn-outline"
              style={{ flex: 1 }}
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, background: 'var(--error)', boxShadow: 'none' }}
              onClick={async () => {
                setShowLogoutConfirm(false);
                try {
                  await logout();
                  window.location.href = '/';
                } catch (e) {
                  console.error('Logout error:', e);
                }
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </Modal>

      {/* Profile Sheet */}
      <ProfileSheet
        open={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
        name={profile?.name || 'Parent'}
        phone={user?.phoneNumber || ''}
        role="Parent"
      />

      {/* Post Detail Bottom Sheet */}
      <BottomSheet open={!!activePostDetail} onClose={() => setActivePostDetail(null)}>
        {activePostDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={`post-cat-badge ${activePostDetail.category?.toLowerCase()}`}>
                {activePostDetail.category}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                {activePostDetail.timestamp?.toDate?.()?.toLocaleDateString?.('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || '—'}
              </span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>
              {activePostDetail.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 10 }}>
              <span>👤</span> Published by <strong>{activePostDetail.authorName}</strong>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-dark)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              <LinkifyText text={activePostDetail.body} />
            </p>

            {activePostDetail.imageUrls?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 600 }}>Attached Images</span>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                  {activePostDetail.imageUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                      <img src={url} alt="" style={{ width: 220, height: 140, objectFit: 'cover', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            <button className="btn btn-outline" onClick={() => setActivePostDetail(null)} style={{ marginTop: 12 }}>
              Close
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomNav items={navItems} active={tab} onNavigate={setTab} />
    </div>
  );
}

import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { auth } from '../../config/firebase.js';
import { getBranch, getStaffWhitelist, addToStaffWhitelist, removeFromStaffWhitelist, getLogs } from '../../services/firestore.js';

// Shared Components & Hooks
import { useOverlayStack } from '../../hooks/useOverlayStack.js';
import { useLeaves } from '../../hooks/useLeaves.js';
import { useDashboardStats } from '../../hooks/useDashboardStats.js';
import { useAttendance } from '../../hooks/useAttendance.js';
import { usePosts } from '../../hooks/usePosts.js';
import { useStudents } from '../../hooks/useStudents.js';

import BottomNav from '../../components/BottomNav.jsx';
import Modal from '../../components/Modal.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import AppLogo from '../../components/AppLogo.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { ProfileAvatar, ProfileSheet } from '../../components/ProfileSheet.jsx';
import TabBar from '../../components/TabBar.jsx';

import { CLASSES } from '../../constants/classes.js';

import PostFeedCard from '../../components/PostFeedCard.jsx';

// Modular Components (Lazy loaded or imported directly)
import ActionGrid from './ActionGrid.jsx';
const LeaveManagement = lazy(() => import('./LeaveManagement.jsx'));
const ClassStudentsPanel = lazy(() => import('./ClassStudentsPanel.jsx'));
const StudentProfileSheet = lazy(() => import('./StudentProfileSheet.jsx'));
const BroadcastSheet = lazy(() => import('./BroadcastSheet.jsx'));
const BranchAdminCreatePost = lazy(() => import('./BranchAdminCreatePost.jsx'));

export default function BranchAdminDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const branchId = profile?.branchId;

  // Tabs and Overlays
  const [tab, setTab] = useState('home');
  const { stack, push, pop, isOpen } = useOverlayStack();
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // States
  const [branch, setBranch] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const updateSyncTime = () => setLastSynced(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

  // Whitelist State
  const [whitelistedAdmins, setWhitelistedAdmins] = useState([]);
  const [whitelistingEmail, setWhitelistingEmail] = useState('');
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);

  // Active student drill details
  const [activeStudentDetail, setActiveStudentDetail] = useState(null);
  const [activeDrillClass, setActiveDrillClass] = useState('');

  // Extract hooks
  const { stats, loading: statsLoading, loadDashboard } = useDashboardStats();
  const {
    loading: attLoading, attSaving, attRecords, pendingAttRecords, attHasUnsaved, lockTime, locked,
    loadAttendance, handleAttToggle, handleMarkAllPresent, handleSaveAttendance, clearPending
  } = useAttendance();
  const {
    loading: postsLoading, posts, hasMorePosts, loadPosts, loadMorePosts, handleDeletePost
  } = usePosts();
  const { students, loadStudents } = useStudents();
  const { leaves, loading: leavesLoading, pendingCount: leavesPendingCount, reload: reloadLeaves } = useLeaves({
    mode: 'branch',
    branchId,
  });

  // Logs Preview State
  const [logs, setLogs] = useState([]);
  const [lastLogDoc, setLastLogDoc] = useState(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);

  // Attendance inputs
  const [selectedClass, setSelectedClass] = useState('');
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (branchId) {
      getBranch(branchId).then(setBranch);
      reloadLeaves();
    }
  }, [branchId]);

  // Load whitelist when admins overlay opens — derive stable boolean from stack
  const adminsOpen = stack.includes('admins');
  useEffect(() => {
    if (!adminsOpen) return;
    loadWhitelist();
  }, [adminsOpen]);

  const loadLogsData = async (loadMore = false) => {
    try {
      const actorUid = profile?.id || auth.currentUser?.uid;
      const { items, lastDoc } = await getLogs({
        actorUid,
        limitCount: 25,
        lastVisible: loadMore ? lastLogDoc : null
      });
      setLogs(prev => loadMore ? [...prev, ...items] : items);
      setLastLogDoc(lastDoc);
      setHasMoreLogs(items.length === 25);
    } catch (e) {
      toast.error('Failed to load activity logs');
    }
  };

  const handleRefresh = async () => {
    updateSyncTime();
    if (tab === 'home' && branchId) {
      await loadDashboard(branchId);
      await loadLogsData();
    }
    else if (tab === 'attendance' && selectedClass) await loadAttendance(branchId, selectedClass, attDate);
    else if (tab === 'posts' && branchId) await loadPosts(branchId);
    else if (tab === 'activity') await loadLogsData();
  };

  useEffect(() => {
    if (tab === 'home' && branchId) {
      loadDashboard(branchId);
      loadLogsData();
    }
    if (tab === 'posts' && branchId) loadPosts(branchId);
    if (tab === 'activity') loadLogsData();
  }, [tab, branchId]);

  // 90s auto-refresh for home tab only
  useEffect(() => {
    if (tab !== 'home' || !branchId) return;
    const interval = setInterval(() => { loadDashboard(branchId); }, 90000);
    return () => clearInterval(interval);
  }, [tab, branchId]);

  // Whitelist admin ops
  const loadWhitelist = async () => {
    setLoadingWhitelist(true);
    try {
      const list = await getStaffWhitelist();
      setWhitelistedAdmins(list.filter(u => u.branchId === branchId && u.role === 'branchadmin'));
    } catch (e) {
      toast.error('Failed to load whitelisted admins');
    }
    setLoadingWhitelist(false);
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!whitelistingEmail.trim()) return;
    try {
      await addToStaffWhitelist(whitelistingEmail.trim(), 'branchadmin', branchId);
      toast.success('Admin whitelisted successfully!');
      setWhitelistingEmail('');
      loadWhitelist();
    } catch (e) {
      toast.error(e.message || 'Failed to whitelist admin');
    }
  };

  const handleRemoveAdmin = async (email) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      await removeFromStaffWhitelist(email);
      toast.success('Admin removed from whitelist');
      loadWhitelist();
    } catch (e) {
      toast.error('Failed to remove admin');
    }
  };

  const handleTabChange = (key) => {
    if (attHasUnsaved && tab === 'attendance') {
      if (!window.confirm('You have unsaved attendance changes. Leave without saving?')) return;
      clearPending();
    }
    setTab(key);
  };

  const handleLoadAttendanceData = () => {
    if (!selectedClass) { toast.info('Select a class first'); return; }
    loadStudents(branchId, selectedClass);
    loadAttendance(branchId, selectedClass, attDate);
  };

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="app-header-glass">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppLogo variant="header" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                  Branch Admin
                </span>
                {branch?.name && (
                  <span className="badge" style={{ fontSize: 9, background: 'var(--primary-light)', color: 'white', fontWeight: 600, padding: '1px 6px', borderRadius: 4 }}>
                    {branch.name}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Happy Times Preschool</h1>
              {lastSynced && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><span>🔄</span> Synced at {lastSynced}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleRefresh} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: 'white' }}>↻</button>
            <ProfileAvatar initials={profile?.name?.[0]} onClick={() => setShowProfileSheet(true)} />
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* ══════════════ HOME TAB ══════════════ */}
        {tab === 'home' && (
          <div className="fade-in">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>
                Welcome, {profile?.name || 'Admin'} 👋
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {leavesPendingCount > 0 && (
              <div className="card mb-16" style={{ borderLeft: '4px solid var(--warning)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }} onClick={() => push('leaves')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>📝</span>
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--text-dark)' }}>Pending Leaves</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{leavesPendingCount} request{leavesPendingCount === 1 ? '' : 's'} waiting review.</p>
                  </div>
                </div>
                <span className="badge" style={{ fontSize: 10, fontWeight: 700, background: 'var(--warning-light)', color: 'var(--warning)', padding: '2px 8px' }}>Review</span>
              </div>
            )}

            {statsLoading ? (
              <div className="stat-grid mb-16"><Skeleton type="stat" count={2} /></div>
            ) : (
              <div className="stat-grid mb-16">
                <div className="stat-card">
                  <div className="stat-value">{stats.totalStudents || 0}</div>
                  <div className="stat-label">Students</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--primary)' }}>
                    {(() => {
                      let total = 0, present = 0;
                      if (stats.classProgress) {
                        Object.values(stats.classProgress).forEach(c => { total += c.total; present += c.present; });
                      }
                      return total > 0 ? `${Math.round((present / total) * 100)}%` : '—';
                    })()}
                  </div>
                  <div className="stat-label">Overall Attendance</div>
                </div>
              </div>
            )}

            <div className="section-header"><span className="section-title">Actions</span></div>
            <ActionGrid push={push} setTab={handleTabChange} leavesPendingCount={leavesPendingCount} />

            <div className="section-header"><span className="section-title">Class Attendance Rates</span></div>
            <div className="card mb-16" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CLASSES.map(c => {
                const info = stats.classProgress?.[c] || { total: 0, present: 0, rate: 0 };
                const rateColor = info.rate >= 80 ? 'var(--success)' : 'var(--warning)';
                return (
                  <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-dark)' }}>{c}</span>
                      <span style={{ color: rateColor }}>{info.total > 0 ? `${info.rate}% (${info.present}/${info.total})` : 'No students'}</span>
                    </div>
                    {info.total > 0 && (
                      <div style={{ background: '#ECEFF1', borderRadius: 99, height: 6, width: '100%', overflow: 'hidden' }}>
                        <div style={{ background: rateColor, height: '100%', width: `${info.rate}%`, borderRadius: 99, transition: 'width 0.5s ease-out' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="section-header mt-20">
              <span className="section-title">Recent Activity Logs</span>
              <span className="section-action" onClick={() => setTab('activity')}>View all</span>
            </div>
            <div className="card mb-16" style={{ padding: '8px 16px' }}>
              <div className="flex flex-col">
                {logs.slice(0, 5).map(l => (
                  <div key={l.id} className="log-tile">
                    <div className={`log-icon-box ${l.category || ''}`}>{l.category === 'attendance' ? '📋' : l.category === 'fee' ? '💰' : l.category === 'post' ? '📢' : '👤'}</div>
                    <div className="log-details">
                      <div className="log-title">{l.details}</div>
                      <div className="log-meta">
                        <span className="log-role-badge">Branch Admin</span>
                        <span className="log-time">by {l.actorName}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-hint)', fontSize: 13 }}>No recent activity logs.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ ATTENDANCE TAB ══════════════ */}
        {tab === 'attendance' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Attendance</h2>
              {attHasUnsaved && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>● Unsaved</span>}
            </div>

            <div className="flex gap-8 mb-12">
              <select className="input" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                <option value="">Select Class</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="date" className="input" value={attDate} onChange={e => setAttDate(e.target.value)} />
            </div>

            <button className="btn btn-primary mb-12" onClick={handleLoadAttendanceData}>Load Students</button>

            {locked && <div className="badge badge-locked mb-12">🔒 Locked at {lockTime}</div>}

            {attLoading ? (
              <Skeleton type="list" count={5} />
            ) : students.length > 0 ? (
              <>
                {!locked && (
                  <div className="flex gap-8 mb-12">
                    <button className="btn btn-outline btn-sm" onClick={() => handleMarkAllPresent(students)} style={{ flex: 1, color: 'var(--success)', borderColor: 'var(--success)' }}>✓ Mark All Present</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveAttendance(branchId, selectedClass, attDate, students)} disabled={attSaving || (!attHasUnsaved && Object.keys(attRecords).length > 0)} style={{ flex: 1 }}>
                      {attSaving ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : '💾 Save Attendance'}
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-8">
                  {students.map(s => {
                    const effectiveStatus = pendingAttRecords[s.id] ?? attRecords[s.id]?.status;
                    const isPending = s.id in pendingAttRecords;
                    return (
                      <div key={s.id} className="list-item" style={{ opacity: locked ? 0.7 : 1 }}>
                        <div className="avatar">{s.name?.[0]}</div>
                        <div className="list-item-content">
                          <div className="list-item-title">{s.name}</div>
                          {isPending && <div style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600 }}>● not saved</div>}
                        </div>
                        <div className="attendance-toggle">
                          {['present', 'absent', 'on_leave'].map(status => (
                            <button key={status} className={`att-btn ${effectiveStatus === status ? `${status === 'on_leave' ? 'late' : status}-active` : ''}`} onClick={() => handleAttToggle(s.id, status)} disabled={locked}>
                              {status === 'on_leave' ? 'L' : status[0].toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!locked && students.length > 5 && (
                  <button className="btn btn-primary" onClick={() => handleSaveAttendance(branchId, selectedClass, attDate, students)} disabled={attSaving || (!attHasUnsaved && Object.keys(attRecords).length > 0)} style={{ marginTop: 16 }}>
                    {attSaving ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : '💾 Save Attendance'}
                  </button>
                )}
              </>
            ) : null}

            {students.length === 0 && !attLoading && (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">{selectedClass ? `No students enrolled in ${selectedClass}` : 'Select a class and load'}</div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ POSTS TAB ══════════════ */}
        {tab === 'posts' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Posts</h2>
              <button className="btn btn-primary btn-sm" onClick={() => push('create_post')} style={{ width: 'auto' }}>+ New</button>
            </div>

            <div className="flex flex-col gap-10">
              {postsLoading && posts.length === 0 && <Skeleton type="card" count={3} />}
              {posts.map(p => (
                <PostFeedCard
                  key={p.id}
                  post={p}
                  showDelete={true}
                  onDelete={(id) => handleDeletePost(id, 'branchadmin', branchId)}
                />
              ))}
              {hasMorePosts && posts.length > 0 && (
                <button className="btn btn-outline" onClick={() => loadMorePosts(branchId)} style={{ width: '100%', marginTop: 8 }} disabled={postsLoading}>
                  {postsLoading ? 'Loading...' : 'Load More ↓'}
                </button>
              )}
              {posts.length === 0 && !postsLoading && (
                <div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-title">No posts yet</div><div className="empty-state-text">Tap "+ New" to create your first post</div></div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ ACTIVITY TAB ══════════════ */}
        {tab === 'activity' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Activity Logs</h2>
            <div className="flex flex-col gap-10">
              {logs.map(l => (
                <div key={l.id} className="list-item" style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', borderRadius: '16px', border: '1px solid rgba(26,35,64,0.06)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(33, 150, 243, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {l.category === 'attendance' ? '📋' : l.category === 'fee' ? '💰' : l.category === 'post' ? '📢' : '👤'}
                  </div>
                  <div className="list-item-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-dark)' }}>
                        {l.category || 'System'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-hint)' }}>{l.timestamp?.toDate?.()?.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) || '—'}</span>
                    </div>
                    <div className="list-item-title" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)', lineHeight: '1.4', marginTop: '2px' }}>{l.details}</div>
                  </div>
                </div>
              ))}
              {hasMoreLogs && logs.length > 0 && (
                <button className="btn btn-outline" onClick={() => loadLogsData(true)} style={{ width: '100%', marginTop: 8 }}>Load More Activity ↓</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overlays Suspense (Max depth 2 enforced) */}
      <Suspense fallback={<div className="overlay-panel open"><div className="overlay-panel-content"><Skeleton type="list" count={4} /></div></div>}>
        {isOpen('leaves') && (
          <LeaveManagement branchId={branchId} profileId={profile?.id} profileName={profile?.name} pop={pop} />
        )}
        {isOpen('broadcast') && (
          <BroadcastSheet branchId={branchId} profileName={profile?.name} pop={pop} />
        )}
        {isOpen('create_post') && (
          <BranchAdminCreatePost pop={pop} branchId={branchId} onCreated={() => loadPosts(branchId)} />
        )}
        {isOpen('classes') && (
          <div className="overlay-panel open">
            <div className="overlay-panel-header"><button className="overlay-panel-back" onClick={pop}>←</button><h2>Class Management</h2></div>
            <div className="overlay-panel-content" style={{ padding: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 12 }}>Tap a class to manage its students.</p>
              <div className="flex flex-col gap-10">
                {CLASSES.map(c => {
                  const info = stats.classProgress?.[c] || { total: 0 };
                  return (
                    <div
                      key={c}
                      className="list-item"
                      style={{ padding: '14px 16px', cursor: 'pointer' }}
                      onClick={() => { push('students'); }}
                    >
                      <div className="avatar" style={{ background: 'var(--primary-light)', color: 'white', fontWeight: 'bold' }}>{c[0]}</div>
                      <div className="list-item-content">
                        <div className="list-item-title" style={{ fontSize: 15, fontWeight: 600 }}>{c}</div>
                        <div className="list-item-subtitle">{info.total} Student{info.total === 1 ? '' : 's'} Enrolled</div>
                      </div>
                      <span style={{ color: 'var(--text-hint)', fontSize: 16 }}>›</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {isOpen('students') && (
          <ClassStudentsPanel branchId={branchId} pop={pop} stats={stats} onSelectStudent={(s, cId) => { setActiveStudentDetail(s); setActiveDrillClass(cId); }} />
        )}
        {isOpen('admins') && (
          <div className="overlay-panel open">
            <div className="overlay-panel-header"><button className="overlay-panel-back" onClick={pop}>←</button><h2>Whitelisted Branch Admins</h2></div>
            <div className="overlay-panel-content" style={{ padding: 16 }}>
              <form onSubmit={handleAddAdmin} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <input type="email" placeholder="Enter email to whitelist..." className="input" value={whitelistingEmail} onChange={e => setWhitelistingEmail(e.target.value)} required />
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 16px' }}>Whitelist</button>
              </form>
              {loadingWhitelist ? (
                <Skeleton type="list" count={3} />
              ) : (
                <div className="flex flex-col gap-10">
                  {whitelistedAdmins.map(admin => (
                    <div key={admin.email} className="list-item" style={{ padding: '12px 16px' }}>
                      <div className="avatar" style={{ background: '#ECEFF1', color: '#455A64', fontWeight: 'bold' }}>🔑</div>
                      <div className="list-item-content">
                        <div className="list-item-title" style={{ fontWeight: 600 }}>{admin.email}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span className="badge" style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: 10, fontWeight: 600 }}>Active Whitelist</span>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveAdmin(admin.email)} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 18, cursor: 'pointer', padding: 4 }} title="Remove Admin">🗑️</button>
                    </div>
                  ))}
                  {whitelistedAdmins.length === 0 && <EmptyState emoji="🔑" title="No Whitelisted Admins" subtitle="Add branch admin emails to allow them to log in to this branch." />}
                </div>
              )}
            </div>
          </div>
        )}
      </Suspense>

      {/* Student Profile sheet drawer — wrapped in Suspense because it is a lazy import */}
      <Suspense fallback={null}>
        <StudentProfileSheet student={activeStudentDetail} onClose={() => setActiveStudentDetail(null)} onRefresh={() => loadStudents(branchId, activeDrillClass)} drillClass={activeDrillClass} />
      </Suspense>

      <ProfileSheet open={showProfileSheet} onClose={() => setShowProfileSheet(false)} name={profile?.name || 'Branch Admin'} role="Branch Admin" email={profile?.email || auth.currentUser?.email || ''} />

      {/* Logout Confirmation Modal */}
      <Modal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Confirm Logout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>👋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)' }}>Are you sure you want to logout?</div>
          <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 4 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--error)' }} onClick={() => { setShowLogoutConfirm(false); auth.signOut(); }}>Logout</button>
          </div>
        </div>
      </Modal>

      <BottomNav items={[
        { key: 'home', icon: '🏠', label: 'Home' },
        { key: 'attendance', icon: '📋', label: 'Attendance' },
        { key: 'posts', icon: '📢', label: 'Posts' },
        { key: 'activity', icon: '📝', label: 'My Activity' },
      ]} active={stack.length > 0 ? '' : tab} onNavigate={handleTabChange} />
    </div>
  );
}

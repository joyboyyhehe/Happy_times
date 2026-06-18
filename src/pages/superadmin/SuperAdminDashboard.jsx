import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { auth } from '../../config/firebase.js';
import { useNavigate } from 'react-router-dom';

// Shared Hooks
import { useSuperAdminData } from '../../hooks/useSuperAdminData.js';
import { useOverlayStack } from '../../hooks/useOverlayStack.js';
import { useAttendance } from '../../hooks/useAttendance.js';
import { usePosts } from '../../hooks/usePosts.js';
import { useStudents } from '../../hooks/useStudents.js';

// Components
import BottomNav from '../../components/BottomNav.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import Modal from '../../components/Modal.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import TabBar from '../../components/TabBar.jsx';
import AppLogo from '../../components/AppLogo.jsx';
import { ProfileAvatar, ProfileSheet } from '../../components/ProfileSheet.jsx';
import PostFeedCard from '../../components/PostFeedCard.jsx';

// Refactored modular widgets
import NetworkStats from './NetworkStats.jsx';
import QuickActions from './QuickActions.jsx';
import BranchCards from './BranchCards.jsx';
import LogsSection from './LogsSection.jsx';

import { CLASSES } from '../../constants/classes.js';
import { addToStaffWhitelist, removeFromStaffWhitelist, getLogs } from '../../services/firestore.js';

// Lazy loaded panels
const BranchDetailPanel = lazy(() => import('./BranchDetailPanel.jsx'));
const AllPendingLeaves = lazy(() => import('./AllPendingLeaves.jsx'));
const SuperAdminBroadcastSheet = lazy(() => import('./SuperAdminBroadcastSheet.jsx'));
const SuperAdminCreatePost = lazy(() => import('./SuperAdminCreatePost.jsx'));

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('home');
  const [moreTab, setMoreTab] = useState('students');

  // Whitelist dialog resets
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [whitelistForm, setWhitelistForm] = useState({ email: '', role: 'branchadmin', branchId: '' });

  // Student management profiles
  const [selectedStudentProfile, setSelectedStudentProfile] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Overlay navigations
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const { stack, push, pop, isOpen } = useOverlayStack();
  const [activeBranchId, setActiveBranchId] = useState('');
  const [activeBranchName, setActiveBranchName] = useState('');
  const [activeBranchTab, setActiveBranchTab] = useState('classes');
  const [branchPickerFor, setBranchPickerFor] = useState(null);

  // States for sub-features
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [lastSynced, setLastSynced] = useState(null);
  const updateSyncTime = () => setLastSynced(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

  // Pull states
  const {
    loading, branches, whitelist, allStudents, stats, lockTime, lockTimeInput, setLockTimeInput,
    loadBranches, loadWhitelist, loadDashboard, updateLockSettings
  } = useSuperAdminData();

  const {
    loading: attLoading, attSaving, attRecords, pendingAttRecords, attHasUnsaved,
    loadAttendance, handleAttToggle, handleMarkAllPresent, handleSaveAttendance, clearPending
  } = useAttendance();

  const {
    loading: postsLoading, posts, hasMorePosts, loadPosts, loadMorePosts, handleDeletePost
  } = usePosts();

  const { students: drillStudents, loadStudents, handleUpdateStudent, handleDeleteStudent } = useStudents();

  // Logs state
  const [logs, setLogs] = useState([]);
  const [lastLogDoc, setLastLogDoc] = useState(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);

  // Form states
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [postToEdit, setPostToEdit] = useState(null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadLogsData = async (loadMore = false) => {
    try {
      const { items, lastDoc } = await getLogs({
        limitCount: 25,
        lastVisible: loadMore ? lastLogDoc : null
      });
      setLogs(prev => loadMore ? [...prev, ...items] : items);
      setLastLogDoc(lastDoc);
      setHasMoreLogs(items.length === 25);
    } catch (e) {
      toast.error('Failed to load system logs');
    }
  };

  const handleRefresh = async () => {
    updateSyncTime();
    if (tab === 'home') await loadDashboard();
    else if (tab === 'attendance' && selectedBranch && selectedClass) await loadAttendance(selectedBranch, selectedClass, attDate);
    else if (tab === 'posts') await loadPosts();
    else if (tab === 'logs') await loadLogsData();
    else if (tab === 'more') {
      if (moreTab === 'students') await loadStudents(selectedBranch || branches[0]?.id || null);
      if (moreTab === 'logs') await loadLogsData();
      if (moreTab === 'staff') await loadWhitelist();
    }
  };

  useEffect(() => {
    if (tab === 'home') {
      loadDashboard();
      loadLogsData();
    }
    if (tab === 'posts') loadPosts();
    if (tab === 'logs') loadLogsData();
    if (tab === 'more') {
      if (moreTab === 'staff') loadWhitelist();
      if (moreTab === 'logs') loadLogsData();
    }
  }, [tab, moreTab]);

  // 90s auto-refresh for dashboard
  useEffect(() => {
    if (tab !== 'home') return;
    const interval = setInterval(() => { loadDashboard(); }, 90000);
    return () => clearInterval(interval);
  }, [tab]);

  const handleBranchPickerSelect = (bId, bName) => {
    setBranchPickerFor(null);
    if (branchPickerFor === 'add_admin') {
      setWhitelistForm({ email: '', role: 'branchadmin', branchId: bId });
      setShowWhitelistModal(true);
    } else {
      setActiveBranchId(bId);
      setActiveBranchName(bName);
      setActiveBranchTab(branchPickerFor === 'students' ? 'students' : branchPickerFor === 'logs' ? 'logs' : 'branchadmins');
      push('branch_detail');
    }
  };

  const handleAddToWhitelistSubmit = async (e) => {
    e.preventDefault();
    if (!whitelistForm.email.trim()) return;
    if (whitelistForm.role === 'branchadmin' && !whitelistForm.branchId) {
      toast.error('Branch selection is required for Branch Admin role');
      return;
    }
    try {
      await addToStaffWhitelist(whitelistForm.email.toLowerCase().trim(), whitelistForm.role, whitelistForm.branchId || null);
      toast.success('Admin whitelisted successfully!');
      setShowWhitelistModal(false);
      setWhitelistForm({ email: '', role: 'branchadmin', branchId: '' });
      loadWhitelist();
    } catch (e) {
      toast.error(e.message || 'Failed to add to whitelist');
    }
  };

  const handleRemoveFromWhitelist = async (email) => {
    if (!window.confirm(`Remove ${email} from whitelist?`)) return;
    try {
      await removeFromStaffWhitelist(email);
      toast.success('Removed from whitelist');
      loadWhitelist();
    } catch (e) {
      toast.error('Failed to remove from whitelist');
    }
  };



  const handleLoadStudentsForBranch = (bId) => {
    setSelectedBranch(bId);
    loadStudents(bId);
  };

  const handleSoftDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to archive/delete this student record?')) return;
    const success = await handleDeleteStudent(studentId);
    if (success) {
      setSelectedStudentProfile(null);
      loadStudents(selectedBranch || branches[0]?.id || null);
    }
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
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', fontWeight: 600 }}>
                  Super Admin
                </span>
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Happy Times preschool</h1>
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
            <h2 className="mb-16" style={{ fontSize: 20, fontWeight: 700 }}>Network Overview</h2>
            <NetworkStats stats={stats} onStaffClick={() => setBranchPickerFor('branchadmins')} onLeavesClick={() => push('pending_leaves')} />

            <h3>Quick Actions</h3>
            <QuickActions onAddAdmin={() => setBranchPickerFor('add_admin')} onBroadcast={() => push('broadcast')} onBranchLogs={() => setBranchPickerFor('logs')} />

            <div className="section-header mt-20"><h3>Branches Network</h3></div>
            <BranchCards branches={branches} stats={stats} loading={loading} onSelectBranch={(id, name) => { setActiveBranchId(id); setActiveBranchName(name); setActiveBranchTab('classes'); push('branch_detail'); }} />
          </div>
        )}

        {/* ══════════════ ATTENDANCE TAB ══════════════ */}
        {tab === 'attendance' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Network Attendance</h2>
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
            <div className="flex gap-8 mb-12">
              <input type="date" className="input" value={attDate} onChange={e => setAttDate(e.target.value)} />
              <button className="btn btn-primary" onClick={() => { loadStudents(selectedBranch, selectedClass); loadAttendance(selectedBranch, selectedClass, attDate); }}>Load</button>
            </div>
            {attLoading ? (
              <Skeleton type="list" count={5} />
            ) : drillStudents.length > 0 ? (
              <>
                <div className="flex gap-8 mb-12">
                  <button className="btn btn-outline btn-sm" onClick={() => handleMarkAllPresent(drillStudents)}>Mark All Present</button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSaveAttendance(selectedBranch, selectedClass, attDate, drillStudents)} disabled={attSaving}>Save</button>
                </div>
                <div className="flex flex-col gap-8">
                  {drillStudents.map(s => {
                    const effectiveStatus = pendingAttRecords[s.id] ?? attRecords[s.id]?.status;
                    return (
                      <div key={s.id} className="list-item">
                        <div className="list-item-content"><div className="list-item-title">{s.name}</div></div>
                        <div className="attendance-toggle">
                          {['present', 'absent', 'on_leave'].map(status => (
                            <button key={status} className={`att-btn ${effectiveStatus === status ? `${status === 'on_leave' ? 'late' : status}-active` : ''}`} onClick={() => handleAttToggle(s.id, status)}>
                              {status === 'on_leave' ? 'L' : status[0].toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : <div className="empty-state"><div className="empty-state-title">Select branch/class and load</div></div>}
          </div>
        )}

        {/* ══════════════ FEES LEDGER TAB ══════════════ */}
        {tab === 'fees' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Fees Ledger</h2>
            </div>
            <button
              className="btn btn-primary mb-16"
              onClick={() => navigate('/super-admin/fees')}
              style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              <span>💸</span> Open Fee Recorder
            </button>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              Manage payments, record UPI/Cash collections, set fee totals, and print invoices for all students across branches.
            </div>
          </div>
        )}

        {/* ══════════════ POSTS TAB ══════════════ */}
        {tab === 'posts' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Network Announcements</h2>
              <button className="btn btn-primary btn-sm" onClick={() => push('create_post')}>+ New</button>
            </div>
            <div className="flex flex-col gap-10">
              {postsLoading && posts.length === 0 && <Skeleton type="card" count={3} />}
              {posts.map(p => (
                <PostFeedCard
                  key={p.id}
                  post={p}
                  showDelete={true}
                  onDelete={(id) => handleDeletePost(id, 'superadmin', null)}
                  onEdit={(post) => { setPostToEdit(post); push('edit_post'); }}
                />
              ))}
              {hasMorePosts && posts.length > 0 && (
                <button className="btn btn-outline" onClick={loadMorePosts} disabled={postsLoading}>Load More ↓</button>
              )}
              {posts.length === 0 && !postsLoading && (
                <div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-title">No posts yet</div></div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ MORE TAB (SUB-SECTIONS) ══════════════ */}
        {tab === 'more' && (
          <div className="fade-in">
            <TabBar tabs={[{ key: 'students', label: 'Students Roster' }, { key: 'staff', label: 'Whitelist' }, { key: 'logs', label: 'Network Logs' }, { key: 'settings', label: 'Config' }]} active={moreTab} onChange={setMoreTab} variant="light" />
            <div style={{ marginTop: 16 }}>
              {moreTab === 'students' && (
                <div>
                  <div className="flex gap-8 mb-12">
                    <select className="input" value={selectedBranch} onChange={e => handleLoadStudentsForBranch(e.target.value)}>
                      <option value="">Select Branch</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input type="text" className="input" placeholder="Search student name..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-8">
                    {drillStudents.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase())).map(s => (
                      <div key={s.id} className="list-item" onClick={() => setSelectedStudentProfile(s)}>
                        <div className="list-item-content"><div className="list-item-title">{s.name}</div><div className="list-item-subtitle">{s.classId} · {s.phone1}</div></div>
                        <span style={{ fontSize: 18 }}>›</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {moreTab === 'staff' && (
                <div>
                  <div className="section-header"><h3>Whitelisted Admins</h3><button className="btn btn-primary btn-sm" onClick={() => { setWhitelistForm({ email: '', role: 'branchadmin', branchId: '' }); setShowWhitelistModal(true); }}>+ Add</button></div>
                  <div className="flex flex-col gap-10">
                    {whitelist.map(w => (
                      <div key={w.email} className="list-item">
                        <div className="list-item-content">
                          <div className="list-item-title">{w.email}</div>
                          <div className="list-item-subtitle">{w.role === 'superadmin' ? 'Super Admin' : `Branch Admin (Branch: ${w.branchId})`}</div>
                        </div>
                        <button className="btn" style={{ color: 'var(--error)', background: 'none', border: 'none', fontSize: 16 }} onClick={() => handleRemoveFromWhitelist(w.email)}>🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {moreTab === 'logs' && <LogsSection logs={logs} hasMore={hasMoreLogs} onLoadMore={() => loadLogsData(true)} loading={loading} />}

              {moreTab === 'settings' && (
                <div className="card">
                  <h3>Global Settings</h3>
                  <div className="input-group mt-12">
                    <label>Attendance Lock Time (Daily)</label>
                    <div className="flex gap-8">
                      <input type="time" className="input" value={lockTimeInput} onChange={e => setLockTimeInput(e.target.value)} />
                      <button className="btn btn-primary" onClick={() => updateLockSettings(lockTimeInput)}>Update</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overlay Drawer panels */}
      <Suspense fallback={<div className="overlay-panel open"><div className="overlay-panel-content"><Skeleton type="list" count={4} /></div></div>}>
        {isOpen('branch_detail') && (
          <BranchDetailPanel open={true} onClose={pop} branchId={activeBranchId} branchName={activeBranchName} initialTab={activeBranchTab} />
        )}
        {isOpen('pending_leaves') && (
          <AllPendingLeaves open={true} onClose={pop} />
        )}
        {isOpen('broadcast') && (
          <SuperAdminBroadcastSheet open={true} onClose={pop} />
        )}
        {isOpen('create_post') && (
          <SuperAdminCreatePost pop={pop} onCreated={() => loadPosts()} />
        )}
        {isOpen('edit_post') && (
          <SuperAdminCreatePost
            pop={() => { setPostToEdit(null); pop(); }}
            onCreated={() => { setPostToEdit(null); loadPosts(); }}
            postToEdit={postToEdit}
          />
        )}
      </Suspense>

      {/* Student Detail drawer (Level 2 depth check) */}
      {selectedStudentProfile && (
        <BottomSheet open={true} onClose={() => setSelectedStudentProfile(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3>{selectedStudentProfile.name}</h3>
            <div>Class: {selectedStudentProfile.classId}</div>
            <div>Phone: {selectedStudentProfile.phone1}</div>
            <div>Alternative Contact: {selectedStudentProfile.phone2 || '—'}</div>
            <div style={{ borderTop: '1px solid var(--error-border)', paddingTop: 12, marginTop: 12 }}>
              <h4 style={{ color: 'var(--error)' }}>Danger Zone</h4>
              <button className="btn w-full" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)', marginTop: 8 }} onClick={() => handleSoftDeleteStudent(selectedStudentProfile.id)}>
                🗑️ Archive / Soft Delete Student
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Branch selector overlay picker */}
      {branchPickerFor && (
        <Modal open={true} onClose={() => setBranchPickerFor(null)} title="Select Target Location">
          <div className="flex flex-col gap-10">
            {branches.map(b => (
              <button key={b.id} className="btn btn-outline w-full text-left" onClick={() => handleBranchPickerSelect(b.id, b.name)}>{b.name}</button>
            ))}
          </div>
        </Modal>
      )}

      {/* Whitelist Addition Modal */}
      <Modal open={showWhitelistModal} onClose={() => setShowWhitelistModal(false)} title="Add to Whitelist">
        <form onSubmit={handleAddToWhitelistSubmit} className="flex flex-col gap-12">
          <div className="input-group"><label>Email Address</label><input type="email" className="input" placeholder="user@gmail.com" value={whitelistForm.email} onChange={e => setWhitelistForm(w => ({ ...w, email: e.target.value }))} required /></div>
          <div className="input-group">
            <label>Role</label>
            <select className="input" value={whitelistForm.role} onChange={e => setWhitelistForm(w => ({ ...w, role: e.target.value }))}>
              <option value="branchadmin">Branch Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>
          {whitelistForm.role === 'branchadmin' && (
            <div className="input-group">
              <label>Branch Assignment</label>
              <select className="input" value={whitelistForm.branchId} onChange={e => setWhitelistForm(w => ({ ...w, branchId: e.target.value }))} required>
                <option value="">Select branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="btn btn-primary">Add whitelist</button>
        </form>
      </Modal>

      <ProfileSheet open={showProfileSheet} onClose={() => setShowProfileSheet(false)} name={profile?.name || 'Super Admin'} role="Super Admin" email={profile?.email || auth.currentUser?.email || ''} />

      <BottomNav items={[
        { key: 'home', icon: '🏠', label: 'Home' },
        { key: 'attendance', icon: '📋', label: 'Attendance' },
        { key: 'fees', icon: '💰', label: 'Fees' },
        { key: 'posts', icon: '📢', label: 'Posts' },
        { key: 'more', icon: '⚙️', label: 'More' },
      ]} active={stack.length > 0 ? '' : tab} onNavigate={setTab} />
    </div>
  );
}

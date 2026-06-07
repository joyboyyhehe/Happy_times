import { useState, useEffect } from 'react';
import { db } from '../../config/firebase.js';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getLogs, getStudents, addToStaffWhitelist, getStaffWhitelist } from '../../services/firestore.js';
import TabBar from '../../components/TabBar.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';
import { CLASSES } from '../../constants/classes.js';

export default function BranchDetailPanel({ open, onClose, branchId, branchName, initialTab }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('classes');

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [branchAdmins, setBranchAdmins] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // Sub-tabs for Logs
  const [activeLogSubTab, setActiveLogSubTab] = useState('all');

  // Whitelist Admin modal
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    if (open && branchId) {
      loadBranchData();
    }
  }, [open, branchId]);

  async function loadBranchData() {
    setLoading(true);
    try {
      // 1. Get Students
      const studs = await getStudents(branchId);
      setStudents(studs);

      // 2. Get Branch Admins from users collection & whitelist
      const usersQuery = query(collection(db, 'users'), where('branchId', '==', branchId));
      const wlQuery = query(collection(db, 'staff_whitelist'), where('branchId', '==', branchId));
      
      const [usersSnap, wlSnap] = await Promise.all([
        getDocs(usersQuery),
        getDocs(wlQuery)
      ]);

      const activeUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data(), isActive: true }));
      const whitelisted = wlSnap.docs.map(d => ({ id: d.id, email: d.id, ...d.data(), isActive: false }));

      // Merge: avoid duplicates
      const mergedAdmins = [...activeUsers];
      whitelisted.forEach(wl => {
        if (!mergedAdmins.some(u => u.email?.toLowerCase() === wl.email?.toLowerCase())) {
          mergedAdmins.push(wl);
        }
      });
      setBranchAdmins(mergedAdmins);

      // 3. Get Logs
      const logsResult = await getLogs({ branchId, limitCount: 50 });
      setLogs(logsResult.items || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load branch details');
    }
    setLoading(false);
  }

  async function handleAddAdminSubmit(e) {
    e.preventDefault();
    if (!adminEmail.trim()) return;
    setAddingAdmin(true);
    try {
      await addToStaffWhitelist(adminEmail.toLowerCase().trim(), 'branchadmin', branchId);
      toast.success('Admin whitelisted successfully');
      setAdminEmail('');
      setShowAddAdminModal(false);
      loadBranchData(); // reload
    } catch (err) {
      toast.error(err.message || 'Failed to whitelist admin');
    }
    setAddingAdmin(false);
  }

  // Filter students based on class selection
  const filteredStudents = selectedClassId
    ? students.filter(s => s.classId === selectedClassId)
    : students;

  // Filter logs based on sub-tab
  const filteredLogs = logs.filter(l => {
    if (activeLogSubTab === 'all') return true;
    const action = l.action || l.actionType || '';
    const role = l.actorRole || '';
    if (activeLogSubTab === 'attendance') {
      return action.includes('attendance') || action.includes('mark_attendance');
    }
    if (activeLogSubTab === 'branchadmin') {
      return (role === 'branchadmin' || role === 'teacher' || role === 'staff') && !action.includes('attendance') && !action.includes('mark_attendance');
    }
    return true;
  });

  const getLogTheme = (type) => {
    if (type.includes('attendance')) {
      return { icon: '📋', bg: 'rgba(76, 175, 80, 0.12)', color: '#2E7D32', label: 'Attendance' };
    }
    if (type.includes('fee') || type.includes('payment')) {
      return { icon: '💰', bg: 'rgba(255, 152, 0, 0.12)', color: '#EF6C00', label: 'Fees' };
    }
    if (type.includes('post') || type.includes('announcement')) {
      return { icon: '📢', bg: 'rgba(156, 39, 176, 0.12)', color: '#6A1B9A', label: 'Posts' };
    }
    if (type.includes('student') || type.includes('parent') || type.includes('leave')) {
      return { icon: '👤', bg: 'rgba(33, 150, 243, 0.12)', color: '#1565C0', label: 'Students/Leaves' };
    }
    return { icon: '📝', bg: 'rgba(0, 0, 0, 0.05)', color: '#424242', label: 'System' };
  };

  const getLogDetails = (l) => {
    return l.details || l.action?.replace(/_/g, ' ') || 'Activity log';
  };

  return (
    <div className={`overlay-panel ${open ? 'open' : ''}`}>
      {/* Header */}
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={onClose}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{branchName}</h2>
          <span style={{ fontSize: 11, opacity: 0.7 }}>Branch Overview</span>
        </div>
        <button
          onClick={() => setShowAddAdminModal(true)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 18,
            cursor: 'pointer'
          }}
          title="Add Branch Admin"
        >
          👤⁺
        </button>
      </div>

      {/* Tabs */}
      <TabBar
        tabs={[
          { key: 'classes', label: 'Classes', count: CLASSES.length },
          { key: 'branchadmins', label: 'Branch Admins', count: branchAdmins.length },
          { key: 'students', label: 'Students', count: students.length },
          { key: 'logs', label: 'Logs', count: logs.length }
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Content */}
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        {loading ? (
          <Skeleton type="list" count={5} />
        ) : (
          <>
            {/* CLASSES TAB */}
            {activeTab === 'classes' && (
              <div className="fade-in flex flex-col gap-10">
                {CLASSES.map(c => {
                  const classStudentsCount = students.filter(s => s.classId === c).length;
                  return (
                    <div
                      key={c}
                      className="list-item"
                      style={{ padding: '14px 16px', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedClassId(c);
                        setActiveTab('students');
                      }}
                    >
                      <div className="avatar" style={{ background: 'var(--primary-light)', color: 'white', fontWeight: 'bold' }}>
                        📚
                      </div>
                      <div className="list-item-content">
                        <div className="list-item-title" style={{ fontSize: 14, fontWeight: 600 }}>{c}</div>
                        <div className="list-item-subtitle">{classStudentsCount} Student{classStudentsCount === 1 ? '' : 's'} Enrolled</div>
                      </div>
                      <span style={{ color: 'var(--text-hint)', fontSize: 16 }}>›</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BRANCH ADMINS TAB */}
            {activeTab === 'branchadmins' && (
              <div className="fade-in flex flex-col gap-10">
                {branchAdmins.map(t => {
                  const isUserActive = t.isActive;
                  return (
                    <div key={t.id} className="list-item" style={{ padding: '12px 14px' }}>
                      <div className="avatar" style={{ background: isUserActive ? 'var(--accent-light)' : '#ECEFF1', color: isUserActive ? 'var(--primary)' : '#455A64' }}>
                        {t.name?.[0]?.toUpperCase() || '✉️'}
                      </div>
                      <div className="list-item-content">
                        <div className="list-item-title" style={{ fontSize: 13, fontWeight: 600 }}>{t.name || t.email}</div>
                        <div className="list-item-subtitle" style={{ fontSize: 11 }}>{t.email}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <span className="badge" style={{
                            background: 'var(--info-light)',
                            color: 'var(--info)',
                            fontSize: 9,
                            fontWeight: 600,
                            padding: '1px 6px'
                          }}>
                            Branch Admin
                          </span>
                          {!isUserActive && (
                            <span className="badge" style={{ background: '#ECEFF1', color: '#607D8B', fontSize: 9, fontWeight: 600, padding: '1px 6px' }}>
                              Pending Log In
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {branchAdmins.length === 0 && (
                  <EmptyState
                    emoji="🔑"
                    title="No Branch Admins whitelisted"
                    subtitle="Whitelist email addresses to assign admins to this branch."
                    onAction={() => setShowAddAdminModal(true)}
                    actionLabel="Whitelist Admin"
                  />
                )}
              </div>
            )}

            {/* STUDENTS TAB */}
            {activeTab === 'students' && (
              <div className="fade-in flex flex-col gap-10">
                {/* Horizontal Class Selector */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                  <button
                    className={`chip ${selectedClassId === null ? 'active' : ''}`}
                    onClick={() => setSelectedClassId(null)}
                  >
                    All Classes
                  </button>
                  {CLASSES.map(c => (
                    <button
                      key={c}
                      className={`chip ${selectedClassId === c ? 'active' : ''}`}
                      onClick={() => setSelectedClassId(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Students List */}
                <div className="flex flex-col gap-8" style={{ marginTop: 8 }}>
                  {filteredStudents.map(s => (
                    <div key={s.id} className="list-item" style={{ padding: '10px 12px' }}>
                      <div className="avatar" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                        {s.name?.[0]?.toUpperCase() || '👶'}
                      </div>
                      <div className="list-item-content">
                        <div className="list-item-title" style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                        <div className="list-item-subtitle" style={{ fontSize: 11 }}>{s.classId}</div>
                      </div>
                    </div>
                  ))}
                  {filteredStudents.length === 0 && (
                    <EmptyState
                      emoji="🎒"
                      title="No Students Found"
                      subtitle={selectedClassId ? `No students enrolled in ${selectedClassId}.` : "No students enrolled in this branch."}
                    />
                  )}
                </div>
              </div>
            )}

            {/* LOGS TAB */}
            {activeTab === 'logs' && (
              <div className="fade-in flex flex-col gap-10">
                {/* Log Sub-tabs */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, borderBottom: '1px solid rgba(26,35,64,0.06)' }}>
                  {['all', 'attendance', 'branchadmin'].map(st => (
                    <button
                      key={st}
                      className={`chip ${activeLogSubTab === st ? 'active' : ''}`}
                      onClick={() => setActiveLogSubTab(st)}
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      {st === 'all' ? 'All Logs' : st === 'attendance' ? 'Attendance' : 'Branch Admin Activity'}
                    </button>
                  ))}
                </div>

                {/* Logs List */}
                <div className="flex flex-col gap-10" style={{ marginTop: 8 }}>
                  {filteredLogs.map(l => {
                    const theme = getLogTheme(l.action || l.actionType || '');
                    const detailsText = getLogDetails(l);
                    const timestampStr = l.timestamp?.toDate?.()?.toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    }) || 'Just now';

                    const actorName = l.actorName || l.actorEmail || 'System';
                    const actorRoleText = l.actorRole ? `(${l.actorRole})` : '';

                    return (
                      <ExpandableCard
                        key={l.id}
                        borderColor={theme.color}
                        header={
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', paddingRight: 8 }}>
                            <div style={{
                              width: 34,
                              height: 34,
                              borderRadius: '8px',
                              background: theme.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 15,
                              flexShrink: 0
                            }}>
                              {theme.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {detailsText}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>
                                {actorName} · {timestampStr}
                              </div>
                            </div>
                          </div>
                        }
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-mid)', marginTop: 4 }}>
                          <div><strong>Actor:</strong> {actorName} {actorRoleText}</div>
                          <div><strong>Time:</strong> {l.timestamp?.toDate?.()?.toString() || '—'}</div>
                          <div><strong>Action Type:</strong> <code>{l.action || l.actionType}</code></div>
                          {l.target && Object.keys(l.target).length > 0 && (
                            <div>
                              <strong>Details:</strong>
                              <pre style={{
                                background: 'var(--bg)',
                                padding: 8,
                                borderRadius: 6,
                                overflowX: 'auto',
                                fontSize: 10,
                                marginTop: 4,
                                color: 'var(--navy)'
                              }}>
                                {JSON.stringify(l.target, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </ExpandableCard>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <EmptyState
                      emoji="📋"
                      title="No Logs Found"
                      subtitle="No matching activities logged for this branch."
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Whitelist Admin Modal */}
      <Modal open={showAddAdminModal} onClose={() => setShowAddAdminModal(false)} title="Whitelist Branch Admin">
        <form onSubmit={handleAddAdminSubmit} className="flex flex-col gap-12">
          <div className="input-group">
            <label>Admin Email Address *</label>
            <input
              type="email"
              className="input"
              placeholder="E.g. admin@gmail.com"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              required
            />
            <p style={{ fontSize: 11, color: 'var(--text-hint)' }}>
              Whitelisting allows this Google account to log in as a Branch Admin for <strong>{branchName}</strong>.
            </p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={addingAdmin || !adminEmail.trim()}>
            {addingAdmin ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Whitelist Admin ✓'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import Skeleton from '../../components/Skeleton.jsx';
import {
  getBranches, getStudents, getFeeRecord, setFeeTotal,
  addPayment, getPaymentHistory,
} from '../../services/firestore.js';

import { CLASSES } from '../../constants/classes.js';
const PAY_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

// ─── Bill Generator ───────────────────────────────
function generateBillHTML(student, feeRecord, payments, receiptId) {
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const paymentRows = payments.map((p, i) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 12px;color:#555;font-size:13px;">${i + 1}</td>
      <td style="padding:10px 12px;font-size:13px;">${p.date?.toDate?.()?.toLocaleDateString('en-IN') || '—'}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#E8451A;">₹${Number(p.amount || 0).toLocaleString()}</td>
      <td style="padding:10px 12px;font-size:13px;">${p.method || '—'}</td>
      <td style="padding:10px 12px;font-size:13px;color:#777;">${p.notes || '—'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Fee Receipt — ${student.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; background: #f5f5f5; padding: 24px; color: #1A1A2E; }
    .bill { max-width: 700px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .bill-header { background: linear-gradient(135deg, #1A2340, #2A3550); color: white; padding: 28px 32px; }
    .school-logo { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .logo-icon { width: 52px; height: 52px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .logo-icon img { width: 100%; height: 100%; object-fit: contain; image-rendering: auto; }
    .school-name { font-size: 22px; font-weight: 800; }
    .school-sub { font-size: 12px; opacity: 0.7; margin-top: 2px; }
    .receipt-meta { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8px; }
    .receipt-title { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
    .receipt-id { font-size: 18px; font-weight: 700; color: #F5A623; }
    .receipt-date { font-size: 12px; opacity: 0.7; margin-top: 2px; }
    .bill-body { padding: 28px 32px; }
    .student-section { display: flex; gap: 16px; padding: 20px; background: #f8fafc; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e8edf5; }
    .student-avatar { width: 56px; height: 56px; background: linear-gradient(135deg, #E8451A22, #F5A62322); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #E8451A; flex-shrink: 0; }
    .student-info { flex: 1; }
    .student-name { font-size: 18px; font-weight: 700; }
    .student-meta { font-size: 13px; color: #666; margin-top: 4px; }
    .fee-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .fee-box { padding: 16px; border-radius: 12px; text-align: center; }
    .fee-box.total { background: #EEF2FF; border: 1px solid #C7D2FE; }
    .fee-box.paid { background: #E8F5E9; border: 1px solid #A5D6A7; }
    .fee-box.pending { background: #FFF3E0; border: 1px solid #FFCC80; }
    .fee-box-amount { font-size: 20px; font-weight: 800; }
    .fee-box.total .fee-box-amount { color: #3730A3; }
    .fee-box.paid .fee-box-amount { color: #2E7D32; }
    .fee-box.pending .fee-box-amount { color: #E65100; }
    .fee-box-label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; font-weight: 600; }
    .section-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead { background: #f8fafc; }
    th { padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; border-bottom: 2px solid #eee; }
    .bill-footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    .footer-note { font-size: 12px; color: #999; }
    .footer-stamp { font-size: 13px; font-weight: 600; color: #E8451A; }
    .progress-bar-wrap { height: 6px; background: #eee; border-radius: 99px; margin-top: 12px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #E8451A, #F5A623); border-radius: 99px; }
    .watermark { text-align: center; font-size: 11px; color: #ccc; margin-top: 16px; }
  </style>
</head>
<body>
<div class="bill">
  <div class="bill-header">
    <div class="school-logo">
      <div class="logo-icon"><img src="https://happytimes-preschool-pwa.web.app/logo.png" alt="HT" /></div>
      <div>
        <div class="school-name">Happy Times Preschool</div>
        <div class="school-sub">Fee Receipt — Official Document</div>
      </div>
    </div>
    <div class="receipt-meta">
      <div>
        <div class="receipt-title">Receipt No.</div>
        <div class="receipt-id">${receiptId}</div>
      </div>
      <div style="text-align:right;">
        <div class="receipt-title">Generated On</div>
        <div style="font-size:14px;font-weight:600;">${date}</div>
        <div class="receipt-date">${time}</div>
      </div>
    </div>
  </div>

  <div class="bill-body">
    <div class="student-section">
      <div class="student-avatar">${student.name?.[0]?.toUpperCase() || 'S'}</div>
      <div class="student-info">
        <div class="student-name">${student.name || 'Student'}</div>
        <div class="student-meta">
          Class: ${student.classId || 'N/A'} &nbsp;·&nbsp; Branch: ${student.branchId || 'N/A'}
          ${student.dob ? `&nbsp;·&nbsp; DOB: ${student.dob}` : ''}
        </div>
        ${feeRecord?.dueDate ? `<div class="student-meta" style="color:#E65100;margin-top:4px;">📅 Fee Due: ${new Date(feeRecord.dueDate).toLocaleDateString('en-IN')}</div>` : ''}
      </div>
    </div>

    <div class="fee-summary">
      <div class="fee-box total">
        <div class="fee-box-amount">₹${Number(feeRecord?.total || 0).toLocaleString()}</div>
        <div class="fee-box-label">Total Fee</div>
      </div>
      <div class="fee-box paid">
        <div class="fee-box-amount">₹${Number(feeRecord?.paid || 0).toLocaleString()}</div>
        <div class="fee-box-label">Amount Paid</div>
      </div>
      <div class="fee-box pending">
        <div class="fee-box-amount">₹${Number(feeRecord?.pending || 0).toLocaleString()}</div>
        <div class="fee-box-label">Outstanding</div>
      </div>
    </div>

    ${feeRecord?.total > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:6px;">
        <span>Payment Progress</span>
        <span>${Math.round(((feeRecord?.paid || 0) / (feeRecord?.total || 1)) * 100)}% paid</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${Math.min(100, Math.round(((feeRecord?.paid || 0) / (feeRecord?.total || 1)) * 100))}%"></div>
      </div>
    </div>` : ''}

    <div class="section-label">Payment History</div>
    ${payments.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Amount</th>
          <th>Method</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
    </table>` : `<div style="text-align:center;padding:32px;color:#aaa;font-size:14px;">No payments recorded yet</div>`}
  </div>

  <div class="bill-footer">
    <div class="footer-note">This is a computer-generated receipt and does not require a physical signature.</div>
    <div class="footer-stamp">✓ Happy Times Preschool</div>
  </div>
</div>
<div class="watermark">Generated by Happy Times PWA · ${date}</div>
</body>
</html>`;
}

// ─── Payment Progress Ring ──────────────────────
function ProgressRing({ paid, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const radius = 34;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ - (pct / 100) * circ;
  const color = pct >= 100 ? '#4CAF50' : pct >= 60 ? '#F5A623' : '#E8451A';

  return (
    <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="6" />
        <circle
          cx="44" cy="44" r={radius} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, color }}>{pct}%</span>
        <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>PAID</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────
export default function FeeRecorder() {
  const navigate = useNavigate();
  const handleBack = () => navigate('/super-admin');
  const toast = useToast();
  const [view, setView] = useState('browse'); // browse | student
  const [branches, setBranches] = useState([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Student detail view
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feeRecord, setFeeRecord] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showSetFee, setShowSetFee] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'Cash', notes: '' });
  const [feeForm, setFeeForm] = useState({ total: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  // Load branches on mount
  useState(() => {
    getBranches().then(b => {
      setBranches(b);
      setBranchesLoaded(true);
    }).catch(console.warn);
  });

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const all = await getStudents(filterBranch || null, filterClass || null);
      setStudents(all);
      setStudentsLoaded(true);
    } catch (e) {
      toast.error('Failed to load students');
    }
    setLoadingStudents(false);
  }, [filterBranch, filterClass]);

  const openStudent = useCallback(async (student) => {
    setSelectedStudent(student);
    setView('student');
    setLoadingDetail(true);
    try {
      const [fr, ph] = await Promise.all([getFeeRecord(student.id), getPaymentHistory(student.id)]);
      setFeeRecord(fr);
      setPayments(ph);
    } catch (e) {
      toast.error('Failed to load fee details');
    }
    setLoadingDetail(false);
  }, []);

  const handleAddPayment = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const confirmed = window.confirm(
      `Record ₹${Number(payForm.amount).toLocaleString()} via ${payForm.method} for ${selectedStudent.name}?`
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await addPayment(selectedStudent.id, payForm);
      toast.success('Payment recorded!');
      setShowAddPayment(false);
      setPayForm({ amount: '', method: 'Cash', notes: '' });
      const [fr, ph] = await Promise.all([getFeeRecord(selectedStudent.id), getPaymentHistory(selectedStudent.id)]);
      setFeeRecord(fr);
      setPayments(ph);
    } catch (e) {
      toast.error('Failed to record payment');
    }
    setSaving(false);
  };

  const handleSetFee = async () => {
    if (!feeForm.total || Number(feeForm.total) <= 0) {
      toast.error('Enter a valid fee amount');
      return;
    }
    const confirmed = window.confirm(
      `Set total fee to ₹${Number(feeForm.total).toLocaleString()} for ${selectedStudent.name}?`
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await setFeeTotal(selectedStudent.id, Number(feeForm.total), feeForm.dueDate || null);
      toast.success('Fee total updated!');
      setShowSetFee(false);
      setFeeForm({ total: '', dueDate: '' });
      const fr = await getFeeRecord(selectedStudent.id);
      setFeeRecord(fr);
    } catch (e) {
      toast.error('Failed to update fee');
    }
    setSaving(false);
  };

  const handleDownloadBill = () => {
    const receiptId = `HT-${Date.now().toString(36).toUpperCase()}`;
    const html = generateBillHTML(selectedStudent, feeRecord, payments, receiptId);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Open in new tab for printing/saving as PDF
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        setTimeout(() => {
          win.print();
          URL.revokeObjectURL(url);
        }, 500);
      };
    } else {
      // Fallback: direct download
      const a = document.createElement('a');
      a.href = url;
      a.download = `FeeReceipt_${selectedStudent.name.replace(/\s+/g, '_')}_${receiptId}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    toast.success('Bill generated!');
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    return s.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ── Browse View ──────────────────────────────────
  if (view === 'browse') {
    return (
      <div className="page-shell fade-in">
        {/* Header */}
        <div className="app-header-glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleBack}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                color: 'white', fontSize: 18, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              ←
            </button>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Super Admin</div>
              <h1 style={{ fontSize: 18, fontWeight: 700 }}>Fee Recorder</h1>
            </div>
          </div>
        </div>

        <div className="page-content">
          {/* Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {/* Search */}
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input
                placeholder="Search student by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Branch & Class selectors */}
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="input"
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                style={{ flex: 1, fontSize: 13 }}
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select
                className="input"
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
                style={{ flex: 1, fontSize: 13 }}
              >
                <option value="">All Classes</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={loadStudents}
              disabled={loadingStudents}
              style={{ width: '100%' }}
            >
              {loadingStudents ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white', margin: '0 auto' }} /> : '🔎 Load Students'}
            </button>
          </div>

          {/* Student List */}
          {loadingStudents ? (
            <Skeleton type="list" count={6} />
          ) : studentsLoaded ? (
            filteredStudents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredStudents.map(s => {
                  const paid = s.feePaid || 0;
                  const total = s.feeTotal || 0;
                  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                  const statusColor = pct >= 100 ? '#4CAF50' : pct >= 60 ? '#F5A623' : '#E8451A';

                  return (
                    <button
                      key={s.id}
                      onClick={() => openStudent(s)}
                      style={{
                        background: 'white',
                        border: '1px solid rgba(26,35,64,0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(26,35,64,0.05)',
                      }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: `linear-gradient(135deg, ${statusColor}22, ${statusColor}11)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, color: statusColor, flexShrink: 0,
                      }}>
                        {s.name?.[0]?.toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                          {s.classId} · {s.branchId}
                        </div>
                        {total > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
                              <span>₹{paid.toLocaleString()} paid of ₹{total.toLocaleString()}</span>
                              <span style={{ color: statusColor, fontWeight: 700 }}>{pct}%</span>
                            </div>
                            <div style={{ height: 4, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${pct}%`,
                                background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)`,
                                borderRadius: 99, transition: 'width 0.5s ease',
                              }} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        {total > 0 ? (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 800, color: total - paid > 0 ? '#E8451A' : '#4CAF50' }}>
                              ₹{(total - paid).toLocaleString()}
                            </div>
                            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
                              {total - paid > 0 ? 'DUE' : 'CLEAR'}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>No fee<br />set</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">👨‍🎓</div>
                <div className="empty-state-title">No students found</div>
                <div className="empty-state-text">Try adjusting your filters or search query</div>
              </div>
            )
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">Browse Students</div>
              <div className="empty-state-text">Filter by branch and class, then tap Load Students</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Student Detail View ──────────────────────────
  return (
    <div className="page-shell fade-in">
      {/* Header */}
      <div className="app-header-glass">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/super-admin')}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                color: 'white', fontSize: 18, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              ←
            </button>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Fee Recorder</div>
              <h1 style={{ fontSize: 16, fontWeight: 700 }}>{selectedStudent?.name}</h1>
            </div>
          </div>
          {/* Download Bill button */}
          <button
            onClick={handleDownloadBill}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(245, 166, 35, 0.2)', border: '1px solid rgba(245,166,35,0.4)',
              borderRadius: 10, color: '#F5A623', fontSize: 12, fontWeight: 700,
              padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span>⬇</span> Receipt
          </button>
        </div>
      </div>

      <div className="page-content">
        {loadingDetail ? (
          <Skeleton type="stat" count={3} />
        ) : (
          <>
            {/* Student Card */}
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              boxShadow: '0 2px 12px rgba(26,35,64,0.08)',
              border: '1px solid rgba(26,35,64,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'linear-gradient(135deg, #E8451A22, #F5A62322)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800, color: '#E8451A', flexShrink: 0,
                }}>
                  {selectedStudent?.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E' }}>{selectedStudent?.name}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                    {selectedStudent?.classId} · {selectedStudent?.branchId}
                  </div>
                  {selectedStudent?.dob && (
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      🎂 DOB: {selectedStudent.dob}
                    </div>
                  )}
                  {feeRecord?.dueDate && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      marginTop: 6, fontSize: 12, fontWeight: 600,
                      color: '#E65100', background: '#FFF3E0',
                      padding: '3px 10px', borderRadius: 99,
                    }}>
                      📅 Due: {new Date(feeRecord.dueDate).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
                {/* Progress Ring */}
                <ProgressRing paid={feeRecord?.paid || 0} total={feeRecord?.total || 0} />
              </div>
            </div>

            {/* Fee Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total', value: feeRecord?.total || 0, bg: '#EEF2FF', border: '#C7D2FE', color: '#3730A3', icon: '💳' },
                { label: 'Paid', value: feeRecord?.paid || 0, bg: '#E8F5E9', border: '#A5D6A7', color: '#2E7D32', icon: '✅' },
                { label: 'Due', value: feeRecord?.pending || 0, bg: '#FFF3E0', border: '#FFCC80', color: '#E65100', icon: '⚠️' },
              ].map(box => (
                <div key={box.label} style={{
                  background: box.bg, border: `1px solid ${box.border}`,
                  borderRadius: 14, padding: 14, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>{box.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: box.color }}>
                    ₹{Number(box.value).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginTop: 2 }}>
                    {box.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            {(feeRecord?.total || 0) > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>
                  <span>Payment progress</span>
                  <span style={{ fontWeight: 700 }}>
                    {Math.round(((feeRecord?.paid || 0) / (feeRecord?.total || 1)) * 100)}% paid
                  </span>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round(((feeRecord?.paid || 0) / (feeRecord?.total || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #E8451A, #F5A623)',
                    borderRadius: 99,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddPayment(true)}
                style={{ flex: 1 }}
              >
                + Add Payment
              </button>
              <button
                className="btn btn-outline"
                onClick={() => { setFeeForm({ total: feeRecord?.total?.toString() || '', dueDate: feeRecord?.dueDate || '' }); setShowSetFee(true); }}
                style={{ flex: 1 }}
              >
                ✏️ Set Fee Total
              </button>
            </div>

            {/* Payment History */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Payment History</div>
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px',
                  background: '#f0f0f0', borderRadius: 99, color: '#666',
                }}>
                  {payments.length} {payments.length === 1 ? 'record' : 'records'}
                </div>
              </div>

              {payments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {payments.map((p, i) => (
                    <div key={p.id} style={{
                      background: 'white',
                      border: '1px solid rgba(26,35,64,0.07)',
                      borderRadius: 14,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      boxShadow: '0 1px 4px rgba(26,35,64,0.05)',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: '#E8F5E9', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#2E7D32',
                        flexShrink: 0,
                      }}>
                        #{payments.length - i}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#2E7D32' }}>
                          ₹{Number(p.amount || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            background: '#f0f0f0', padding: '1px 8px',
                            borderRadius: 99, fontWeight: 600, color: '#555',
                          }}>{p.method || 'Cash'}</span>
                          {p.notes && <span style={{ color: '#9CA3AF' }}>· {p.notes}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right', flexShrink: 0 }}>
                        {p.date?.toDate?.()?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || '—'}
                        <div style={{ marginTop: 2 }}>
                          {p.date?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) || ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">💳</div>
                  <div className="empty-state-title">No payments yet</div>
                  <div className="empty-state-text">Tap "+ Add Payment" to record the first payment</div>
                </div>
              )}
            </div>

            {/* Download Bill CTA */}
            <button
              onClick={handleDownloadBill}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginTop: 24,
                padding: '14px',
                background: 'linear-gradient(135deg, #1A2340, #2A3550)',
                color: 'white',
                border: 'none',
                borderRadius: 16,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(26,35,64,0.2)',
              }}
            >
              <span>⬇</span>
              <span>Download Fee Receipt / Bill</span>
            </button>
          </>
        )}
      </div>

      {/* Add Payment Modal */}
      <Modal open={showAddPayment} onClose={() => setShowAddPayment(false)} title="Add Payment">
        <div className="flex flex-col gap-12">
          <div className="input-group">
            <label>Amount (₹)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={payForm.amount}
              onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="e.g. 5000"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Payment Method</label>
            <select className="input" value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))}>
              {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Notes (optional)</label>
            <input
              className="input"
              value={payForm.notes}
              onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Term 2, partial payment"
            />
          </div>
          <button className="btn btn-primary" onClick={handleAddPayment} disabled={saving}>
            {saving ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white', margin: '0 auto' }} /> : 'Record Payment'}
          </button>
        </div>
      </Modal>

      {/* Set Fee Total Modal */}
      <Modal open={showSetFee} onClose={() => setShowSetFee(false)} title="Set Fee Total">
        <div className="flex flex-col gap-12">
          <div className="input-group">
            <label>Total Annual / Term Fee (₹)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={feeForm.total}
              onChange={e => setFeeForm(p => ({ ...p, total: e.target.value }))}
              placeholder="e.g. 35000"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Due Date (optional)</label>
            <input
              className="input"
              type="date"
              value={feeForm.dueDate}
              onChange={e => setFeeForm(p => ({ ...p, dueDate: e.target.value }))}
            />
          </div>
          {feeRecord?.paid > 0 && feeForm.total && (
            <div style={{
              padding: 12, background: '#FFF3E0', border: '1px solid #FFCC80',
              borderRadius: 10, fontSize: 13, color: '#E65100',
            }}>
              ⚠️ Setting the fee total to ₹{Number(feeForm.total).toLocaleString()} with ₹{(feeRecord?.paid || 0).toLocaleString()} already paid.
              Pending will be ₹{(Number(feeForm.total) - (feeRecord?.paid || 0)).toLocaleString()}.
            </div>
          )}
          <button className="btn btn-primary" onClick={handleSetFee} disabled={saving}>
            {saving ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white', margin: '0 auto' }} /> : 'Save Fee Total'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

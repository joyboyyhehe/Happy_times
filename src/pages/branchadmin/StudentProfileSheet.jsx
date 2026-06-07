import React, { useState, useEffect } from 'react';
import BottomSheet from '../../components/BottomSheet.jsx';
import Modal from '../../components/Modal.jsx';
import DatePickerField from '../../components/DatePickerField.jsx';
import { useStudents } from '../../hooks/useStudents.js';

export default function StudentProfileSheet({ student, onClose, onRefresh, drillClass }) {
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    dob: '',
    bloodGroup: '',
    medicalNotes: '',
    phone1: '',
    phone2: '',
  });

  const { handleUpdateStudent, loading } = useStudents();

  useEffect(() => {
    if (student) {
      setEditForm({
        name: student.name || '',
        dob: student.dob || '',
        bloodGroup: student.bloodGroup || '',
        medicalNotes: student.medicalNotes || '',
        phone1: student.phone1 || '',
        phone2: student.phone2 || '',
      });
    }
  }, [student]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const success = await handleUpdateStudent(student.id, editForm);
    if (success) {
      setShowEdit(false);
      onRefresh(); // trigger reload of student lists
      onClose();   // close panel
    }
  };

  if (!student) return null;

  return (
    <BottomSheet open={!!student} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header / Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 16 }}>
          <div
            className="avatar"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--primary-light)',
              color: 'white',
              fontSize: 32,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10
            }}
          >
            {student.name?.[0]}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
            {student.name}
          </h3>
          <span className="badge badge-primary" style={{ marginTop: 4 }}>
            {drillClass || student.classId}
          </span>
        </div>

        {/* Info rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Date of Birth:</span>
            <strong style={{ color: 'var(--text-dark)' }}>{student.dob || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Blood Group:</span>
            <strong style={{ color: 'var(--text-dark)' }}>{student.bloodGroup || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Primary Phone:</span>
            <strong style={{ color: 'var(--text-dark)' }}>{student.phone1 || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Secondary Phone:</span>
            <strong style={{ color: 'var(--text-dark)' }}>{student.phone2 || '—'}</strong>
          </div>
          <div>
            <span style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 2 }}>Medical Notes / Allergies:</span>
            <strong style={{ color: 'var(--text-dark)', display: 'block', background: 'var(--bg)', padding: 10, borderRadius: 8, marginTop: 4 }}>
              {student.medicalNotes || 'No medical conditions noted.'}
            </strong>
          </div>
        </div>

        {/* Linked Parents */}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>Linked Parent Accounts</h4>
          {student.parentUids && student.parentUids.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {student.parentUids.map(uid => (
                <div key={uid} style={{ fontSize: 12, color: 'var(--text-dark)', padding: '6px 12px', background: 'var(--bg)', borderRadius: 6 }}>
                  🔑 Parent UID: <code>{uid}</code>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-hint)' }}>
              No parent accounts linked yet. (Linked automatically on parent first sign-in using primary phone number).
            </p>
          )}
        </div>

        {/* Action buttons (No Delete zone for Branch Admin) */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            className="btn btn-outline"
            style={{ flex: 1 }}
            onClick={() => setShowEdit(true)}
          >
            ✏️ Edit Details
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Student Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Student Profile">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-12">
          <div className="input-group">
            <label>Student Full Name *</label>
            <input
              type="text"
              className="input"
              placeholder="Enter student name"
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DatePickerField
              label="Date of Birth"
              value={editForm.dob}
              onChange={val => setEditForm({ ...editForm, dob: val })}
            />
            <div className="input-group">
              <label>Blood Group</label>
              <select
                className="input"
                value={editForm.bloodGroup}
                onChange={e => setEditForm({ ...editForm, bloodGroup: e.target.value })}
              >
                <option value="">Select</option>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>Primary Phone *</label>
              <input
                type="tel"
                className="input"
                placeholder="Guardian Phone"
                value={editForm.phone1}
                onChange={e => setEditForm({ ...editForm, phone1: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label>Secondary Phone</label>
              <input
                type="tel"
                className="input"
                placeholder="Alternate Phone"
                value={editForm.phone2}
                onChange={e => setEditForm({ ...editForm, phone2: e.target.value })}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Medical Notes / Allergies</label>
            <textarea
              className="input"
              placeholder="Asthma, peanut allergy, etc. (optional)"
              value={editForm.medicalNotes}
              onChange={e => setEditForm({ ...editForm, medicalNotes: e.target.value })}
              style={{ minHeight: 60, fontFamily: 'inherit' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={loading}>
            Save Changes
          </button>
        </form>
      </Modal>
    </BottomSheet>
  );
}

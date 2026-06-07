import React, { useState, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents.js';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import DatePickerField from '../../components/DatePickerField.jsx';
import { CLASSES } from '../../constants/classes.js';

export default function ClassStudentsPanel({ branchId, pop, onSelectStudent, stats }) {
  const [drillClass, setDrillClass] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '',
    dob: '',
    bloodGroup: '',
    medicalNotes: '',
    phone1: '',
    phone2: '',
  });

  const { students, loading, loadStudents, handleAddStudent } = useStudents();

  useEffect(() => {
    if (branchId && drillClass) {
      loadStudents(branchId, drillClass);
    }
  }, [branchId, drillClass, loadStudents]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const success = await handleAddStudent(studentForm, branchId, drillClass);
    if (success) {
      setShowAddStudent(false);
      setStudentForm({ name: '', dob: '', bloodGroup: '', medicalNotes: '', phone1: '', phone2: '' });
      loadStudents(branchId, drillClass);
    }
  };

  const handleBack = () => {
    if (drillClass) {
      setDrillClass('');
    } else {
      pop();
    }
  };

  return (
    <div className="overlay-panel open">
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={handleBack}>←</button>
        <h2>{drillClass ? `${drillClass} Students` : 'Student Management'}</h2>
      </div>
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        {!drillClass ? (
          <div className="flex flex-col gap-10">
            {CLASSES.map(c => {
              const count = stats?.classProgress?.[c]?.total || 0;
              return (
                <div
                  key={c}
                  className="card"
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => setDrillClass(c)}
                >
                  <div>
                    <strong style={{ fontSize: 16, color: 'var(--navy)' }}>{c}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 4 }}>{count} Enrolled</p>
                  </div>
                  <span style={{ fontSize: 20, color: 'var(--text-hint)' }}>›</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 80 }}>
            {loading ? (
              <Skeleton type="list" count={5} />
            ) : students.length > 0 ? (
              <div className="flex flex-col gap-8">
                {students.map(s => (
                  <div
                    key={s.id}
                    className="list-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectStudent(s, drillClass)}
                  >
                    <div className="avatar" style={{ background: 'var(--info-light)', color: 'var(--info)', fontWeight: 'bold' }}>
                      {s.name?.[0]}
                    </div>
                    <div className="list-item-content">
                      <div className="list-item-title">{s.name}</div>
                      <div className="list-item-subtitle">Contact: {s.phone1 || '—'}</div>
                    </div>
                    <span style={{ color: 'var(--text-hint)', fontSize: 16 }}>›</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                emoji="👶"
                title="No Students Enrolled"
                subtitle={`Add students to ${drillClass} to take attendance.`}
                onAction={() => setShowAddStudent(true)}
                actionLabel="Add Student"
              />
            )}

            <button
              className="fab-extended"
              onClick={() => {
                setStudentForm({ name: '', dob: '', bloodGroup: '', medicalNotes: '', phone1: '', phone2: '' });
                setShowAddStudent(true);
              }}
            >
              <span>➕</span> Add Student
            </button>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal open={showAddStudent} onClose={() => setShowAddStudent(false)} title="Add New Student">
        <form onSubmit={handleAddSubmit} className="flex flex-col gap-12">
          <div className="input-group">
            <label>Student Full Name *</label>
            <input
              type="text"
              className="input"
              placeholder="Enter student name"
              value={studentForm.name}
              onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DatePickerField
              label="Date of Birth"
              value={studentForm.dob}
              onChange={val => setStudentForm({ ...studentForm, dob: val })}
            />
            <div className="input-group">
              <label>Blood Group</label>
              <select
                className="input"
                value={studentForm.bloodGroup}
                onChange={e => setStudentForm({ ...studentForm, bloodGroup: e.target.value })}
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
                value={studentForm.phone1}
                onChange={e => setStudentForm({ ...studentForm, phone1: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label>Secondary Phone</label>
              <input
                type="tel"
                className="input"
                placeholder="Alternate Phone"
                value={studentForm.phone2}
                onChange={e => setStudentForm({ ...studentForm, phone2: e.target.value })}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Medical Notes / Allergies</label>
            <textarea
              className="input"
              placeholder="Asthma, peanut allergy, etc. (optional)"
              value={studentForm.medicalNotes}
              onChange={e => setStudentForm({ ...studentForm, medicalNotes: e.target.value })}
              style={{ minHeight: 60, fontFamily: 'inherit' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
            Add Student to {drillClass}
          </button>
        </form>
      </Modal>
    </div>
  );
}

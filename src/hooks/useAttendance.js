import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast.jsx';
import { getAttendance, getAttendanceLockTime, isAttendanceLocked, batchSaveAttendance } from '../services/firestore.js';

export function useAttendance() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [attSaving, setAttSaving] = useState(false);
  const [attRecords, setAttRecords] = useState({});
  const [pendingAttRecords, setPendingAttRecords] = useState({});
  const [attHasUnsaved, setAttHasUnsaved] = useState(false);
  const [lockTime, setLockTime] = useState('10:00');
  const [locked, setLocked] = useState(false);

  const loadAttendance = useCallback(async (branchId, selectedClass, attDate) => {
    if (!branchId || !selectedClass) return;
    setLoading(true);
    try {
      const [records, lt] = await Promise.all([
        getAttendance(branchId, selectedClass, attDate),
        getAttendanceLockTime(),
      ]);
      setAttRecords(records);
      setPendingAttRecords({});
      setAttHasUnsaved(false);
      setLockTime(lt);
      setLocked(isAttendanceLocked(lt));
    } catch (e) {
      console.error('Failed to load attendance:', e);
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleAttToggle = useCallback((studentId, status) => {
    if (locked) return;
    setPendingAttRecords(prev => ({ ...prev, [studentId]: status }));
    setAttHasUnsaved(true);
  }, [locked]);

  const handleMarkAllPresent = useCallback((students) => {
    if (locked || !students || students.length === 0) return;
    const all = { ...pendingAttRecords };
    students.forEach(s => {
      const current = pendingAttRecords[s.id] ?? attRecords[s.id]?.status;
      if (current !== 'absent' && current !== 'on_leave') {
        all[s.id] = 'present';
      }
    });
    setPendingAttRecords(all);
    setAttHasUnsaved(true);
  }, [locked, pendingAttRecords, attRecords]);

  const handleSaveAttendance = useCallback(async (branchId, selectedClass, attDate, students) => {
    if (!branchId || !selectedClass || !students || students.length === 0) return;
    setAttSaving(true);
    try {
      const fullRecordsToSave = {};
      students.forEach(s => {
        const status = pendingAttRecords[s.id] ?? attRecords[s.id]?.status ?? 'present';
        fullRecordsToSave[s.id] = status;
      });

      await batchSaveAttendance(branchId, selectedClass, attDate, fullRecordsToSave);
      setAttRecords(prev => {
        const merged = { ...prev };
        Object.entries(fullRecordsToSave).forEach(([id, status]) => {
          merged[id] = { ...(merged[id] || {}), status };
        });
        return merged;
      });
      setPendingAttRecords({});
      setAttHasUnsaved(false);
      toast.success('Attendance saved successfully!');
    } catch (e) {
      console.error('Failed to save attendance:', e);
      toast.error('Failed to save attendance. Please try again.');
    } finally {
      setAttSaving(false);
    }
  }, [pendingAttRecords, attRecords, toast]);

  const clearPending = useCallback(() => {
    setPendingAttRecords({});
    setAttHasUnsaved(false);
  }, []);

  return {
    loading,
    attSaving,
    attRecords,
    pendingAttRecords,
    attHasUnsaved,
    lockTime,
    locked,
    loadAttendance,
    handleAttToggle,
    handleMarkAllPresent,
    handleSaveAttendance,
    clearPending,
  };
}

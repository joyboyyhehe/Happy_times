import { useState, useCallback } from 'react';
import {
  createLeave,
  getMyLeaves,
  getBranchLeaves,
  updateLeaveStatus,
  getAllLeaves,
} from '../services/firestore.js';

/**
 * useLeaves — Leave CRUD hook with loading/error state.
 *
 * Usage (Parent):
 *   const { leaves, loading, error, submitLeave, reload } = useLeaves({ mode: 'parent', parentUid });
 *
 * Usage (Branch Admin):
 *   const { leaves, loading, pendingCount, approveLeave, rejectLeave, reload } =
 *     useLeaves({ mode: 'branch', branchId });
 *
 * Usage (Super Admin):
 *   const { leaves, loading, pendingCount, approveLeave, rejectLeave, reload } =
 *     useLeaves({ mode: 'all' });
 */
export function useLeaves({ mode, parentUid, branchId, status } = {}) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (mode === 'parent' && parentUid) {
        data = await getMyLeaves(parentUid);
      } else if (mode === 'branch' && branchId) {
        data = await getBranchLeaves(branchId, status);
      } else if (mode === 'all') {
        data = await getAllLeaves(status);
      } else {
        data = [];
      }
      setLeaves(data);
    } catch (err) {
      console.error('useLeaves reload error:', err);
      setError(err.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  }, [mode, parentUid, branchId, status]);

  const submitLeave = useCallback(async (leaveData) => {
    setSubmitting(true);
    try {
      await createLeave(leaveData);
      await reload();
      return { success: true };
    } catch (err) {
      console.error('useLeaves submitLeave error:', err);
      return { success: false, error: err.message };
    } finally {
      setSubmitting(false);
    }
  }, [reload]);

  const approveLeave = useCallback(async (leaveId, reviewerUid, reviewerName) => {
    try {
      await updateLeaveStatus(leaveId, { status: 'approved', reviewerUid, reviewerName });
      // Optimistically update local state
      setLeaves((prev) =>
        prev.map((l) => l.id === leaveId
          ? { ...l, status: 'approved', reviewerName, reviewedAt: new Date().toISOString() }
          : l
        )
      );
      return { success: true };
    } catch (err) {
      console.error('useLeaves approveLeave error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const rejectLeave = useCallback(async (leaveId, reviewerUid, reviewerName) => {
    try {
      await updateLeaveStatus(leaveId, { status: 'rejected', reviewerUid, reviewerName });
      setLeaves((prev) =>
        prev.map((l) => l.id === leaveId
          ? { ...l, status: 'rejected', reviewerName, reviewedAt: new Date().toISOString() }
          : l
        )
      );
      return { success: true };
    } catch (err) {
      console.error('useLeaves rejectLeave error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;

  return {
    leaves,
    loading,
    error,
    submitting,
    pendingCount,
    reload,
    submitLeave,
    approveLeave,
    rejectLeave,
  };
}

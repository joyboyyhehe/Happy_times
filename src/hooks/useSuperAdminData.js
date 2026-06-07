import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast.jsx';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { getBranches, getStaffWhitelist, getAttendanceLockTime, setAttendanceLockTime } from '../services/firestore.js';

export function useSuperAdminData() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalPending: 0 });
  const [lockTime, setLockTime] = useState('10:00');
  const [lockTimeInput, setLockTimeInput] = useState('10:00');

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const b = await getBranches();
      setBranches(b);
      return b;
    } catch (e) {
      console.error('Failed to load branches:', e);
      toast.error('Failed to load branches');
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadWhitelist = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getStaffWhitelist();
      setWhitelist(list);
    } catch (e) {
      console.error('Failed to load whitelist:', e);
      toast.error('Failed to load whitelist');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const b = await getBranches();
      setBranches(b);

      const studentsSnap = await getDocs(collection(db, 'students'));
      const studs = studentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.archived !== true);
      setAllStudents(studs);

      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const leavesSnap = await getDocs(query(collection(db, 'leaves'), where('status', '==', 'pending')));
      const allPendingLeaves = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const totalStudents = studs.length;
      const totalFeeTotal = studs.reduce((sum, st) => sum + (st.feeTotal || 0), 0);
      const totalFeePaid = studs.reduce((sum, st) => sum + (st.feePaid || 0), 0);
      const totalPending = totalFeeTotal - totalFeePaid;
      
      // Count Branch Admins (role === 'branchadmin')
      const totalAdminsCount = allUsers.filter(u => u.role === 'branchadmin').length;

      const branchMetrics = {};
      b.forEach(br => {
        const branchStudentsCount = studs.filter(s => s.branchId === br.id).length;
        const branchAdminsCount = allUsers.filter(u => u.branchId === br.id && u.role === 'branchadmin').length;
        const branchPendingLeavesCount = allPendingLeaves.filter(l => l.branchId === br.id).length;
        branchMetrics[br.id] = {
          students: branchStudentsCount,
          admins: branchAdminsCount,
          pending: branchPendingLeavesCount
        };
      });

      setStats({
        totalStudents,
        totalFeeTotal,
        totalFeePaid,
        totalPending,
        totalBranches: b.length,
        totalAdmins: totalAdminsCount,
        pendingLeaves: allPendingLeaves.length,
        branchMetrics
      });

      const lt = await getAttendanceLockTime();
      setLockTime(lt);
      setLockTimeInput(lt);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateLockSettings = useCallback(async (time) => {
    try {
      await setAttendanceLockTime(time);
      setLockTime(time);
      setLockTimeInput(time);
      toast.success(`Attendance lock time updated to ${time}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update lock time');
    }
  }, [toast]);

  return {
    loading,
    branches,
    whitelist,
    allStudents,
    stats,
    lockTime,
    lockTimeInput,
    setLockTimeInput,
    loadBranches,
    loadWhitelist,
    loadDashboard,
    updateLockSettings,
  };
}

import { useState, useCallback } from 'react';
import { getDashboardStats, getStudents, getAttendance } from '../services/firestore.js';
import { CLASSES } from '../constants/classes.js';

export function useDashboardStats() {
  const [stats, setStats] = useState({ totalStudents: 0 });
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async (branchId) => {
    if (!branchId) return;
    setLoading(true);
    try {
      const s = await getDashboardStats(branchId);
      const todayDateStr = new Date().toISOString().slice(0, 10);
      const classProgress = {};
      
      await Promise.all(CLASSES.map(async (className) => {
        try {
          const studs = await getStudents(branchId, className);
          const att = await getAttendance(branchId, className, todayDateStr);
          const total = studs.length;
          const present = Object.values(att).filter(r => r.status === 'present').length;
          const rate = total > 0 ? Math.round((present / total) * 100) : 0;
          classProgress[className] = { total, present, rate };
        } catch (err) {
          classProgress[className] = { total: 0, present: 0, rate: 0 };
        }
      }));

      setStats({ ...s, classProgress });
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, loadDashboard };
}

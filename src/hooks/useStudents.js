import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast.jsx';
import { getStudents, addStudent, updateStudent, deleteStudent } from '../services/firestore.js';

export function useStudents() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);

  const loadStudents = useCallback(async (branchId, classId = null) => {
    if (!branchId) return;
    setLoading(true);
    try {
      const list = await getStudents(branchId, classId);
      setStudents(list);
    } catch (e) {
      console.error('Failed to load students:', e);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleAddStudent = useCallback(async (studentForm, branchId, classId) => {
    if (!studentForm.name.trim()) {
      toast.error('Student Name is required');
      return false;
    }
    setLoading(true);
    try {
      await addStudent({
        ...studentForm,
        branchId,
        classId,
        className: classId,
        parentUids: [],
        feeTotal: 0,
        feePaid: 0,
      });
      toast.success('Student added successfully!');
      return true;
    } catch (e) {
      console.error('Failed to add student:', e);
      toast.error('Failed to add student');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleUpdateStudent = useCallback(async (studentId, studentForm) => {
    if (!studentForm.name.trim()) {
      toast.error('Student Name is required');
      return false;
    }
    setLoading(true);
    try {
      await updateStudent(studentId, studentForm);
      toast.success('Student profile updated successfully!');
      return true;
    } catch (e) {
      console.error('Failed to update student:', e);
      toast.error('Failed to update student');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleDeleteStudent = useCallback(async (studentId) => {
    setLoading(true);
    try {
      await deleteStudent(studentId);
      toast.success('Student record deleted (archived)');
      return true;
    } catch (e) {
      console.error('Failed to delete student:', e);
      toast.error('Failed to delete student');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    students,
    loadStudents,
    handleAddStudent,
    handleUpdateStudent,
    handleDeleteStudent,
  };
}

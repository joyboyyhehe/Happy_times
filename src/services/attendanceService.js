import {
  getAttendance as fbGetAttendance,
  getStudentAttendanceMonth as fbGetStudentAttendanceMonth,
  getAttendanceLockTime as fbGetAttendanceLockTime,
  isAttendanceLocked as fbIsAttendanceLocked,
  batchSaveAttendance as fbBatchSaveAttendance,
  setAttendanceLockTime as fbSetAttendanceLockTime
} from './firestore.js';

/**
 * Load attendance for a branch, class, and date.
 */
export async function loadClassAttendance(branchId, classId, date) {
  try {
    return await fbGetAttendance(branchId, classId, date);
  } catch (error) {
    console.error('[attendanceService] Error loading attendance:', error);
    throw new Error('Unable to load attendance records. Please check your network connection.');
  }
}

/**
 * Load student monthly attendance mapping.
 */
export async function loadStudentAttendanceMonth(studentId, branchId, classId, year, month) {
  try {
    return await fbGetStudentAttendanceMonth(studentId, branchId, classId, year, month);
  } catch (error) {
    console.error('[attendanceService] Error loading student monthly attendance:', error);
    throw new Error('Unable to load monthly attendance records.');
  }
}

/**
 * Save marked records in a single batch.
 */
export async function saveAttendance(branchId, classId, date, records) {
  try {
    await fbBatchSaveAttendance(branchId, classId, date, records);
  } catch (error) {
    console.error('[attendanceService] Error saving attendance:', error);
    throw new Error('Unable to save attendance. Please try again.');
  }
}

/**
 * Fetch attendance lock settings.
 */
export async function fetchAttendanceLockSettings() {
  try {
    const lockTime = await fbGetAttendanceLockTime();
    const isLocked = fbIsAttendanceLocked(lockTime);
    return { lockTime, isLocked };
  } catch (error) {
    console.error('[attendanceService] Error fetching lock settings:', error);
    throw new Error('Unable to load attendance lock settings.');
  }
}

/**
 * Set attendance lock time settings.
 */
export async function updateAttendanceLockSettings(timeStr) {
  try {
    await fbSetAttendanceLockTime(timeStr);
  } catch (error) {
    console.error('[attendanceService] Error updating lock settings:', error);
    throw new Error('Unable to update attendance lock settings.');
  }
}

import {
  getFeeRecord as fbGetFeeRecord,
  getPaymentHistory as fbGetPaymentHistory,
  addPayment as fbAddPayment,
  setFeeTotal as fbSetFeeTotal
} from './firestore.js';

/**
 * Fetch a student's fee summary and payment history.
 */
export async function fetchStudentFeeDetails(studentId) {
  try {
    const record = await fbGetFeeRecord(studentId);
    const history = await fbGetPaymentHistory(studentId);
    return { record, history };
  } catch (error) {
    console.error('[feesService] Error fetching student fee details:', error);
    throw new Error('Unable to load fee details. Please check your network connection.');
  }
}

/**
 * Record a manual cash/UPI/Bank payment for a student.
 */
export async function recordPayment(studentId, paymentData) {
  try {
    await fbAddPayment(studentId, paymentData);
  } catch (error) {
    console.error('[feesService] Error recording payment:', error);
    throw new Error('Unable to record payment. Please try again.');
  }
}

/**
 * Adjust the annual/term total fee and due date of a student.
 */
export async function updateFeeTotal(studentId, totalAmount, dueDate) {
  try {
    await fbSetFeeTotal(studentId, totalAmount, dueDate);
  } catch (error) {
    console.error('[feesService] Error updating fee total:', error);
    throw new Error('Unable to update fee record.');
  }
}

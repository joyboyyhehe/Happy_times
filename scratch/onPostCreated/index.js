const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── Helper: Get FCM tokens for a list of parent UIDs ───────────────────────
async function getParentTokens(parentUids) {
  if (!parentUids || parentUids.length === 0) return [];

  const tokens = [];
  for (const uid of parentUids) {
    try {
      const userSnap = await db.collection("users").doc(uid).get();
      if (userSnap.exists) {
        const data = userSnap.data();
        if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
          tokens.push(...data.fcmTokens);
        }
      }
    } catch (err) {
      console.error(`Error fetching tokens for UID ${uid}:`, err);
    }
  }
  return [...new Set(tokens)]; // deduplicate
}

// ─── Helper: Get parent UIDs from a student document ────────────────────────
async function getStudentParentUids(studentId) {
  const snap = await db.collection("students").doc(studentId).get();
  if (!snap.exists) return [];
  return snap.data().parentUids || [];
}

// ─── Helper: Send FCM to a list of tokens ───────────────────────────────────
async function sendToTokens(tokens, notification, data = {}) {
  if (tokens.length === 0) {
    console.log("No tokens to send to");
    return;
  }

  // FCM multicast supports up to 500 tokens per batch
  const batchSize = 500;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch,
        notification,
        data,
        webpush: {
          fcmOptions: {
            link: data.deepLink || "/parent/dashboard",
          },
        },
      });
      console.log(
        `FCM batch sent: ${response.successCount} success, ${response.failureCount} failure`
      );

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            (resp.error?.code === "messaging/invalid-registration-token" ||
              resp.error?.code === "messaging/registration-token-not-registered")
          ) {
            invalidTokens.push(batch[idx]);
          }
        });
        if (invalidTokens.length > 0) {
          console.log(`Cleaning up ${invalidTokens.length} invalid tokens`);
          // Remove invalid tokens from user profiles
          const usersSnap = await db
            .collection("users")
            .where("fcmTokens", "array-contains-any", invalidTokens)
            .get();
          const cleanupPromises = usersSnap.docs.map((userDoc) => {
            const currentTokens = userDoc.data().fcmTokens || [];
            const cleaned = currentTokens.filter((t) => !invalidTokens.includes(t));
            return userDoc.ref.update({ fcmTokens: cleaned });
          });
          await Promise.all(cleanupPromises);
        }
      }
    } catch (err) {
      console.error("FCM send error:", err);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 1: New Post Created → Notify matching parents
// ═══════════════════════════════════════════════════════════════════════════
exports.onPostCreated = onDocumentCreated("posts/{postId}", async (event) => {
  const post = event.data?.data();
  if (!post) return;

  console.log(`New post: "${post.title}" (branch: ${post.branchId}, class: ${post.className || "all"})`);

  const categoryEmojis = {
    circular: "📢",
    announcement: "📣",
    homework: "📚",
    reminder: "⏰",
    update: "🔔",
  };
  const emoji = categoryEmojis[post.category] || "📌";

  // Find all students that match this post's targeting
  let studentsQuery;
  if (post.branchId === "all") {
    // Post targets all branches
    studentsQuery = db.collection("students").where("status", "==", "active");
  } else {
    studentsQuery = db
      .collection("students")
      .where("branchId", "==", post.branchId)
      .where("status", "==", "active");
  }
  const studentsSnap = await studentsQuery.get();

  // Filter by class if post is class-specific
  const matchingStudents = studentsSnap.docs.filter((s) => {
    if (!post.className) return true; // branch-wide post
    return s.data().className === post.className;
  });

  // Collect all parent UIDs
  const parentUids = new Set();
  matchingStudents.forEach((s) => {
    const uids = s.data().parentUids || [];
    uids.forEach((uid) => parentUids.add(uid));
  });

  const tokens = await getParentTokens([...parentUids]);
  console.log(`Sending to ${tokens.length} tokens for ${parentUids.size} parents`);

  await sendToTokens(
    tokens,
    {
      title: `${emoji} ${post.category?.charAt(0).toUpperCase() + post.category?.slice(1) || "Post"}: ${post.title}`,
      body: post.body?.slice(0, 120) || "",
    },
    {
      type: "post",
      postId: event.params.postId,
      deepLink: "/parent/feed",
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 2: Attendance Created → Notify parents
// ═══════════════════════════════════════════════════════════════════════════
exports.onAttendanceCreated = onDocumentCreated("attendance/{attendanceId}", async (event) => {
  const att = event.data?.data();
  if (!att) return;

  const studentId = att.studentId;
  if (!studentId) return;

  // Get student name
  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return;
  const student = studentSnap.data();

  const statusEmoji = {
    present: "✅",
    absent: "❌",
    late: "⏰",
  };
  const emoji = statusEmoji[att.status] || "📋";

  const parentUids = student.parentUids || [];
  const tokens = await getParentTokens(parentUids);

  console.log(`Attendance: ${student.name} marked ${att.status} on ${att.date}`);

  await sendToTokens(
    tokens,
    {
      title: `${emoji} Attendance Update`,
      body: `${student.name} was marked ${att.status} on ${att.date}`,
    },
    {
      type: "attendance",
      studentId,
      deepLink: "/parent/attendance",
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER 3: Fee Updated → Notify parents when payment is recorded
// ═══════════════════════════════════════════════════════════════════════════
exports.onFeeUpdated = onDocumentUpdated("fees/{feeId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;

  const studentId = after.studentId;
  if (!studentId) return;

  const beforePayments = before.payments || [];
  const afterPayments = after.payments || [];

  // Check if a new payment was added
  if (afterPayments.length > beforePayments.length) {
    const newPayment = afterPayments[afterPayments.length - 1];
    const amount = Number(newPayment.amount || 0);

    // Get student name
    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) return;
    const student = studentSnap.data();

    const totalFee = after.totalFee || 0;
    const totalPaid = afterPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
    const pending = Math.max(0, totalFee - totalPaid);

    const parentUids = student.parentUids || [];
    const tokens = await getParentTokens(parentUids);

    console.log(`Fee payment: ₹${amount} for ${student.name}`);

    await sendToTokens(
      tokens,
      {
        title: "💰 Fee Payment Recorded",
        body: `₹${amount.toLocaleString("en-IN")} paid for ${student.name}. Pending: ₹${pending.toLocaleString("en-IN")}`,
      },
      {
        type: "fee_payment",
        studentId,
        deepLink: "/parent/fees",
      }
    );
    return;
  }

  // Check if total fee was updated (fee reminder scenario)
  if (before.totalFee !== after.totalFee) {
    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) return;
    const student = studentSnap.data();

    const totalPaid = afterPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
    const pending = Math.max(0, after.totalFee - totalPaid);

    if (pending > 0) {
      const parentUids = student.parentUids || [];
      const tokens = await getParentTokens(parentUids);

      console.log(`Fee total updated for ${student.name}: ₹${after.totalFee}`);

      await sendToTokens(
        tokens,
        {
          title: "📋 Fee Update",
          body: `Fee package updated for ${student.name}. Total: ₹${after.totalFee.toLocaleString("en-IN")}, Pending: ₹${pending.toLocaleString("en-IN")}`,
        },
        {
          type: "fee_update",
          studentId,
          deepLink: "/parent/fees",
        }
      );
    }
  }
});

// ═══════════════════════════════════════════════
//    Happy Times — Super Admin Approval Portal Logic
//    Vanilla JS ES6, Firebase Compat SDK Integration
//    ═══════════════════════════════════════════════

// 1. Firebase Config Setup (Matches your production Firebase project)
const firebaseConfig = {
  apiKey: "AIzaSyDixFR1hkz9rqEr8rcUen8r7aosAHXXgT0",
  authDomain: "happytimes-preschool-pwa.firebaseapp.com",
  projectId: "happytimes-preschool-pwa",
  storageBucket: "happytimes-preschool-pwa.firebasestorage.app",
  messagingSenderId: "390518602758",
  appId: "1:390518602758:web:bc23ea8bf2ffce9a35d787"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Function to toggle PIN visibility with eye/eye-off icons
function togglePasswordVisibility() {
  const passwordInput = document.getElementById("gatekeeper-password");
  const eyeIcon = document.getElementById("eye-icon");
  
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.setAttribute("data-lucide", "eye-off");
  } else {
    passwordInput.type = "password";
    eyeIcon.setAttribute("data-lucide", "eye");
  }
  lucide.createIcons();
}

// 2. Global State Variables
let allSubmissions = [];
let selectedIds = new Set();
let registrationsListener = null;

// Presets mappings
const branchNames = {
  'padmanabhanagar': 'Padmanabhanagar',
  'outer-ring-road': 'Outer Ring Road',
  'chikkalsandra': 'Chikkalsandra',
  'rr-nagar': 'RR Nagar'
};

// Listen to Auth State Changes in real-time
firebase.auth().onAuthStateChanged(async (user) => {
  console.log("[Auth State]:", user ? `Signed in as ${user.email} (UID: ${user.uid})` : "Signed out");
  
  if (user) {
    try {
      // Fetch user profile from Firestore to verify superadmin role
      const snap = await db.collection("users").doc(user.uid).get();
      const profile = snap.exists() ? snap.data() : null;
      console.log("[Auth Profile]:", profile ? JSON.stringify(profile) : "No profile found in Firestore");

      if (profile && profile.role === "superadmin") {
        // Superadmin verified: unlock portal and load data
        document.getElementById("gatekeeper-overlay").classList.add("hidden");
        document.getElementById("admin-container").classList.remove("hidden");
        sessionStorage.setItem("admin_authorized", "true");
        
        // Load data if not already loading
        if (!registrationsListener) {
          initializeDashboard();
        }
      } else {
        console.warn("[Auth Warning]: Signed-in user is not a superadmin.");
        // If they just logged in but profile isn't superadmin yet (first time email/pass), write it
        if (!profile) {
          console.log("[Auth Action]: Writing first-time superadmin profile...");
          await db.collection("users").doc(user.uid).set({
            name: "Super Admin Portal",
            role: "superadmin",
            email: user.email || "admin@happytimes.com",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          // The update will trigger onAuthStateChanged again
        } else {
          showToast("Access Denied: You are not a Super Admin.", "danger");
          lockPortal();
        }
      }
    } catch (e) {
      console.error("[Auth Profile Fetch Error]:", e);
    }
  } else {
    // If not signed in but sessionStorage says they should be, attempt background login
    const isAuthorized = sessionStorage.getItem("admin_authorized") === "true";
    if (isAuthorized) {
      console.log("[Auth Action]: Bypassed overlay, attempting background re-authentication...");
      try {
        await auth.signInWithEmailAndPassword("superadmin_happytimes_2026@happytimes.com", "happytimes_admin_6754");
      } catch (err) {
        console.warn("[Auth Re-auth Failed]:", err);
        // Fallback to anonymous re-auth
        try {
          await auth.signInAnonymously();
        } catch (anonErr) {
          console.error("[Auth Anonymous Fallback Failed]:", anonErr);
          lockPortal();
        }
      }
    } else {
      // Show password gatekeeper
      document.getElementById("gatekeeper-overlay").classList.remove("hidden");
      document.getElementById("admin-container").classList.add("hidden");
    }
  }
});

// On Load Check
document.addEventListener("DOMContentLoaded", () => {
  // Bind enter key on password input
  document.getElementById("gatekeeper-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlockPortal();
  });
  
  lucide.createIcons();
});

// 3. Gatekeeper Authentication Flow
async function unlockPortal() {
  const passwordInput = document.getElementById("gatekeeper-password");
  const errorBadge = document.getElementById("gatekeeper-error");
  const btn = document.getElementById("gatekeeper-btn");
  const password = passwordInput.value.trim();

  if (password === "6754") {
    // Show loading on button
    btn.disabled = true;
    btn.innerHTML = `<span class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 spin"></i> Authenticating...</span>`;
    lucide.createIcons();
    errorBadge.classList.add("hidden");

    try {
      const email = "superadmin_happytimes_2026@happytimes.com";
      const secretPass = "happytimes_admin_6754";
      let userCredential;

      try {
        // 1. Try signing in with pre-configured admin credentials
        userCredential = await auth.signInWithEmailAndPassword(email, secretPass);
      } catch (authErr) {
        if (authErr.code === "auth/user-not-found") {
          // 2. If user not found, create it on first run
          userCredential = await auth.createUserWithEmailAndPassword(email, secretPass);
          // Set role to superadmin in users collection
          await db.collection("users").doc(userCredential.user.uid).set({
            name: "Super Admin Portal",
            role: "superadmin",
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else if (authErr.code === "auth/operation-not-allowed") {
          // 3. If email/pass is disabled, use Anonymous Auth fallback
          console.warn("Email/Password provider not enabled. Falling back to Anonymous Auth...");
          userCredential = await auth.signInAnonymously();
          // Set role to superadmin in users collection
          await db.collection("users").doc(userCredential.user.uid).set({
            name: "Super Admin (Anonymous)",
            role: "superadmin",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          throw authErr;
        }
      }

      // Ensure the user's role is set to superadmin (handles cases where email/pass was already created but profile document is missing)
      const user = userCredential.user;
      await db.collection("users").doc(user.uid).set({
        role: "superadmin",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Auth Success: Hide overlay
      const overlay = document.getElementById("gatekeeper-overlay");
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.classList.add("hidden");
        document.getElementById("admin-container").classList.remove("hidden");
        sessionStorage.setItem("admin_authorized", "true");
        initializeDashboard();
      }, 400);

    } catch (err) {
      console.error("[Gatekeeper Auth Error]:", err);
      errorBadge.innerText = "Auth failed: " + (err.message || "Unknown error");
      errorBadge.classList.remove("hidden");
      errorBadge.classList.add("animate-shake");
      btn.disabled = false;
      btn.innerHTML = `<span>Unlock Dashboard</span><i data-lucide="unlock" class="w-[18px] h-[18px]"></i>`;
      lucide.createIcons();
      setTimeout(() => { errorBadge.classList.remove("animate-shake"); }, 500);
    }
  } else {
    // Show error with shake animation
    errorBadge.innerText = "Incorrect password. Try again.";
    errorBadge.classList.remove("hidden");
    errorBadge.classList.add("animate-shake");
    passwordInput.value = "";
    passwordInput.focus();
    
    setTimeout(() => {
      errorBadge.classList.remove("animate-shake");
    }, 500);
  }
}

function lockPortal() {
  sessionStorage.removeItem("admin_authorized");
  location.reload();
}

// 4. Initialize Dashboard & Real-time Listeners
function initializeDashboard() {
  showLoading(true);
  
  // Real-time listener for `/registrations` sorted by submittedAt desc
  registrationsListener = db.collection("registrations")
    .orderBy("submittedAt", "desc")
    .onSnapshot((snapshot) => {
      allSubmissions = [];
      snapshot.forEach(doc => {
        allSubmissions.push({ id: doc.id, ...doc.data() });
      });
      
      // Update global count cards
      updateStats();
      
      // Apply filters and render
      applyFilters();
      
      showLoading(false);
    }, (err) => {
      console.error("Firestore onSnapshot error:", err);
      showGlobalError("Failed to stream registrations. Check network or security rules.");
      showLoading(false);
    });
}

// 5. Update Stats
function updateStats() {
  let pending = 0, approved = 0, rejected = 0;
  
  allSubmissions.forEach(item => {
    if (item.status === "pending") pending++;
    else if (item.status === "approved") approved++;
    else if (item.status === "rejected") rejected++;
  });
  
  document.getElementById("stat-pending").innerText = pending;
  document.getElementById("stat-approved").innerText = approved;
  document.getElementById("stat-rejected").innerText = rejected;
  document.getElementById("stat-total").innerText = allSubmissions.length;
}

// 6. Filtering & Search Workflows
function applyFilters() {
  const branchFilter = document.getElementById("filter-branch").value;
  const classFilter = document.getElementById("filter-class").value;
  const statusFilter = document.getElementById("filter-status").value;
  const searchVal = document.getElementById("search-input").value.toLowerCase().trim();
  
  const filtered = allSubmissions.filter(item => {
    // 1. Branch Filter
    if (branchFilter && item.branch !== branchFilter) return false;
    
    // 2. Class Filter
    if (classFilter && item.className !== classFilter) return false;
    
    // 3. Status Filter
    if (statusFilter !== "all") {
      if (item.status !== statusFilter) return false;
    }
    
    // 4. Search Filter
    if (searchVal) {
      const studentName = (item.studentName || "").toLowerCase();
      const parent1Name = (item.parent1?.name || "").toLowerCase();
      const parent1Phone = (item.parent1?.phone || "").toLowerCase();
      const parent2Name = (item.parent2?.name || "").toLowerCase();
      const parent2Phone = (item.parent2?.phone || "").toLowerCase();
      
      const match = studentName.includes(searchVal) ||
                    parent1Name.includes(searchVal) ||
                    parent1Phone.includes(searchVal) ||
                    parent2Name.includes(searchVal) ||
                    parent2Phone.includes(searchVal);
      
      if (!match) return false;
    }
    
    return true;
  });
  
  // Render applications list
  renderApplicationsList(filtered);
}

// 7. Render Registration Applications Cards
function renderApplicationsList(items) {
  const container = document.getElementById("list-content");
  const emptyState = document.getElementById("list-empty");
  
  // Clear container
  container.innerHTML = "";
  
  // Reset bulk selections not in currently displayed set
  const itemIds = new Set(items.map(i => i.id));
  for (let id of selectedIds) {
    if (!itemIds.has(id)) selectedIds.delete(id);
  }
  updateBulkActionToolbar();

  if (items.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  
  emptyState.classList.add("hidden");
  
  items.forEach(item => {
    const isSelected = selectedIds.has(item.id);
    const dateStr = item.submittedAt?.toDate ? item.submittedAt.toDate().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }) : 'Just now';
    
    const card = document.createElement("div");
    card.id = `card-${item.id}`;
    card.className = `registration-card ${isSelected ? 'selected' : ''} animate-fade-in-up tap-effect`;
    
    // Setup status badges
    let statusBadge = "";
    if (item.status === "approved") {
      statusBadge = `<span class="admin-badge admin-badge-approved"><i data-lucide="check" class="w-3 h-3"></i> Approved</span>`;
    } else if (item.status === "rejected") {
      statusBadge = `<span class="admin-badge admin-badge-rejected"><i data-lucide="x" class="w-3 h-3"></i> Rejected</span>`;
    } else {
      statusBadge = `<span class="admin-badge admin-badge-pending"><i data-lucide="clock" class="w-3 h-3"></i> Pending</span>`;
    }

    card.innerHTML = `
      <div class="flex items-start gap-4">
        <!-- Multiselect checkbox -->
        <div class="pt-1.5">
          <input 
            type="checkbox" 
            value="${item.id}" 
            ${isSelected ? 'checked' : ''} 
            ${item.status !== 'pending' ? 'disabled' : ''}
            onchange="toggleItemSelection('${item.id}', this)"
            class="accent-primary w-[18px] h-[18px]"
          >
        </div>
        
        <!-- Main details -->
        <div class="flex-grow min-w-0" onclick="toggleParentDetails('${item.id}')" style="cursor: pointer;">
          <div class="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 class="font-poppins text-lg font-bold text-navy truncate leading-tight">${item.studentName}</h3>
            ${statusBadge}
          </div>
          
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-lighter font-semibold">
            <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i> ${branchNames[item.branch] || item.branch}</span>
            <span class="text-gray-300">•</span>
            <span class="flex items-center gap-1"><i data-lucide="school" class="w-3.5 h-3.5"></i> Class: ${item.className}</span>
            <span class="text-gray-300">•</span>
            <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${dateStr}</span>
          </div>
          
          <!-- Expandable Parent Details Container -->
          <div id="details-${item.id}" class="parent-details-panel mt-4">
            <hr class="border-t border-gray-150/70 mb-3.5">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <!-- Primary Parent details -->
              <div class="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                <h4 class="text-primary font-bold mb-2 uppercase tracking-wider text-[10px] flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i> Primary Guardian</h4>
                <div class="flex flex-col gap-1 text-navy-light">
                  <div>Name: <span class="text-navy font-bold">${item.parent1?.name} (${item.parent1?.relation})</span></div>
                  <div>Phone: <span class="text-navy font-bold">+91 ${item.parent1?.phone}</span></div>
                  ${item.parent1?.email ? `<div>Email: <span class="text-navy font-bold">${item.parent1?.email}</span></div>` : ''}
                </div>
              </div>

              <!-- Secondary Parent details -->
              ${item.parent2 ? `
                <div class="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                  <h4 class="text-navy-lighter font-bold mb-2 uppercase tracking-wider text-[10px] flex items-center gap-1.5"><i data-lucide="users" class="w-3.5 h-3.5"></i> Secondary Guardian</h4>
                  <div class="flex flex-col gap-1 text-navy-light">
                    <div>Name: <span class="text-navy font-bold">${item.parent2?.name} (${item.parent2?.relation})</span></div>
                    ${item.parent2?.phone ? `<div>Phone: <span class="text-navy font-bold">+91 ${item.parent2?.phone}</span></div>` : ''}
                    ${item.parent2?.email ? `<div>Email: <span class="text-navy font-bold">${item.parent2?.email}</span></div>` : ''}
                  </div>
                </div>
              ` : `
                <div class="border border-dashed border-gray-200 rounded-xl p-3 flex items-center justify-center text-navy-lighter text-[11px] font-medium">
                  No secondary guardian registered.
                </div>
              `}
            </div>
          </div>
        </div>
        
        <!-- Inline Action buttons (Only for pending) -->
        ${item.status === 'pending' ? `
          <div class="flex flex-col sm:flex-row items-center gap-2">
            <button 
              onclick="event.stopPropagation(); processApproval('${item.id}', true)" 
              title="Approve registration"
              class="btn-action-icon btn-action-icon-approve tap-effect"
            >
              <i data-lucide="check" class="w-5 h-5 stroke-[2.5]"></i>
            </button>
            
            <button 
              onclick="event.stopPropagation(); processApproval('${item.id}', false)" 
              title="Reject registration"
              class="btn-action-icon btn-action-icon-reject tap-effect"
            >
              <i data-lucide="x" class="w-5 h-5 stroke-[2.5]"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `;
    
    container.appendChild(card);
  });
  
  lucide.createIcons();
}

// 8. Expand Parent Panel logic
function toggleParentDetails(id) {
  const panel = document.getElementById(`details-${id}`);
  if (panel.classList.contains("open")) {
    panel.classList.remove("open");
  } else {
    panel.classList.add("open");
  }
}

// 9. Checkbox Selections & Toolbar animations
function toggleItemSelection(id, checkbox) {
  const card = document.getElementById(`card-${id}`);
  if (checkbox.checked) {
    selectedIds.add(id);
    if (card) card.classList.add("selected");
  } else {
    selectedIds.delete(id);
    if (card) card.classList.remove("selected");
  }
  updateBulkActionToolbar();
}

function toggleSelectAll(checkbox) {
  const checkboxes = document.querySelectorAll("#list-content input[type='checkbox']");
  checkboxes.forEach(box => {
    if (!box.disabled) {
      box.checked = checkbox.checked;
      const card = document.getElementById(`card-${box.value}`);
      if (checkbox.checked) {
        selectedIds.add(box.value);
        if (card) card.classList.add("selected");
      } else {
        selectedIds.delete(box.value);
        if (card) card.classList.remove("selected");
      }
    }
  });
  updateBulkActionToolbar();
}

function updateBulkActionToolbar() {
  const toolbar = document.getElementById("bulk-actions-panel");
  const countSpan = document.getElementById("selected-count");
  const selectAllBox = document.getElementById("select-all-box");
  
  const totalSelectable = document.querySelectorAll("#list-content input[type='checkbox']:not(:disabled)").length;
  
  if (selectedIds.size > 0) {
    countSpan.innerText = selectedIds.size;
    toolbar.classList.remove("hidden");
    
    // Set matching select all checkbox state
    if (selectedIds.size === totalSelectable) {
      selectAllBox.checked = true;
      selectAllBox.indeterminate = false;
    } else {
      selectAllBox.checked = false;
      selectAllBox.indeterminate = true;
    }
  } else {
    toolbar.classList.add("hidden");
    selectAllBox.checked = false;
    selectAllBox.indeterminate = false;
  }
}

// 10. Database Logic: Real-time Approvals & Rejections
async function processApproval(regId, isApproved) {
  const reg = allSubmissions.find(r => r.id === regId);
  if (!reg || reg.status !== "pending") return;
  
  showLoading(true);
  hideGlobalError();
  
  try {
    if (isApproved) {
      // 1. Approving Student
      const studentId = `student_${reg.studentName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      const studentData = {
        name: reg.studentName.trim(),
        dob: '2021-01-01',
        branchId: reg.branch,
        classId: reg.className,
        enrollmentDate: new Date().toISOString().split('T')[0],
        status: 'active',
        parentUids: [],
        feeTotal: 0,
        feePaid: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Clean 10-digit phone
      let cleanPhone = reg.parent1.phone.replace(/\D/g, '');
      if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
        cleanPhone = cleanPhone.substring(2);
      }
      
      const parentUserId = `parent_${cleanPhone}`;
      
      // Create student document
      await db.collection("students").doc(studentId).set(studentData);
      
      // 2. Pre-whitelist Parent details inside `/users`
      const parentUserRef = db.collection("users").doc(parentUserId);
      const parentSnap = await parentUserRef.get();
      
      if (parentSnap.exists()) {
        // Appending sibling logic
        const existingStudentIds = parentSnap.data().linkedStudentIds || [];
        if (!existingStudentIds.includes(studentId)) {
          await parentUserRef.update({
            linkedStudentIds: [...existingStudentIds, studentId],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // Create new whitelisted parent profile
        await parentUserRef.set({
          name: reg.parent1.name.trim(),
          role: 'parent',
          phone: `+91${cleanPhone}`,
          email: reg.parent1.email || '',
          relation: reg.parent1.relation || 'Mother',
          linkedStudentIds: [studentId],
          uid: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // 3. Mark Registration document approved
      await db.collection("registrations").doc(regId).update({
        status: 'approved',
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showToast(`Approved registration for ${reg.studentName}!`, "success");
    } else {
      // Rejecting Registration
      await db.collection("registrations").doc(regId).update({
        status: 'rejected',
        rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showToast(`Rejected registration for ${reg.studentName}`, "danger");
    }
  } catch (err) {
    console.error("Approval state transition error:", err);
    showToast("Transaction failed. Check network permissions.", "danger");
    showGlobalError("Database transaction failed. Try again.");
  }
  
  showLoading(false);
}

// 11. Bulk actions handler
async function handleBulkAction(action) {
  if (selectedIds.size === 0) return;
  
  const count = selectedIds.size;
  const verb = action === "approve" ? "approve" : "reject";
  if (!confirm(`Are you sure you want to ${verb} all ${count} selected registration requests?`)) return;
  
  showLoading(true);
  hideGlobalError();
  
  try {
    const promises = [];
    const isApprove = action === "approve";
    
    for (let id of selectedIds) {
      promises.push(processApproval(id, isApprove));
    }
    
    await Promise.all(promises);
    
    // Clear list selection
    selectedIds.clear();
    updateBulkActionToolbar();
    
    showToast(`Successfully processed bulk ${verb} for ${count} items!`, "success");
  } catch (err) {
    console.error("Bulk processing failed:", err);
    showToast("Bulk transaction failed. Some records might not have updated.", "danger");
  }
  
  showLoading(false);
}

// 12. Helper loaders & Toasts UI
function showLoading(isLoading) {
  const loadingDiv = document.getElementById("list-loading");
  if (isLoading) {
    loadingDiv.classList.remove("hidden");
  } else {
    loadingDiv.classList.add("hidden");
  }
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  
  let icon = "info";
  if (type === "success") icon = "check-circle";
  if (type === "danger") icon = "x-circle";
  
  toast.className = `admin-toast admin-toast-${type}`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-5 h-5"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Slide out after 3 seconds
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function showGlobalError(msg) {
  const banner = document.getElementById("global-admin-error");
  document.getElementById("global-admin-error-text").innerText = msg;
  banner.classList.remove("hidden");
}

function hideGlobalError() {
  document.getElementById("global-admin-error").classList.add("hidden");
}

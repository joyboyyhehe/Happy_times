// ═══════════════════════════════════════════════
//    Happy Times — Standalone Registration App Logic
//    Vanilla JS ES6, Firebase Compat CDN Integration
//    ═══════════════════════════════════════════════

// 1. Firebase Production Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDixFR1hkz9rqEr8rcUen8r7aosAHXXgT0",
  authDomain: "happytimes-preschool-pwa.firebaseapp.com",
  projectId: "happytimes-preschool-pwa",
  storageBucket: "happytimes-preschool-pwa.firebasestorage.app",
  messagingSenderId: "390518602758",
  appId: "1:390518602758:web:bc23ea8bf2ffce9a35d787"
};

// Initialize Firebase SDK
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. Global State Variables
let currentStep = 1;
const totalSteps = 3;

const formData = {
  studentName: '',
  branch: '',
  className: '',
  parent1Name: '',
  parent1Relation: 'Mother',
  parent1Phone: '',
  parent1Email: '',
  parent2Name: '',
  parent2Relation: 'Father',
  parent2Phone: '',
  parent2Email: ''
};

// Verification and OTP Flow States (OTP/reCAPTCHA disabled)
let isPhoneVerified = true;

// Branch Maps for Preview UI
const branchNames = {
  'padmanabhanagar': 'Padmanabhanagar',
  'outer-ring-road': 'Outer Ring Road',
  'chikkalsandra': 'Chikkalsandra',
  'rr-nagar': 'RR Nagar'
};

// Initialize Lucide Icons on start
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  
  // Set up listeners for real-time validation and numeric locks
  setupValidationListeners();
});

// 3. Helper Form Input Toggles
function setRelation(fieldId, value) {
  formData[fieldId] = value;
  
  if (fieldId === 'parent1Relation') {
    document.getElementById('rel-mother').classList.toggle('active', value === 'Mother');
    document.getElementById('rel-father').classList.toggle('active', value === 'Father');
  } else if (fieldId === 'parent2Relation') {
    document.getElementById('rel-father-2').classList.toggle('active', value === 'Father');
    document.getElementById('rel-mother-2').classList.toggle('active', value === 'Mother');
  }
}

// 4. Setup Input Watchers & Errors Reset
function setupValidationListeners() {
  const inputs = ['studentName', 'parent1Name', 'parent1Phone', 'parent2Phone'];
  
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.addEventListener('input', (e) => {
      // Force digit-only constraints on tel inputs & clean country codes on autofill
      if (id === 'parent1Phone' || id === 'parent2Phone') {
        let val = e.target.value.replace(/\D/g, '');
        // If it starts with 91 and is longer than 10 digits, strip the 91 prefix
        if (val.length > 10 && val.startsWith('91')) {
          val = val.substring(2);
        }
        // Truncate to maximum 10 digits to prevent HTML validator lockups
        if (val.length > 10) {
          val = val.substring(0, 10);
        }
        
        // Only update the value if it has actually changed to prevent cursor jumps and virtual keyboard hides on iOS
        if (e.target.value !== val) {
          e.target.value = val;
        }
      }
      
      // Save value
      formData[id] = e.target.value;
      

      
      // Clear specific error highlights
      e.target.classList.remove('error');
      const errBadge = document.getElementById(`err-${id}`);
      if (errBadge) errBadge.classList.add('hidden');
    });
  });

  // Select dropdowns
  ['branch', 'className'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => {
      formData[id] = e.target.value;
      e.target.classList.remove('error');
      document.getElementById(`err-${id}`).classList.add('hidden');
    });
  });
  
  // Non-validated regular inputs
  ['parent1Email', 'parent2Name', 'parent2Email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        formData[id] = e.target.value;
      });
    }
  });
}



// 6. Navigation Control Workflows
function handleBack() {
  if (currentStep > 1) {
    transitionStep(currentStep - 1, 'left');
  }
}

function handleContinue() {
  if (validateStep(currentStep)) {
    if (currentStep === 2) {
      populatePreview();
    }
    transitionStep(currentStep + 1, 'right');
  }
}

function transitionStep(target, direction) {
  // Hide current panel, show target panel
  const currentPanel = document.getElementById(`step-panel-${currentStep}`);
  const targetPanel = document.getElementById(`step-panel-${target}`);
  
  currentPanel.classList.add('hidden');
  currentPanel.classList.remove('active');
  
  targetPanel.classList.remove('hidden');
  targetPanel.classList.add('active');
  
  // Set animations
  targetPanel.classList.remove('animate-slide-left', 'animate-slide-right');
  targetPanel.classList.add(direction === 'right' ? 'animate-slide-right' : 'animate-slide-left');
  
  // Update step indicators
  updateStepIndicators(currentStep, target);
  
  // Set current index
  currentStep = target;
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepIndicators(oldStep, newStep) {
  // Dot states updates
  for (let i = 1; i <= totalSteps; i++) {
    const dot = document.getElementById(`step-dot-${i}`);
    const label = document.getElementById(`step-label-${i}`);
    const line = document.getElementById(`step-line-${i}`);
    
    // Reset active
    dot.classList.remove('active');
    label.classList.remove('active');
    
    if (i === newStep) {
      dot.classList.add('active');
      label.classList.add('active');
    }
    
    // Completed state
    if (i < newStep) {
      dot.classList.add('completed');
      dot.disabled = false;
      label.classList.add('completed');
      if (line) line.classList.add('completed');
    } else {
      dot.classList.remove('completed');
      if (i > newStep) {
        dot.disabled = true;
      }
      label.classList.remove('completed');
      if (line) line.classList.remove('completed');
    }
  }

  // Update Navigation buttons
  const backBtn = document.getElementById('back-btn');
  if (newStep === 1) {
    backBtn.classList.add('hidden');
  } else {
    backBtn.classList.remove('hidden');
    const backText = document.getElementById('back-btn-text');
    backText.innerText = 'Back';
  }
  
  const continueBtn = document.getElementById('continue-btn');
  const submitBtn = document.getElementById('submit-btn');
  
  if (newStep === 3) {
    continueBtn.classList.add('hidden');
    submitBtn.classList.remove('hidden');
  } else {
    continueBtn.classList.remove('hidden');
    submitBtn.classList.add('hidden');
    
    continueBtn.disabled = false;
  }
}

// 7. Form Verification & Validation Rules
function validateStep(stepIndex) {
  const invalidFields = [];
  
  if (stepIndex === 1) {
    if (!formData.studentName.trim()) {
      showError('studentName');
      invalidFields.push('studentName');
    }
    if (!formData.branch) {
      showError('branch');
      invalidFields.push('branch');
    }
    if (!formData.className) {
      showError('className');
      invalidFields.push('className');
    }
  }
  
  if (stepIndex === 2) {
    if (!formData.parent1Name.trim()) {
      showError('parent1Name');
      invalidFields.push('parent1Name');
    }
    
    const phone = formData.parent1Phone.trim();
    if (!phone || phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
      showError('parent1Phone');
      invalidFields.push('parent1Phone');
    }

    const phone2 = formData.parent2Phone.trim();
    if (phone2 && (phone2.length !== 10 || !/^[6-9]\d{9}$/.test(phone2))) {
      showError('parent2Phone');
      invalidFields.push('parent2Phone');
    }
  }
  
  if (invalidFields.length > 0) {
    // Focus and scroll to the first invalid field
    const firstInvalidId = invalidFields[0];
    const firstInvalidEl = document.getElementById(firstInvalidId);
    if (firstInvalidEl) {
      firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Delay focus slightly to allow smooth scroll animation to finish nicely on mobile
      setTimeout(() => {
        firstInvalidEl.focus();
      }, 300);
    }
    return false;
  }
  
  return true;
}

function showError(fieldId, customMsg) {
  const el = document.getElementById(fieldId);
  if (el) el.classList.add('error');
  
  const badge = document.getElementById(`err-${fieldId}`);
  if (badge) {
    if (customMsg) {
      badge.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> ${customMsg}`;
      lucide.createIcons();
    }
    badge.classList.remove('hidden');
  }
}

// 8. Populate Step 3 Preview UI
function populatePreview() {
  document.getElementById('preview-studentName').innerText = formData.studentName;
  document.getElementById('preview-branch').innerText = branchNames[formData.branch] || formData.branch;
  document.getElementById('preview-className').innerText = formData.className;
  
  document.getElementById('preview-parent1Name').innerText = `${formData.parent1Name} (${formData.parent1Relation})`;
  document.getElementById('preview-parent1Phone').innerText = `📞 +91 ${formData.parent1Phone}`;
  
  const p1EmailRow = document.getElementById('preview-row-parent1Email');
  if (formData.parent1Email.trim()) {
    document.getElementById('preview-parent1Email').innerText = formData.parent1Email.trim();
    p1EmailRow.classList.remove('hidden');
  } else {
    p1EmailRow.classList.add('hidden');
  }
  
  const p2Section = document.getElementById('preview-section-parent2');
  if (formData.parent2Name.trim()) {
    document.getElementById('preview-parent2Name').innerText = `${formData.parent2Name} (${formData.parent2Relation})`;
    
    const p2PhoneRow = document.getElementById('preview-row-parent2Phone');
    if (formData.parent2Phone.trim()) {
      document.getElementById('preview-parent2Phone').innerText = `📞 +91 ${formData.parent2Phone.trim()}`;
      p2PhoneRow.classList.remove('hidden');
    } else {
      p2PhoneRow.classList.add('hidden');
    }
    
    const p2EmailRow = document.getElementById('preview-row-parent2Email');
    if (formData.parent2Email.trim()) {
      document.getElementById('preview-parent2Email').innerText = formData.parent2Email.trim();
      p2EmailRow.classList.remove('hidden');
    } else {
      p2EmailRow.classList.add('hidden');
    }
    
    p2Section.classList.remove('hidden');
  } else {
    p2Section.classList.add('hidden');
  }
}

// 9. Submit Completed Document to Firestore
async function handleFinalSubmit() {
  if (!validateStep(1) || !validateStep(2)) {
    transitionStep(2, 'left');
    return;
  }
  

  
  hideGlobalError();
  
  const idleBtn = document.getElementById('submit-btn-idle');
  const loadBtn = document.getElementById('submit-btn-loading');
  const submitBtn = document.getElementById('submit-btn');
  
  submitBtn.disabled = true;
  idleBtn.classList.add('hidden');
  loadBtn.classList.remove('hidden');
  
  try {
    const parent2Data = formData.parent2Name.trim() ? {
      name: formData.parent2Name.trim(),
      relation: formData.parent2Relation,
      phone: formData.parent2Phone.trim(),
      email: formData.parent2Email.trim()
    } : null;

    // Create document in registrations collection
    await db.collection('registrations').add({
      studentName: formData.studentName.trim(),
      branch: formData.branch,
      className: formData.className,
      parent1: {
        name: formData.parent1Name.trim(),
        relation: formData.parent1Relation,
        phone: formData.parent1Phone.trim(),
        email: formData.parent1Email.trim(),
        verifiedUid: null
      },
      parent2: parent2Data,
      status: 'pending',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // On success: show success screen
    document.getElementById('regForm').classList.add('hidden');
    document.getElementById('step-panel-3').classList.add('hidden');
    document.getElementById('back-btn').classList.add('hidden');
    document.getElementById('submit-btn').classList.add('hidden');
    document.getElementById('reg-footer').classList.add('hidden');
    
    document.getElementById('success-student-name').innerText = formData.studentName;
    document.getElementById('success-screen').classList.remove('hidden');
  } catch (err) {
    console.error('Final registration submit error:', err);
    showGlobalError('Database write failed. Please check network/permissions and try again.');
    submitBtn.disabled = false;
    idleBtn.classList.remove('hidden');
    loadBtn.classList.add('hidden');
  }
}

function showGlobalError(msg) {
  const box = document.getElementById('global-submit-error');
  document.getElementById('global-submit-error-text').innerText = msg;
  box.classList.remove('hidden');
}

function hideGlobalError() {
  document.getElementById('global-submit-error').classList.add('hidden');
}

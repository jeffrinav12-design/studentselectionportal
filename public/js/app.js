// Sankara College of Science and Commerce
// Department of Computer Science with Data Analytics
// Application Logic - Project Guide & Elective Selection System (Live Dynamic Prototype)

let currentPortal = 'landing';
let currentStudentMode = 'guide';
let activeStaffTab = 'tab-staff-config';
let adminUnlocked = false;
let guideData = null;
let electiveData = null;
let activeCircularType = 'guide';
let lastAllocatedSubmission = null;

const LOCAL_STORAGE_KEY = 'scsc_portal_data_v2';

// ----------------------------------------------------
// 0. LIVE RESILIENT DYNAMIC ENGINE (LOCAL STORAGE FALLBACK)
// ----------------------------------------------------
function getLocalDB() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('LocalStorage read error:', e);
  }

  const defaultState = {
    system: {
      institutionName: "Sankara College of Science and Commerce",
      department: "Department of Computer Science with Data Analytics",
      batch: "2024-2027",
      semester: "Semester VI",
      staffPassword: "data sorcerers",
      isLive: false
    },
    guidePortal: {
      isLive: false,
      targetStudents: 41,
      slotCount: 8,
      lastSlotGuideMap: {},
      lastAllocatedGuideId: null,
      guides: [
        { id: "g1", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
        { id: "g2", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
        { id: "g3", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
        { id: "g4", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
        { id: "g5", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 }
      ],
      submissions: []
    },
    electivePortal: {
      targetStudents: 43,
      submissions: []
    }
  };
  saveLocalDB(defaultState);
  return defaultState;
}

function saveLocalDB(data) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  loadGuideConfig();
  loadElectiveConfig();
  loadNetworkInfo();
  renderIndividualPhotoSlots();
  renderCircularContent();

  // Initial view is landing page
  showPortal('landing');

  // Polling for updates
  setInterval(() => {
    loadGuideConfig(true);
    loadElectiveConfig(true);
    if (adminUnlocked) {
      loadAdminData();
    }
  }, 8000);
});

// ==========================================
// 1. ROOT VIEW SWITCHER (LANDING / STUDENT / STAFF)
// ==========================================
function showPortal(portalName) {
  currentPortal = portalName;
  
  // Hide all root views
  document.querySelectorAll('.portal-view').forEach(view => {
    view.classList.add('d-none');
    view.classList.remove('active-view');
  });

  if (portalName === 'landing') {
    const landing = document.getElementById('view-landing');
    if (landing) {
      landing.classList.remove('d-none');
      landing.classList.add('active-view');
    }
  } else if (portalName === 'student') {
    const student = document.getElementById('view-student');
    if (student) {
      student.classList.remove('d-none');
      student.classList.add('active-view');
    }
    // Default to guide selection step 1
    switchStudentMode('guide');
    goToGuideStep1();
  } else if (portalName === 'staff') {
    const staff = document.getElementById('view-staff');
    if (staff) {
      staff.classList.remove('d-none');
      staff.classList.add('active-view');
    }

    if (adminUnlocked) {
      document.getElementById('staffLockState')?.classList.add('d-none');
      document.getElementById('staffUnlockedState')?.classList.remove('d-none');
      loadAdminData();
      switchStaffTab(activeStaffTab || 'tab-staff-config');
    } else {
      document.getElementById('staffLockState')?.classList.remove('d-none');
      document.getElementById('staffUnlockedState')?.classList.add('d-none');
      setTimeout(() => {
        document.getElementById('adminPasswordInput')?.focus();
      }, 150);
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Student Mode Switcher (Guide vs Elective)
function switchStudentMode(mode) {
  currentStudentMode = mode;
  const btnGuide = document.getElementById('btnModeGuide');
  const btnElective = document.getElementById('btnModeElective');
  const guideMod = document.getElementById('studentGuideModule');
  const electiveMod = document.getElementById('studentElectiveModule');

  if (mode === 'guide') {
    btnGuide?.classList.add('active');
    btnElective?.classList.remove('active');
    guideMod?.classList.remove('d-none');
    electiveMod?.classList.add('d-none');
  } else {
    btnElective?.classList.add('active');
    btnGuide?.classList.remove('active');
    electiveMod?.classList.remove('d-none');
    guideMod?.classList.add('d-none');
  }
}

// ==========================================
// 2. STEPPED WIZARD TRANSITIONS (STUDENT FLOW)
// ==========================================

// Guide Step Navigation
function goToGuideStep2() {
  const regNoInput = document.getElementById('guideRegNo');
  const nameInput = document.getElementById('guideStudentName');
  const regNo = regNoInput.value.trim().toUpperCase();
  const studentName = nameInput.value.trim();

  if (!regNo) {
    alert('Please enter your Student Register Number.');
    regNoInput.focus();
    return;
  }
  if (!studentName) {
    alert('Please enter your Student Full Name.');
    nameInput.focus();
    return;
  }

  // Update banner in Step 2
  const nameDisplay = document.getElementById('guideActiveNameDisplay');
  const regDisplay = document.getElementById('guideActiveRegDisplay');
  if (nameDisplay) nameDisplay.textContent = studentName;
  if (regDisplay) regDisplay.textContent = regNo;

  // Animate transition
  const step1 = document.getElementById('guideStep1');
  const step2 = document.getElementById('guideStep2');
  if (step1 && step2) {
    step1.classList.add('d-none');
    step2.classList.remove('d-none');
    step2.classList.add('fade-in-up');
  }

  const statusMsg = document.getElementById('slotStatusMessage');
  if (statusMsg) {
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-question"></i> Click any mystery slot above to record your selection.`;
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function goToGuideStep1() {
  const step1 = document.getElementById('guideStep1');
  const step2 = document.getElementById('guideStep2');
  if (step1 && step2) {
    step2.classList.add('d-none');
    step1.classList.remove('d-none');
    step1.classList.add('fade-in-up');
  }
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Elective Step Navigation
function goToElectiveStep2() {
  const regNoInput = document.getElementById('electiveRegNo');
  const nameInput = document.getElementById('electiveStudentName');
  const regNo = regNoInput.value.trim().toUpperCase();
  const studentName = nameInput.value.trim();

  if (!regNo) {
    alert('Please enter your Student Register Number.');
    regNoInput.focus();
    return;
  }
  if (!studentName) {
    alert('Please enter your Student Full Name.');
    nameInput.focus();
    return;
  }

  // Update banner in Step 2
  const nameDisplay = document.getElementById('electiveActiveNameDisplay');
  const regDisplay = document.getElementById('electiveActiveRegDisplay');
  if (nameDisplay) nameDisplay.textContent = studentName;
  if (regDisplay) regDisplay.textContent = regNo;

  // Animate transition
  const step1 = document.getElementById('electiveStep1');
  const step2 = document.getElementById('electiveStep2');
  if (step1 && step2) {
    step1.classList.add('d-none');
    step2.classList.remove('d-none');
    step2.classList.add('fade-in-up');
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function goToElectiveStep1() {
  const step1 = document.getElementById('electiveStep1');
  const step2 = document.getElementById('electiveStep2');
  if (step1 && step2) {
    step2.classList.add('d-none');
    step1.classList.remove('d-none');
    step1.classList.add('fade-in-up');
  }
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// ==========================================
// 3. GUIDE SELECTION LOGIC (MYSTERY SLOTS)
// ==========================================

async function loadGuideConfig(silent = false) {
  try {
    const res = await fetch('/api/guide/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        guideData = data;
        return;
      }
    }
  } catch (err) {}

  // Local fallback engine
  const db = getLocalDB();
  const gp = db.guidePortal;
  const hasNames = gp.guides.length >= 5 && gp.guides.every(g => g.name && g.name.trim().length > 0);
  
  gp.guides.forEach(g => {
    g.assignedCount = gp.submissions.filter(s => s.guideId === g.id).length;
  });

  guideData = {
    success: true,
    isLive: !!gp.isLive,
    hasConfiguredNames: hasNames,
    targetStudents: gp.targetStudents || 41,
    totalRegistered: gp.submissions.length,
    slotCount: gp.slotCount || 8,
    guides: gp.guides
  };
}

// Handle Student Clicking Slot (Strict 8-count Quota, Dynamic Rotation & Confidential Ballot)
async function handleSlotClick(slotNum) {
  if (!guideData || !guideData.isLive) {
    alert('Project Guide selection slots are currently locked.\n\nSlots will become live once Faculty Guide names are officially configured by Staff.');
    return;
  }

  const regNoInput = document.getElementById('guideRegNo');
  const nameInput = document.getElementById('guideStudentName');
  const regNo = regNoInput.value.trim().toUpperCase();
  const studentName = nameInput.value.trim();
  const statusMsg = document.getElementById('slotStatusMessage');

  if (!regNo || !studentName) {
    alert('Student credentials missing. Returning to Step 1.');
    goToGuideStep1();
    return;
  }

  // Visual card animation
  const slotCard = document.querySelector(`.slot-card[data-slot="${slotNum}"]`);
  if (slotCard) {
    slotCard.style.transform = 'scale(0.92)';
    setTimeout(() => { slotCard.style.transform = ''; }, 220);
  }

  if (statusMsg) {
    statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Recording your slot selection confidentially...`;
  }

  // 1. Try Server API
  try {
    const res = await fetch('/api/guide/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo, studentName, slot: slotNum })
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        if (typeof confetti === 'function') {
          confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
        }
        showGuideRevealModal(result.submission);
        if (statusMsg) {
          statusMsg.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> Slot #${slotNum} choice cast successfully! Choice recorded securely in vault.`;
        }
        loadGuideConfig();
        return;
      } else if (result.isExisting) {
        showGuideRevealModal(result.submission, true);
        if (statusMsg) {
          statusMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i> ${escapeHTML(result.error)}`;
        }
        return;
      }
    }
  } catch (err) {}

  // 2. LIVE DYNAMIC ENGINE (Resilient In-Browser Execution)
  const db = getLocalDB();
  const gp = db.guidePortal;

  // Duplicate check
  const existing = gp.submissions.find(s => s.regNo.toUpperCase() === regNo);
  if (existing) {
    showGuideRevealModal(existing, true);
    if (statusMsg) {
      statusMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i> Register Number ${regNo} has already cast their vote via Slot #${existing.slotChosen}!`;
    }
    return;
  }

  const totalRegistered = gp.submissions.length;
  const targetStudents = gp.targetStudents || 41;
  if (totalRegistered >= targetStudents) {
    alert('All 41 student slots for the batch are fully allocated!');
    return;
  }

  // Strict 8-student quota rule:
  // - 5 Guide Faculty in total.
  // - 4 guides have a strict cap of 8 students.
  // - Exactly 1 guide is designated for 9 allocations (8 * 4 + 9 = 41).
  // - Once a guide reaches 8 allocations, she is terminated automatically from receiving further students.
  // - When totalRegistered reaches 40 (the 41st student), only the designated guide receives the 9th student.
  const ninthGuideId = gp.ninthGuideId || (gp.guides[0] ? gp.guides[0].id : 'g1');

  let eligibleGuides;
  if (totalRegistered < 40) {
    eligibleGuides = gp.guides.filter(g => (g.assignedCount || 0) < 8);
  } else {
    eligibleGuides = gp.guides.filter(g => g.id === ninthGuideId && (g.assignedCount || 0) < 9);
    if (eligibleGuides.length === 0) {
      eligibleGuides = gp.guides.filter(g => (g.assignedCount || 0) < 9);
    }
  }

  if (eligibleGuides.length === 0) {
    alert('No guide capacity remaining.');
    return;
  }

  // DYNAMIC ROTATION & ANTI-COLLISION LOGIC:
  // If slot 1 is clicked by 3 students, all 3 MUST receive different guide allocations!
  gp.slotHistory = gp.slotHistory || {};
  const recentGuidesForSlot = gp.slotHistory[slotNum] || [];
  const lastOverallGuideId = gp.lastAllocatedGuideId || null;

  let candidates = eligibleGuides;

  // Filter out recent guides for this slot so repeated clicks rotate through distinct guides
  if (recentGuidesForSlot.length > 0 && candidates.length > 1) {
    const nonRecent = candidates.filter(g => !recentGuidesForSlot.includes(g.id));
    if (nonRecent.length > 0) {
      candidates = nonRecent;
    } else {
      const mostRecentId = recentGuidesForSlot[recentGuidesForSlot.length - 1];
      const withoutMostRecent = candidates.filter(g => g.id !== mostRecentId);
      if (withoutMostRecent.length > 0) candidates = withoutMostRecent;
    }
  }

  // Also prevent consecutive identical guide allocation across any two back-to-back student picks
  if (lastOverallGuideId && candidates.length > 1) {
    const alternativeCandidates = candidates.filter(g => g.id !== lastOverallGuideId);
    if (alternativeCandidates.length > 0) candidates = alternativeCandidates;
  }

  const selectedGuide = candidates[Math.floor(Math.random() * candidates.length)];
  selectedGuide.assignedCount = (selectedGuide.assignedCount || 0) + 1;

  if (!gp.lastSlotGuideMap) gp.lastSlotGuideMap = {};
  gp.lastSlotGuideMap[slotNum] = selectedGuide.id;
  gp.lastAllocatedGuideId = selectedGuide.id;

  if (!gp.slotHistory[slotNum]) gp.slotHistory[slotNum] = [];
  gp.slotHistory[slotNum].push(selectedGuide.id);
  if (gp.slotHistory[slotNum].length > 4) {
    gp.slotHistory[slotNum].shift();
  }

  const subRecord = {
    id: 'GS-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    regNo,
    studentName,
    slotChosen: slotNum,
    guideId: selectedGuide.id,
    guideName: selectedGuide.name || `Faculty Guide #${selectedGuide.id.replace('g', '')}`,
    timestamp: new Date().toISOString()
  };

  gp.submissions.push(subRecord);
  saveLocalDB(db);

  if (typeof confetti === 'function') {
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
  }

  showGuideRevealModal(subRecord);
  if (statusMsg) {
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> Slot #${slotNum} choice cast successfully! Choice recorded securely in vault.`;
  }
  loadGuideConfig();
}

function showGuideRevealModal(sub, isRepeat = false) {
  lastAllocatedSubmission = sub;
  const regNoEl = document.getElementById('modalRegNo');
  const nameEl = document.getElementById('modalStudentName');
  const receiptReg = document.getElementById('receiptRegNo');
  const receiptName = document.getElementById('receiptStudentName');
  const slotChosen = document.getElementById('modalSlotChosen');

  if (regNoEl) regNoEl.textContent = sub.regNo;
  if (nameEl) nameEl.textContent = sub.studentName;
  if (receiptReg) receiptReg.textContent = sub.regNo;
  if (receiptName) receiptName.textContent = sub.studentName;
  if (slotChosen) slotChosen.textContent = `Slot #${sub.slotChosen} Selected`;

  const modal = document.getElementById('guideRevealModal');
  if (modal) modal.classList.remove('d-none');
}

function closeGuideModal() {
  const modal = document.getElementById('guideRevealModal');
  if (modal) modal.classList.add('d-none');
  
  // Clear inputs and cleanly reset to Step 1 for the next student
  const regNoInput = document.getElementById('guideRegNo');
  const nameInput = document.getElementById('guideStudentName');
  if (regNoInput) regNoInput.value = '';
  if (nameInput) nameInput.value = '';

  goToGuideStep1();
}

// ==========================================
// 4. ELECTIVE COURSE SELECTION LOGIC
// ==========================================

async function loadElectiveConfig(silent = false) {
  try {
    const res = await fetch('/api/elective/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        electiveData = data;
        return;
      }
    }
  } catch (err) {}

  const db = getLocalDB();
  const ep = db.electivePortal;
  electiveData = {
    success: true,
    targetStudents: ep.targetStudents || 43,
    totalSubmitted: ep.submissions.length
  };
}

async function handleElectiveSubmit(e) {
  e.preventDefault();
  const regNoInput = document.getElementById('electiveRegNo');
  const nameInput = document.getElementById('electiveStudentName');
  const regNo = regNoInput.value.trim().toUpperCase();
  const studentName = nameInput.value.trim();

  const e2Radio = document.querySelector('input[name="elective2"]:checked');
  const e3Radio = document.querySelector('input[name="elective3"]:checked');

  if (!e2Radio || !e3Radio) {
    alert('Please choose one course for Elective II and one for Elective III.');
    return;
  }

  const elective2Code = e2Radio.value;
  const elective3Code = e3Radio.value;

  const e2Map = {
    '24BSD63E05': '5G & Future Network Technologies',
    '24BSD63E06': 'Predictive Analytics',
    '24BSD63E07': 'Software Engineering',
    '24BSD63E08': 'Market Analysis and Decision Making'
  };
  const e3Map = {
    '24BSD63E09': 'Internet of Things (IoT)',
    '24BSD63E10': 'Natural Language Processing (NLP)',
    '24BSD63E11': 'Mobile Application Development',
    '24BSD63E12': 'Block Chain Technology'
  };

  const elective2Title = e2Map[elective2Code] || elective2Code;
  const elective3Title = e3Map[elective3Code] || elective3Code;

  // 1. Try Server API
  try {
    const res = await fetch('/api/elective/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo, studentName, elective2Code, elective3Code })
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        showElectiveRevealModal({ regNo, studentName, elective2Title, elective3Title });
        loadElectiveConfig();
        return;
      } else {
        alert(result.error || 'Submission failed.');
        return;
      }
    }
  } catch (err) {}

  // 2. Local Fallback Engine
  const db = getLocalDB();
  const ep = db.electivePortal;

  const existing = ep.submissions.find(s => s.regNo.toUpperCase() === regNo);
  if (existing) {
    alert(`Register Number ${regNo} has already submitted elective choices.`);
    return;
  }

  const record = {
    id: 'ES-' + Date.now(),
    regNo,
    studentName,
    elective2Code,
    elective2Title,
    elective3Code,
    elective3Title,
    timestamp: new Date().toISOString()
  };

  ep.submissions.push(record);
  saveLocalDB(db);

  showElectiveRevealModal({ regNo, studentName, elective2Title, elective3Title });
  loadElectiveConfig();
}

function showElectiveRevealModal(sub) {
  const regEl = document.getElementById('modalElectiveRegNo');
  const nameEl = document.getElementById('modalElectiveStudentName');
  const receiptReg = document.getElementById('receiptElectiveRegNo');
  const e2El = document.getElementById('modalElective2Choice');
  const e3El = document.getElementById('modalElective3Choice');
  const timeEl = document.getElementById('modalElectiveTime');

  if (regEl) regEl.textContent = sub.regNo;
  if (nameEl) nameEl.textContent = sub.studentName;
  if (receiptReg) receiptReg.textContent = sub.regNo;
  if (e2El) e2El.textContent = sub.elective2Title;
  if (e3El) e3El.textContent = sub.elective3Title;
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();

  if (typeof confetti === 'function') {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }

  const modal = document.getElementById('electiveRevealModal');
  if (modal) modal.classList.remove('d-none');
}

function closeElectiveModal() {
  const modal = document.getElementById('electiveRevealModal');
  if (modal) modal.classList.add('d-none');

  // Reset forms and return to Step 1
  document.getElementById('electiveCredentialsForm')?.reset();
  document.getElementById('electiveSelectionForm')?.reset();
  goToElectiveStep1();
}

// ==========================================
// 5. STAFF ADMIN CONSOLE (FACULTY AUTHORITIES)
// ==========================================

function switchStaffTab(tabId) {
  activeStaffTab = tabId;
  document.querySelectorAll('.staff-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-staff-tab') === tabId);
  });

  document.querySelectorAll('.staff-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
    pane.classList.toggle('d-none', pane.id !== tabId);
  });

  if (tabId === 'tab-staff-report') {
    populateReportTables();
  }
}

function handleAdminLogin(e) {
  e.preventDefault();
  const pwdInput = document.getElementById('adminPasswordInput');
  const pwd = pwdInput.value.trim().toLowerCase();
  const feedback = document.getElementById('adminLoginFeedback');

  if (pwd === 'data sorcerers') {
    adminUnlocked = true;
    feedback.textContent = '';
    
    document.getElementById('staffLockState')?.classList.add('d-none');
    document.getElementById('staffUnlockedState')?.classList.remove('d-none');
    
    loadAdminData();
    switchStaffTab('tab-staff-config');
  } else {
    feedback.textContent = 'Incorrect security PIN / passkey. Please enter "data sorcerers".';
    pwdInput.focus();
  }
}

function handleAdminLogout() {
  adminUnlocked = false;
  document.getElementById('staffUnlockedState')?.classList.add('d-none');
  document.getElementById('staffLockState')?.classList.remove('d-none');
  const pwdInput = document.getElementById('adminPasswordInput');
  if (pwdInput) pwdInput.value = '';
  showPortal('landing');
}

async function loadAdminData() {
  if (!adminUnlocked) return;

  let gData = null;
  let eData = null;

  try {
    const [resGuide, resElective] = await Promise.all([
      fetch('/api/guide/submissions'),
      fetch('/api/elective/submissions')
    ]);
    if (resGuide.ok) gData = await resGuide.json();
    if (resElective.ok) eData = await resElective.json();
  } catch (err) {}

  // Fallback to local DB if serverless/static
  if (!gData || !gData.guideGroups) {
    const db = getLocalDB();
    const gp = db.guidePortal;
    const ep = db.electivePortal;

    const guideGroups = gp.guides.map(g => {
      const students = gp.submissions.filter(s => s.guideId === g.id);
      return {
        guideId: g.id,
        guideName: g.name,
        designation: g.designation,
        maxStudents: g.maxStudents || 8,
        assignedCount: students.length,
        students
      };
    });

    gData = {
      success: true,
      submissions: gp.submissions,
      guideGroups
    };
    eData = {
      success: true,
      submissions: ep.submissions
    };
  }

  // Render 5 Faculty Config Cards
  const adminGuides = (gData && gData.guideGroups && gData.guideGroups.length > 0)
    ? gData.guideGroups
    : [
        { guideId: 'g1', guideName: '', designation: 'Assistant Professor, CS & DA', maxStudents: 8, assignedCount: 0 },
        { guideId: 'g2', guideName: '', designation: 'Assistant Professor, CS & DA', maxStudents: 8, assignedCount: 0 },
        { guideId: 'g3', guideName: '', designation: 'Assistant Professor, CS & DA', maxStudents: 8, assignedCount: 0 },
        { guideId: 'g4', guideName: '', designation: 'Assistant Professor, CS & DA', maxStudents: 8, assignedCount: 0 },
        { guideId: 'g5', guideName: '', designation: 'Assistant Professor, CS & DA', maxStudents: 8, assignedCount: 0 }
      ];
  window.currentAdminGuides = adminGuides;

  const configGrid = document.getElementById('facultyConfigList');
  if (configGrid) {
    configGrid.innerHTML = adminGuides.map((g, idx) => `
      <div class="faculty-card">
        <div class="faculty-card-header">
          <span class="faculty-tag"><i class="fa-solid fa-chalkboard-user"></i> Guide Faculty #${idx + 1}</span>
          <small class="text-muted"><strong>${g.assignedCount || 0}</strong> / ${g.maxStudents || 8} Allocated</small>
        </div>
        <div class="form-group">
          <label>Faculty Name (Ma'am)</label>
          <input type="text" id="facultyName_${idx}" value="${escapeHTML(g.guideName || g.name || '')}" placeholder="e.g. Dr. / Prof. ...">
        </div>
        <div class="form-group">
          <label>Designation</label>
          <input type="text" id="facultyDesig_${idx}" value="${escapeHTML(g.designation || 'Assistant Professor, CS & DA')}" placeholder="Designation">
        </div>
        <div class="form-group">
          <label>Base Quota Limit (Students)</label>
          <input type="number" id="facultyQuota_${idx}" value="${g.maxStudents || 8}" min="1" max="41">
        </div>
      </div>
    `).join('');
  }

  // Render Guide Submissions Table
  const gTable = document.getElementById('adminGuideSubmissionsTable');
  const gCountEl = document.getElementById('adminGuideCount');
  if (gCountEl) gCountEl.textContent = gData.submissions.length;

  if (gTable) {
    if (gData.submissions.length > 0) {
      gTable.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Reg. No</th>
              <th>Student Name</th>
              <th>Slot</th>
              <th>Allocated Guide (Confidential)</th>
            </tr>
          </thead>
          <tbody>
            ${gData.submissions.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHTML(s.regNo)}</strong></td>
                <td>${escapeHTML(s.studentName)}</td>
                <td>Slot #${s.slotChosen}</td>
                <td><span class="badge-tag-guide">${escapeHTML(s.guideName || 'Allocated')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      gTable.innerHTML = `<p class="p-3 text-muted">No guide submissions yet. All records are reset clean for tomorrow.</p>`;
    }
  }

  // Render Elective Submissions Table
  const eTable = document.getElementById('adminElectiveSubmissionsTable');
  const eCountEl = document.getElementById('adminElectiveCount');
  if (eCountEl) eCountEl.textContent = eData.submissions.length;

  if (eTable) {
    if (eData.submissions.length > 0) {
      eTable.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Reg. No</th>
              <th>Student Name</th>
              <th>Elective II</th>
              <th>Elective III</th>
            </tr>
          </thead>
          <tbody>
            ${eData.submissions.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHTML(s.regNo)}</strong></td>
                <td>${escapeHTML(s.studentName)}</td>
                <td>${escapeHTML(s.elective2Title)}</td>
                <td>${escapeHTML(s.elective3Title)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      eTable.innerHTML = `<p class="p-3 text-muted">No elective submissions yet.</p>`;
    }
  }

  // Calculate and Render Elective Tally & Winners
  renderElectiveAnalytics(eData.submissions);

  // Update Admin Live Status Banner
  const pill = document.getElementById('adminLivePill');
  const text = document.getElementById('adminLiveText');
  const isLive = guideData && guideData.isLive;
  if (isLive) {
    if (pill) {
      pill.style.background = '#D1FAE5';
      pill.style.color = '#065F46';
      pill.innerHTML = '<i class="fa-solid fa-bolt"></i> SLOTS STATUS: LIVE';
    }
    if (text) {
      text.className = 'text-success';
      text.textContent = 'LIVE (Students Can Select Slots)';
    }
  } else {
    if (pill) {
      pill.style.background = '#FEE2E2';
      pill.style.color = '#B91C1C';
      pill.innerHTML = '<i class="fa-solid fa-lock"></i> SLOTS STATUS: LOCKED';
    }
    if (text) {
      text.className = 'text-danger';
      text.textContent = 'LOCKED (Awaiting Guide Names)';
    }
  }
}

function renderElectiveAnalytics(submissions) {
  const e2Counts = {};
  const e3Counts = {};

  submissions.forEach(s => {
    e2Counts[s.elective2Title] = (e2Counts[s.elective2Title] || 0) + 1;
    e3Counts[s.elective3Title] = (e3Counts[s.elective3Title] || 0) + 1;
  });

  // Top winner for E2
  let topE2 = null;
  let maxE2 = -1;
  for (const [title, count] of Object.entries(e2Counts)) {
    if (count > maxE2) {
      maxE2 = count;
      topE2 = title;
    }
  }

  // Top winner for E3
  let topE3 = null;
  let maxE3 = -1;
  for (const [title, count] of Object.entries(e3Counts)) {
    if (count > maxE3) {
      maxE3 = count;
      topE3 = title;
    }
  }

  const e2WinnerTitle = document.getElementById('e2WinnerTitle');
  const e2WinnerVotes = document.getElementById('e2WinnerVotes');
  const e3WinnerTitle = document.getElementById('e3WinnerTitle');
  const e3WinnerVotes = document.getElementById('e3WinnerVotes');

  if (topE2 && maxE2 > 0) {
    if (e2WinnerTitle) e2WinnerTitle.textContent = topE2;
    if (e2WinnerVotes) e2WinnerVotes.textContent = `${maxE2} votes leading`;
  } else {
    if (e2WinnerTitle) e2WinnerTitle.textContent = 'Awaiting votes...';
    if (e2WinnerVotes) e2WinnerVotes.textContent = '0 votes';
  }

  if (topE3 && maxE3 > 0) {
    if (e3WinnerTitle) e3WinnerTitle.textContent = topE3;
    if (e3WinnerVotes) e3WinnerVotes.textContent = `${maxE3} votes leading`;
  } else {
    if (e3WinnerTitle) e3WinnerTitle.textContent = 'Awaiting votes...';
    if (e3WinnerVotes) e3WinnerVotes.textContent = '0 votes';
  }

  // Tally list
  const tallyList = document.getElementById('electiveTallyList');
  if (tallyList) {
    const allCourses = [
      ...Object.entries(e2Counts).map(([title, count]) => ({ title, count, group: 'Elective II' })),
      ...Object.entries(e3Counts).map(([title, count]) => ({ title, count, group: 'Elective III' }))
    ];

    if (allCourses.length > 0) {
      tallyList.innerHTML = allCourses.map(c => `
        <div class="tally-item">
          <div>
            <strong>${escapeHTML(c.title)}</strong>
            <small class="text-muted d-block">${c.group}</small>
          </div>
          <span class="badge-tag">${c.count} votes</span>
        </div>
      `).join('');
    } else {
      tallyList.innerHTML = '<p class="text-muted p-2">No votes cast yet.</p>';
    }
  }
}

// Staff Save Guide Configuration (Supports 5 Guides)
async function saveGuideConfiguration(makeLive = false) {
  const pwd = document.getElementById('adminPasswordInput')?.value || 'data sorcerers';
  const updatedGuides = [];
  const guideCount = (window.currentAdminGuides && window.currentAdminGuides.length) || 5;

  for (let i = 0; i < guideCount; i++) {
    const nameEl = document.getElementById(`facultyName_${i}`);
    const desigEl = document.getElementById(`facultyDesig_${i}`);
    const quotaEl = document.getElementById(`facultyQuota_${i}`);

    if (nameEl && desigEl && quotaEl) {
      updatedGuides.push({
        id: `g${i + 1}`,
        name: nameEl.value.trim(),
        designation: desigEl.value.trim(),
        maxStudents: parseInt(quotaEl.value, 10) || 8
      });
    }
  }

  if (makeLive) {
    const hasBlank = updatedGuides.some(g => !g.name || g.name.trim().length === 0);
    if (hasBlank) {
      alert(`Please fill out all ${updatedGuides.length} Faculty Guide (Ma'am) names before activating Live Slots for students!`);
      return;
    }
  }

  // 1. Try server
  try {
    await fetch('/api/guide/admin/update-guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, guides: updatedGuides, isLive: makeLive ? true : undefined })
    });
  } catch (e) {}

  // 2. Always persist locally for instant reactivity
  const db = getLocalDB();
  db.guidePortal.guides = updatedGuides.map((g, idx) => ({
    ...g,
    assignedCount: (db.guidePortal.guides[idx] && db.guidePortal.guides[idx].assignedCount) || 0
  }));
  if (makeLive) {
    db.guidePortal.isLive = true;
  }
  saveLocalDB(db);

  alert(makeLive ? 'Faculty Guide details saved and slots are now LIVE for students!' : 'Faculty Guide details saved successfully!');
  loadGuideConfig();
  loadAdminData();
}

async function activateGuideSlotsLive() {
  const guideCount = (window.currentAdminGuides && window.currentAdminGuides.length) || 5;
  for (let i = 0; i < guideCount; i++) {
    const nameEl = document.getElementById(`facultyName_${i}`);
    if (!nameEl || !nameEl.value.trim()) {
      alert(`Cannot activate slots: Please enter Guide Faculty #${i + 1} (Ma'am) name first!`);
      if (nameEl) nameEl.focus();
      return;
    }
  }
  saveGuideConfiguration(true);
}

async function deactivateGuideSlotsLive() {
  const pwd = document.getElementById('adminPasswordInput')?.value || 'data sorcerers';
  try {
    await fetch('/api/guide/admin/toggle-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, isLive: false })
    });
  } catch (e) {}

  const db = getLocalDB();
  db.guidePortal.isLive = false;
  saveLocalDB(db);

  alert('Guide selection slots are now LOCKED.');
  loadGuideConfig();
  loadAdminData();
}

// 1. Master Student Allocation Excel (.xlsx)
function downloadMasterExcel() {
  const db = getLocalDB();
  const gp = db.guidePortal;

  if (typeof XLSX === 'undefined') {
    window.location.href = '/api/guide/export/excel';
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Master Allotment List
  const masterData = gp.submissions.map((s, idx) => ({
    "S.No": idx + 1,
    "Student Register Number": s.regNo,
    "Student Full Name": s.studentName,
    "Mystery Slot Chosen": `Slot #${s.slotChosen}`,
    "Allocated Project Guide": s.guideName,
    "Selection Date & Time": s.timestamp ? new Date(s.timestamp).toLocaleString() : new Date().toLocaleString()
  }));

  const wsMaster = XLSX.utils.json_to_sheet(masterData.length > 0 ? masterData : [{ "Notice": "No student guide submissions recorded yet." }]);
  wsMaster['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 30 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsMaster, "Master Allocations");

  XLSX.writeFile(wb, "Student_Guide_Allocations_2024_2027.xlsx");
}

// 2. Guide-Wise Grouped Allocation Excel (.xlsx)
// Formats students grouped under each Faculty Guide's name with Reg. No and Name
function downloadGuideWiseExcel() {
  const db = getLocalDB();
  const gp = db.guidePortal;

  if (typeof XLSX === 'undefined') {
    window.location.href = '/api/guide/export/excel';
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Consolidated Grouped Summary
  const groupedData = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
    ["Department of Computer Science with Data Analytics"],
    ["Semester VI Project Guide Allocation - Guide-Wise Grouped Student List"],
    ["Generated on: " + new Date().toLocaleString()],
    []
  ];

  gp.guides.forEach((g, idx) => {
    const students = gp.submissions.filter(s => s.guideId === g.id);
    const guideTitle = `FACULTY GUIDE #${idx + 1}: ${(g.name || 'Faculty Guide').toUpperCase()} (${g.designation || 'Assistant Professor'})`;
    groupedData.push([guideTitle, `Total Allocated: ${students.length} / ${g.maxStudents || 8} Students`]);
    groupedData.push(["S.No", "Register Number", "Student Full Name", "Slot Chosen", "Allocated Guide"]);

    if (students.length === 0) {
      groupedData.push(["-", "No students allocated yet", "-", "-", "-"]);
    } else {
      students.forEach((st, sidx) => {
        groupedData.push([sidx + 1, st.regNo, st.studentName, `Slot #${st.slotChosen}`, g.name || `Guide #${idx + 1}`]);
      });
    }
    groupedData.push([]); // blank spacing row
  });

  const wsGrouped = XLSX.utils.aoa_to_sheet(groupedData);
  wsGrouped['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsGrouped, "Guide-Wise Roster");

  // Additional Tabs: Individual sheet for each Faculty Guide
  gp.guides.forEach((g, idx) => {
    const students = gp.submissions.filter(s => s.guideId === g.id);
    const guideSheetData = [
      [`GUIDE ALLOCATION: ${g.name || `Faculty Guide #${idx + 1}`}`],
      [`Designation: ${g.designation || 'Assistant Professor, CS & DA'}`],
      [`Allocated Students: ${students.length} / ${g.maxStudents || 8}`],
      [],
      ["S.No", "Register Number", "Student Name", "Slot Chosen", "Selection Timestamp"]
    ];

    if (students.length === 0) {
      guideSheetData.push(["-", "No students allocated yet", "-", "-", "-"]);
    } else {
      students.forEach((st, sidx) => {
        guideSheetData.push([sidx + 1, st.regNo, st.studentName, `Slot #${st.slotChosen}`, st.timestamp || new Date().toISOString()]);
      });
    }

    const wsIndividual = XLSX.utils.aoa_to_sheet(guideSheetData);
    wsIndividual['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 24 }];
    const cleanSheetName = (g.name ? g.name.replace(/[\\/*?[\]]/g, '').slice(0, 25) : `Guide ${idx + 1}`);
    XLSX.utils.book_append_sheet(wb, wsIndividual, cleanSheetName);
  });

  XLSX.writeFile(wb, "Guide_Wise_Student_Allocations_2024_2027.xlsx");
}

// 3. Elective Course Selection Excel (.xlsx)
function downloadElectiveExcel() {
  const db = getLocalDB();
  const ep = db.electivePortal;

  if (typeof XLSX === 'undefined') {
    window.location.href = '/api/elective/export/excel';
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Student choices
  const electiveDataRows = ep.submissions.map((s, idx) => ({
    "S.No": idx + 1,
    "Student Register Number": s.regNo,
    "Student Full Name": s.studentName,
    "Elective II Code": s.elective2Code,
    "Elective II Course Title": s.elective2Title,
    "Elective III Code": s.elective3Code,
    "Elective III Course Title": s.elective3Title,
    "Timestamp": s.timestamp ? new Date(s.timestamp).toLocaleString() : new Date().toLocaleString()
  }));

  const wsElective = XLSX.utils.json_to_sheet(electiveDataRows.length > 0 ? electiveDataRows : [{ "Notice": "No elective selections recorded yet." }]);
  wsElective['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 32 }, { wch: 16 }, { wch: 32 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsElective, "Elective Selections");

  XLSX.writeFile(wb, "Elective_Course_Selections_2024_2027.xlsx");
}

function downloadElectiveWord() {
  window.location.href = '/api/elective/export/word';
}

function downloadBackupJSON() {
  const db = getLocalDB();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `Sankara_Selection_Portal_Backup_${new Date().toISOString().slice(0,10)}.json`);
  dlAnchor.click();
}

async function promptResetGuide() {
  if (!confirm('Are you sure you want to reset all Guide Submissions? This action cannot be undone.')) return;
  const pwd = document.getElementById('adminPasswordInput')?.value || 'data sorcerers';
  try {
    await fetch('/api/guide/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
  } catch (e) {}

  const db = getLocalDB();
  db.guidePortal.submissions = [];
  db.guidePortal.lastSlotGuideMap = {};
  db.guidePortal.lastAllocatedGuideId = null;
  db.guidePortal.guides.forEach(g => g.assignedCount = 0);
  saveLocalDB(db);

  alert('Guide submissions have been reset to 0.');
  loadGuideConfig();
  loadAdminData();
}

async function promptResetElective() {
  if (!confirm('Are you sure you want to reset all Elective Submissions? This action cannot be undone.')) return;
  const pwd = document.getElementById('adminPasswordInput')?.value || 'data sorcerers';
  try {
    await fetch('/api/elective/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
  } catch (e) {}

  const db = getLocalDB();
  db.electivePortal.submissions = [];
  saveLocalDB(db);

  alert('Elective submissions have been reset to 0.');
  loadElectiveConfig();
  loadAdminData();
}

// ==========================================
// 6. OFFICIAL CIRCULARS (ADMIN VIEW)
// ==========================================

function toggleCircular(type) {
  activeCircularType = type;
  const btnGuide = document.getElementById('btnCircGuide');
  const btnElective = document.getElementById('btnCircElective');
  if (btnGuide && btnElective) {
    btnGuide.classList.toggle('active', type === 'guide');
    btnElective.classList.toggle('active', type === 'elective');
  }
  renderCircularContent();
}

const switchCircularType = toggleCircular;

function renderCircularContent() {
  const body = document.getElementById('circularBodyContent');
  const refEl = document.getElementById('circRefNo');
  if (!body) return;

  if (activeCircularType === 'guide') {
    if (refEl) refEl.textContent = 'Ref: SCSC/CSDA/2026-27/SEM6/CIR-01';
    body.innerHTML = `
      <p style="margin-bottom: 16px; text-indent: 40px; text-align: justify;">
        This is to officially inform all students of the <strong>III B.Sc. Computer Science with Data Analytics (Academic Batch 2024–2027)</strong> that the selection and allotment of Faculty Project Guides for the <strong>Semester VI Capstone Project (Course Code: 24BSD63V01)</strong> is scheduled to commence as per departmental autonomy regulations.
      </p>
      <p style="margin-bottom: 16px; text-align: justify;">
        To ensure absolute merit, transparency, and complete fairness, the allotment process is conducted via the <strong>Data Sorcerers Dynamic Selection Suite</strong>. Each of the 5 Faculty Guide members (Ma'ams) is assigned an equal base student quota of strictly <strong>8 students</strong> (with exactly one faculty receiving the 41st student).
      </p>
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; padding: 18px; border-radius: 6px; margin: 20px 0;">
        <strong style="color: #002B49; display: block; margin-bottom: 8px; font-size: 1.05rem;">
          <i class="fa-solid fa-list-check"></i> Procedural Guidelines for Students:
        </strong>
        <ol style="margin-left: 24px; font-size: 0.95rem; line-height: 1.7;">
          <li>Students must enter their official College Register Number and registered Full Name on the selection terminal.</li>
          <li>Choose any mystery slot number from <strong>1 to 8</strong> on the interactive selection terminal.</li>
          <li>Faculty mappings behind slots are dynamically rotated and shuffled for every student to eliminate collusion or pre-arranged slot trading.</li>
          <li>All selections are recorded via <strong>confidential secret ballot</strong>. Official allotment lists will be released by the department after all 41 students have cast their choices.</li>
          <li>Allocations once confirmed by the system are final and strictly non-transferable.</li>
        </ol>
      </div>
      <p style="text-align: justify; margin-top: 14px;">
        All students are required to complete their slot selection strictly within the designated schedule. Non-compliance will result in direct administrative allocation.
      </p>
    `;
  } else {
    if (refEl) refEl.textContent = 'Ref: SCSC/CSDA/2026-27/SEM6/CIR-02';
    body.innerHTML = `
      <p style="margin-bottom: 16px; text-indent: 40px; text-align: justify;">
        This circular notifies all eligible students of the <strong>III B.Sc. Computer Science with Data Analytics (Academic Batch 2024–2027)</strong> regarding the selection of Elective Courses for the upcoming <strong>Semester VI (2026–2027)</strong> under the autonomous Bharathiar University curriculum framework.
      </p>
      <p style="margin-bottom: 16px; text-align: justify;">
        Students are required to register their academic preferences for both <strong>Elective II</strong> and <strong>Elective III</strong> papers through the college Selection Portal. The courses receiving majority student preference will be offered as the department core electives.
      </p>
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; padding: 18px; border-radius: 6px; margin: 20px 0;">
        <strong style="color: #002B49; display: block; margin-bottom: 8px; font-size: 1.05rem;">
          <i class="fa-solid fa-book-open"></i> Course Choice Categories:
        </strong>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px;">
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 12px; border-radius: 6px;">
            <strong style="color: #9B1C2E; display: block; margin-bottom: 6px;">ELECTIVE II PAPERS:</strong>
            <ul style="font-size: 0.88rem; line-height: 1.6; padding-left: 18px;">
              <li>24BSD63E05: 5G & Future Network Tech.</li>
              <li>24BSD63E06: Predictive Analytics</li>
              <li>24BSD63E07: Software Engineering</li>
              <li>24BSD63E08: Market Analysis & Decision</li>
            </ul>
          </div>
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 12px; border-radius: 6px;">
            <strong style="color: #002B49; display: block; margin-bottom: 6px;">ELECTIVE III PAPERS:</strong>
            <ul style="font-size: 0.88rem; line-height: 1.6; padding-left: 18px;">
              <li>24BSD63E09: Internet of Things (IoT)</li>
              <li>24BSD63E10: Natural Language Processing</li>
              <li>24BSD63E11: Mobile Application Dev.</li>
              <li>24BSD63E12: Block Chain Technology</li>
            </ul>
          </div>
        </div>
      </div>
      <p style="text-align: justify; margin-top: 14px;">
        Selection closes upon receipt of all 43 batch submissions. Tutors and HOD approval will follow immediately.
      </p>
    `;
  }
}

// ==========================================
// 7. 5-PAGE REPORT GENERATION (ADMIN VIEW)
// ==========================================

function populateReportTables() {
  const db = getLocalDB();
  const gp = db.guidePortal;
  const ep = db.electivePortal;

  // Report guide table
  const repGuideContainer = document.getElementById('reportGuideTableContainer');
  if (repGuideContainer) {
    if (gp.submissions.length > 0) {
      repGuideContainer.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Reg. No</th>
              <th>Student Name</th>
              <th>Slot Chosen</th>
              <th>Allocated Guide</th>
            </tr>
          </thead>
          <tbody>
            ${gp.submissions.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHTML(s.regNo)}</strong></td>
                <td>${escapeHTML(s.studentName)}</td>
                <td>Slot #${s.slotChosen}</td>
                <td>${escapeHTML(s.guideName)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      repGuideContainer.innerHTML = `<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Awaiting student registrations tomorrow...</p>`;
    }
  }

  // Report elective table
  const repElectiveContainer = document.getElementById('reportElectiveTableContainer');
  if (repElectiveContainer) {
    if (ep.submissions.length > 0) {
      repElectiveContainer.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Reg. No</th>
              <th>Student Name</th>
              <th>Elective II</th>
              <th>Elective III</th>
            </tr>
          </thead>
          <tbody>
            ${ep.submissions.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHTML(s.regNo)}</strong></td>
                <td>${escapeHTML(s.studentName)}</td>
                <td>${escapeHTML(s.elective2Title)}</td>
                <td>${escapeHTML(s.elective3Title)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      repElectiveContainer.innerHTML = `<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Awaiting elective submissions...</p>`;
    }
  }
}

function renderIndividualPhotoSlots() {
  // Photos slot handler preserved for report appendix
}

function triggerLeadPhotoUpload(index) {
  document.getElementById(`leadPhotoInput${index}`).click();
}

function previewLeadPhoto(event, index) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const container = document.getElementById(`leadPhotoPreview${index}`);
    container.innerHTML = `<img src="${e.target.result}" alt="Student Lead Photo">`;
  };
  reader.readAsDataURL(file);
}

function triggerGlimpseUpload(index) {
  document.getElementById(`glimpseInput${index}`).click();
}

function previewGlimpse(event, index) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const container = document.getElementById(`glimpsePreview${index}`);
    container.innerHTML = `<img src="${e.target.result}" alt="Event Glimpse Photo">`;
  };
  reader.readAsDataURL(file);
}

// ==========================================
// 8. MULTI-DEVICE & NETWORK MODAL
// ==========================================

async function loadNetworkInfo() {
  try {
    const res = await fetch('/api/system/network-info');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        document.getElementById('networkUrlInput').value = data.networkUrl;
        document.getElementById('networkQrImage').src = data.qrCodeDataUrl;
        return;
      }
    }
  } catch (err) {}

  const currentUrl = window.location.origin;
  const input = document.getElementById('networkUrlInput');
  if (input) input.value = currentUrl;
}

function openNetworkModal() {
  loadNetworkInfo();
  document.getElementById('networkModal')?.classList.remove('d-none');
}

function closeNetworkModal() {
  document.getElementById('networkModal')?.classList.add('d-none');
}

function copyNetworkUrl() {
  const input = document.getElementById('networkUrlInput');
  input.select();
  document.execCommand('copy');
  alert('Network URL copied to clipboard: ' + input.value);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

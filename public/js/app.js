// Sankara College of Science and Commerce (Autonomous)
// Department of Computer Science with Data Analytics
// Academic Selection Terminal - Dynamic Rotation & Anti-Collision Allocation Engine

let currentView = 'view-gateway';
let activeStudentService = 'guide';
let activeStaffTab = 'staff-submissions';
let activeSubmissionView = 'master'; // 'master' or 'guidewise'
let adminUnlocked = false;
let guideData = null;
let electiveData = null;
let activeCircularType = 'guide';

const LOCAL_STORAGE_KEY = 'scsc_portal_data_v2';

// ----------------------------------------------------
// 0. LIVE RESILIENT DYNAMIC ENGINE (LOCAL STORAGE FALLBACK)
// ----------------------------------------------------
function getLocalDB() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure institution name is Autonomous
      if (parsed.system) {
        parsed.system.institutionName = "Sankara College of Science and Commerce (Autonomous)";
      }
      return parsed;
    }
  } catch (e) {
    console.error('LocalStorage read error:', e);
  }

  // 5 Guide Faculty: Exactly 4 guides with quota 8, exactly 1 guide with quota 9 (Total = 41 students)
  const defaultState = {
    system: {
      institutionName: "Sankara College of Science and Commerce (Autonomous)",
      department: "Department of Computer Science with Data Analytics",
      batch: "2024-2027",
      semester: "Semester VI",
      staffPassword: "data sorcerers",
      isLive: true
    },
    guidePortal: {
      isLive: true,
      targetStudents: 41,
      slotCount: 8,
      ninthGuideId: "g1",
      lastSlotGuideMap: {},
      lastAllocatedGuideId: null,
      slotHistory: {},
      guides: [
        { id: "g1", name: "Dr. K. Meenakshi", designation: "Assistant Professor, CS & DA", maxStudents: 9, assignedCount: 0 },
        { id: "g2", name: "Prof. S. Kavitha", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
        { id: "g3", name: "Dr. R. Malathi", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
        { id: "g4", name: "Prof. P. Deepa", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
        { id: "g5", name: "Dr. N. Priyanka", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 }
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

  // Polling for real-time background sync
  setInterval(() => {
    loadGuideConfig(true);
    loadElectiveConfig(true);
    if (adminUnlocked) {
      loadAdminData();
    }
  }, 3000);
});

// ==========================================
// 1. TOP-LEVEL VIEW NAVIGATION (GATEWAY vs STUDENT vs STAFF)
// ==========================================

function switchView(viewId) {
  currentView = viewId;
  document.querySelectorAll('.app-view').forEach(view => {
    if (view.id === viewId) {
      view.classList.remove('d-none');
      view.classList.add('active');
    } else {
      view.classList.remove('active');
      view.classList.add('d-none');
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showGateway() {
  switchView('view-gateway');
}

function showStudentPortal(service = 'guide') {
  switchView('view-student');
  switchStudentService(service);
}

function showStaffPortal() {
  switchView('view-staff');
  if (adminUnlocked) {
    document.getElementById('staffLockState')?.classList.add('d-none');
    document.getElementById('staffDashboardState')?.classList.remove('d-none');
    loadAdminData();
  } else {
    document.getElementById('staffLockState')?.classList.remove('d-none');
    document.getElementById('staffDashboardState')?.classList.add('d-none');
    const pwdInput = document.getElementById('adminPasswordInput');
    if (pwdInput) setTimeout(() => pwdInput.focus(), 200);
  }
}

function switchStudentService(service) {
  activeStudentService = service;
  const guideTab = document.getElementById('tabStudentGuideBtn');
  const electiveTab = document.getElementById('tabStudentElectiveBtn');
  const guidePane = document.getElementById('student-guide-service');
  const electivePane = document.getElementById('student-elective-service');

  if (service === 'guide') {
    guideTab?.classList.add('active');
    electiveTab?.classList.remove('active');
    guidePane?.classList.remove('d-none');
    guidePane?.classList.add('active');
    electivePane?.classList.remove('active');
    electivePane?.classList.add('d-none');
  } else {
    electiveTab?.classList.add('active');
    guideTab?.classList.remove('active');
    electivePane?.classList.remove('d-none');
    electivePane?.classList.add('active');
    guidePane?.classList.remove('active');
    guidePane?.classList.add('d-none');
  }
}

// ==========================================
// 2. GUIDE SELECTION MULTI-STEP WIZARD
// ==========================================

function updateGuideWizardProgress(activeStep) {
  const node1 = document.getElementById('gStepNode1');
  const node2 = document.getElementById('gStepNode2');
  const node3 = document.getElementById('gStepNode3');
  const line1 = document.getElementById('gStepLine1');
  const line2 = document.getElementById('gStepLine2');

  [node1, node2, node3].forEach(n => n?.classList.remove('active', 'completed'));
  [line1, line2].forEach(l => l?.classList.remove('completed'));

  if (activeStep === 1) {
    node1?.classList.add('active');
  } else if (activeStep === 2) {
    node1?.classList.add('completed');
    line1?.classList.add('completed');
    node2?.classList.add('active');
  } else if (activeStep === 3) {
    node1?.classList.add('completed');
    line1?.classList.add('completed');
    node2?.classList.add('completed');
    line2?.classList.add('completed');
    node3?.classList.add('active', 'completed');
  }
}

function nextGuideStep() {
  const regNoInput = document.getElementById('guideRegNo');
  const nameInput = document.getElementById('guideStudentName');
  const errBox = document.getElementById('guideStep1Error');

  const regNo = regNoInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();

  if (!regNo) {
    if (errBox) errBox.textContent = 'Please enter your College Register Number.';
    regNoInput.focus();
    return;
  }

  if (!name) {
    if (errBox) errBox.textContent = 'Please enter your Full Name.';
    nameInput.focus();
    return;
  }

  if (errBox) errBox.textContent = '';

  const disp = document.getElementById('guideActiveStudentDisplay');
  if (disp) disp.textContent = `${name} (${regNo})`;

  document.getElementById('guideStep1')?.classList.add('d-none');
  document.getElementById('guideStep2')?.classList.remove('d-none');
  updateGuideWizardProgress(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevGuideStep() {
  document.getElementById('guideStep2')?.classList.add('d-none');
  document.getElementById('guideStep1')?.classList.remove('d-none');
  updateGuideWizardProgress(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------------------------------------------
// ALLOCATION LOGIC ENGINE:
// 1. Quota: 4 guides max 8 students, 1 guide max 9 students (Total = 41).
// 2. Automatic Termination: once a guide reaches 8 (or 9 for the designated guide),
//    that guide is automatically terminated and excluded from the eligible pool.
// 3. Anti-Collision Rotation: if slot 1 is clicked by 3 consecutive students,
//    all 3 students receive DIFFERENT guides!
// ----------------------------------------------------
async function handleSlotSelection(slotNum) {
  const regNo = document.getElementById('guideRegNo').value.trim().toUpperCase();
  const studentName = document.getElementById('guideStudentName').value.trim();
  const statusMsg = document.getElementById('guideStep2Status');

  if (!regNo || !studentName) {
    prevGuideStep();
    return;
  }

  // Visual card click animation
  const card = document.querySelector(`.slot-card[data-slot="${slotNum}"]`);
  if (card) {
    card.style.transform = 'scale(0.94)';
    setTimeout(() => { card.style.transform = ''; }, 220);
  }

  if (statusMsg) {
    statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Securely casting slot selection...`;
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
      if (result.success || result.isExisting) {
        completeGuideSubmission(result.submission || { regNo, studentName, slotChosen: slotNum });
        loadGuideConfig(true);
        if (adminUnlocked) loadAdminData();
        return;
      } else if (result.error) {
        alert(result.error);
        return;
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        alert(errData.error);
        return;
      }
    }
  } catch (err) {
    console.warn('Server offline, using local dynamic allocation engine:', err);
  }

  // 2. Resilient In-Browser Fallback Engine
  const db = getLocalDB();
  const gp = db.guidePortal;

  // Check if student already voted
  const existing = gp.submissions.find(s => s.regNo === regNo);
  if (existing) {
    completeGuideSubmission(existing);
    return;
  }

  const ninthGuideId = gp.ninthGuideId || (gp.guides[0] ? gp.guides[0].id : 'g1');
  const totalAllocated = gp.submissions.length;

  // Recount current assignments
  gp.guides.forEach(g => {
    g.assignedCount = gp.submissions.filter(s => s.guideId === g.id).length;
  });

  // STEP A: Strict automatic termination condition:
  // For first 40 students: all guides are terminated once they reach 8 students.
  // For 41st student: only the single designated guide can accept the 9th student.
  let eligibleGuides;
  if (totalAllocated < 40) {
    eligibleGuides = gp.guides.filter(g => (g.assignedCount || 0) < 8);
  } else {
    eligibleGuides = gp.guides.filter(g => g.id === ninthGuideId && (g.assignedCount || 0) < 9);
    if (eligibleGuides.length === 0) {
      eligibleGuides = gp.guides.filter(g => (g.assignedCount || 0) < (g.maxStudents || 8));
    }
  }

  if (eligibleGuides.length === 0) {
    alert('All 41 student allocations are complete!');
    return;
  }

  // STEP B: Anti-Collision Rotation per Slot:
  // If Slot 1 is clicked by 3 students, all 3 receive DIFFERENT guides!
  gp.slotHistory = gp.slotHistory || {};
  const recentForSlot = gp.slotHistory[slotNum] || [];
  const lastAllocatedId = gp.lastAllocatedGuideId || null;

  let candidates = eligibleGuides;

  // Exclude guides recently allocated for this slot
  if (recentForSlot.length > 0 && candidates.length > 1) {
    const nonRecent = candidates.filter(g => !recentForSlot.includes(g.id));
    if (nonRecent.length > 0) {
      candidates = nonRecent;
    } else {
      const mostRecentId = recentForSlot[recentForSlot.length - 1];
      const withoutMostRecent = candidates.filter(g => g.id !== mostRecentId);
      if (withoutMostRecent.length > 0) candidates = withoutMostRecent;
    }
  }

  // Also prevent consecutive identical guide allocation across any two back-to-back student picks
  if (lastAllocatedId && candidates.length > 1) {
    const diffCandidates = candidates.filter(g => g.id !== lastAllocatedId);
    if (diffCandidates.length > 0) candidates = diffCandidates;
  }

  // Dynamic uniform selection among candidates
  const chosenIndex = Math.floor(Math.random() * candidates.length);
  const assignedGuide = candidates[chosenIndex];

  assignedGuide.assignedCount = (assignedGuide.assignedCount || 0) + 1;
  gp.lastAllocatedGuideId = assignedGuide.id;

  // Track history for this slot
  if (!gp.slotHistory[slotNum]) gp.slotHistory[slotNum] = [];
  gp.slotHistory[slotNum].push(assignedGuide.id);
  if (gp.slotHistory[slotNum].length > 4) gp.slotHistory[slotNum].shift();

  const newSub = {
    regNo,
    studentName,
    slotChosen: slotNum,
    guideId: assignedGuide.id,
    guideName: assignedGuide.name || 'Assigned Faculty Guide',
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  gp.submissions.push(newSub);
  saveLocalDB(db);

  completeGuideSubmission(newSub);
}

function completeGuideSubmission(submission) {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }

  // Populate Step 3 Receipt
  const rReg = document.getElementById('receiptGuideRegNo');
  const rName = document.getElementById('receiptGuideName');
  const rSlot = document.getElementById('receiptGuideSlot');

  if (rReg) rReg.textContent = submission.regNo;
  if (rName) rName.textContent = submission.studentName;
  if (rSlot) rSlot.textContent = `Slot #${submission.slotChosen} Selected`;

  // Advance to Step 3
  document.getElementById('guideStep2')?.classList.add('d-none');
  document.getElementById('guideStep3')?.classList.remove('d-none');
  updateGuideWizardProgress(3);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  loadGuideConfig();
}

function resetGuideWizard() {
  document.getElementById('guideRegNo').value = '';
  document.getElementById('guideStudentName').value = '';
  document.getElementById('guideStep1Error').textContent = '';
  const statusMsg = document.getElementById('guideStep2Status');
  if (statusMsg) {
    statusMsg.innerHTML = `<i class="fa-solid fa-hand-pointer"></i> Select one of the mystery slots above to submit your vote.`;
  }

  document.getElementById('guideStep3')?.classList.add('d-none');
  document.getElementById('guideStep2')?.classList.add('d-none');
  document.getElementById('guideStep1')?.classList.remove('d-none');
  updateGuideWizardProgress(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 3. ELECTIVE SELECTION MULTI-STEP WIZARD (SAME ORDER FORMAT)
// ==========================================

function updateElectiveWizardProgress(activeStep) {
  const node1 = document.getElementById('eStepNode1');
  const node2 = document.getElementById('eStepNode2');
  const node3 = document.getElementById('eStepNode3');
  const line1 = document.getElementById('eStepLine1');
  const line2 = document.getElementById('eStepLine2');

  [node1, node2, node3].forEach(n => n?.classList.remove('active', 'completed'));
  [line1, line2].forEach(l => l?.classList.remove('completed'));

  if (activeStep === 1) {
    node1?.classList.add('active');
  } else if (activeStep === 2) {
    node1?.classList.add('completed');
    line1?.classList.add('completed');
    node2?.classList.add('active');
  } else if (activeStep === 3) {
    node1?.classList.add('completed');
    line1?.classList.add('completed');
    node2?.classList.add('completed');
    line2?.classList.add('completed');
    node3?.classList.add('active', 'completed');
  }
}

function nextElectiveStep() {
  const regNoInput = document.getElementById('electiveRegNo');
  const nameInput = document.getElementById('electiveStudentName');
  const errBox = document.getElementById('electiveStep1Error');

  const regNo = regNoInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();

  if (!regNo) {
    if (errBox) errBox.textContent = 'Please enter your College Register Number.';
    regNoInput.focus();
    return;
  }

  if (!name) {
    if (errBox) errBox.textContent = 'Please enter your Full Name.';
    nameInput.focus();
    return;
  }

  if (errBox) errBox.textContent = '';

  const disp = document.getElementById('electiveActiveStudentDisplay');
  if (disp) disp.textContent = `${name} (${regNo})`;

  document.getElementById('electiveStep1')?.classList.add('d-none');
  document.getElementById('electiveStep2')?.classList.remove('d-none');
  updateElectiveWizardProgress(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevElectiveStep() {
  document.getElementById('electiveStep2')?.classList.add('d-none');
  document.getElementById('electiveStep1')?.classList.remove('d-none');
  updateElectiveWizardProgress(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitElectiveWizard() {
  const regNo = document.getElementById('electiveRegNo').value.trim().toUpperCase();
  const studentName = document.getElementById('electiveStudentName').value.trim();
  const e2Radio = document.querySelector('input[name="elective2"]:checked');
  const e3Radio = document.querySelector('input[name="elective3"]:checked');
  const errBox = document.getElementById('electiveStep2Error');

  if (!e2Radio || !e3Radio) {
    if (errBox) errBox.textContent = 'Please select one course from Elective II and one course from Elective III.';
    return;
  }

  if (errBox) errBox.textContent = '';

  const elective2Code = e2Radio.value;
  const elective3Code = e3Radio.value;

  const electiveCoursesMap = {
    '24BSD63E05': '5G & Future Network Technologies',
    '24BSD63E06': 'Predictive Analytics',
    '24BSD63E07': 'Software Engineering',
    '24BSD63E08': 'Market Analysis and Decision Making',
    '24BSD63E09': 'Internet of Things (IoT)',
    '24BSD63E10': 'Natural Language Processing (NLP)',
    '24BSD63E11': 'Mobile Application Development',
    '24BSD63E12': 'Block Chain Technology'
  };

  const e2Title = electiveCoursesMap[elective2Code] || elective2Code;
  const e3Title = electiveCoursesMap[elective3Code] || elective3Code;

  // 1. Try Server API
  try {
    const res = await fetch('/api/elective/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regNo,
        studentName,
        elective2Code,
        elective3Code
      })
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success || result.isExisting) {
        completeElectiveSubmission({
          regNo,
          studentName,
          elective2Title: `${elective2Code} - ${e2Title}`,
          elective3Title: `${elective3Code} - ${e3Title}`
        });
        return;
      }
    }
  } catch (err) {}

  // 2. Resilient In-Browser Fallback Engine
  const db = getLocalDB();
  const ep = db.electivePortal;

  const existingIdx = ep.submissions.findIndex(s => s.regNo === regNo);
  const subData = {
    regNo,
    studentName,
    elective2Code,
    elective2Title: `${elective2Code} - ${e2Title}`,
    elective3Code,
    elective3Title: `${elective3Code} - ${e3Title}`,
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  if (existingIdx >= 0) {
    ep.submissions[existingIdx] = subData;
  } else {
    ep.submissions.push(subData);
  }
  saveLocalDB(db);

  completeElectiveSubmission(subData);
}

function completeElectiveSubmission(submission) {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }

  const rReg = document.getElementById('receiptElectiveRegNo');
  const rName = document.getElementById('receiptElectiveName');
  const rE2 = document.getElementById('receiptElective2');
  const rE3 = document.getElementById('receiptElective3');

  if (rReg) rReg.textContent = submission.regNo;
  if (rName) rName.textContent = submission.studentName;
  if (rE2) rE2.textContent = submission.elective2Title;
  if (rE3) rE3.textContent = submission.elective3Title;

  document.getElementById('electiveStep2')?.classList.add('d-none');
  document.getElementById('electiveStep3')?.classList.remove('d-none');
  updateElectiveWizardProgress(3);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  loadElectiveConfig();
}

function resetElectiveWizard() {
  document.getElementById('electiveRegNo').value = '';
  document.getElementById('electiveStudentName').value = '';
  document.getElementById('electiveStep1Error').textContent = '';
  document.getElementById('electiveStep2Error').textContent = '';

  document.querySelectorAll('input[name="elective2"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="elective3"]').forEach(r => r.checked = false);

  document.getElementById('electiveStep3')?.classList.add('d-none');
  document.getElementById('electiveStep2')?.classList.add('d-none');
  document.getElementById('electiveStep1')?.classList.remove('d-none');
  updateElectiveWizardProgress(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 4. CONFIG LOADER (SERVER + LOCAL FALLBACK)
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

  const db = getLocalDB();
  const gp = db.guidePortal;
  gp.guides.forEach(g => {
    g.assignedCount = gp.submissions.filter(s => s.guideId === g.id).length;
  });

  guideData = {
    success: true,
    isLive: true,
    targetStudents: gp.targetStudents || 41,
    totalRegistered: gp.submissions.length,
    slotCount: gp.slotCount || 8,
    guides: gp.guides
  };
}

async function loadElectiveConfig(silent = false) {
  try {
    const res = await fetch('/api/elective/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        electiveData = data;
        if (adminUnlocked) updateElectiveAnalyticsUI();
        return;
      }
    }
  } catch (err) {}

  const db = getLocalDB();
  const ep = db.electivePortal;
  electiveData = {
    success: true,
    targetStudents: ep.targetStudents || 43,
    totalSubmitted: ep.submissions.length,
    submissions: ep.submissions
  };
  if (adminUnlocked) updateElectiveAnalyticsUI();
}

// ==========================================
// 5. STAFF & FACULTY ADMIN CONSOLE
// ==========================================

function handleAdminLogin(e) {
  e.preventDefault();
  const pwdInput = document.getElementById('adminPasswordInput');
  const feedback = document.getElementById('adminLoginFeedback');
  const entered = pwdInput.value.trim();

  const db = getLocalDB();
  const validPwd = db.system.staffPassword || 'data sorcerers';

  if (entered.toLowerCase() === validPwd.toLowerCase() || entered.toLowerCase() === 'data sorcerers') {
    adminUnlocked = true;
    if (feedback) feedback.textContent = '';
    document.getElementById('staffLockState')?.classList.add('d-none');
    document.getElementById('staffDashboardState')?.classList.remove('d-none');
    loadAdminData();
  } else {
    if (feedback) feedback.textContent = 'Invalid passkey. Please enter the authorized department passkey.';
    pwdInput.focus();
  }
}

function handleAdminLogout() {
  adminUnlocked = false;
  document.getElementById('adminPasswordInput').value = '';
  document.getElementById('staffDashboardState')?.classList.add('d-none');
  document.getElementById('staffLockState')?.classList.remove('d-none');
  showGateway();
}

function switchStaffTab(tabId) {
  activeStaffTab = tabId;
  document.querySelectorAll('.staff-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-staff-tab') === tabId);
  });
  document.querySelectorAll('.staff-sub-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
    pane.classList.toggle('d-none', pane.id !== tabId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabId === 'staff-report') {
    populateReportTables();
  }
}

function toggleSubmissionsView(viewType) {
  activeSubmissionView = viewType;
  const btnMaster = document.getElementById('btnViewMasterTable');
  const btnGuideWise = document.getElementById('btnViewGuideWise');
  const masterContainer = document.getElementById('adminGuideSubmissionsTable');
  const guideWiseContainer = document.getElementById('adminGuideWiseContainer');

  if (viewType === 'master') {
    btnMaster?.classList.add('active');
    btnGuideWise?.classList.remove('active');
    masterContainer?.classList.remove('d-none');
    guideWiseContainer?.classList.add('d-none');
  } else {
    btnGuideWise?.classList.add('active');
    btnMaster?.classList.remove('active');
    guideWiseContainer?.classList.remove('d-none');
    masterContainer?.classList.add('d-none');
  }
}

async function loadAdminData() {
  try {
    const [guideRes, electiveRes] = await Promise.all([
      fetch('/api/guide/submissions').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/elective/submissions').then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    const db = getLocalDB();

    if (guideRes && guideRes.success) {
      db.guidePortal.submissions = guideRes.submissions || [];
      if (guideRes.guideGroups) {
        guideRes.guideGroups.forEach(gg => {
          const g = db.guidePortal.guides.find(x => x.id === gg.guideId);
          if (g) {
            if (gg.guideName) g.name = gg.guideName;
            if (gg.designation) g.designation = gg.designation;
            if (gg.maxStudents) g.maxStudents = gg.maxStudents;
            g.assignedCount = gg.assignedCount !== undefined ? gg.assignedCount : (gg.students ? gg.students.length : 0);
          }
        });
      }
    }

    if (electiveRes && electiveRes.success) {
      db.electivePortal.submissions = electiveRes.submissions || [];
    }

    saveLocalDB(db);
  } catch (err) {
    console.warn('Live server sync warning:', err);
  }

  const db = getLocalDB();
  const gp = db.guidePortal;
  const ep = db.electivePortal;

  // Recount current assignments
  gp.guides.forEach(g => {
    g.assignedCount = gp.submissions.filter(s => s.guideId === g.id).length;
  });

  // Counts
  const gCount = document.getElementById('adminGuideCount');
  if (gCount) gCount.textContent = gp.submissions.length;
  const eCount = document.getElementById('adminElectiveCount');
  if (eCount) eCount.textContent = ep.submissions.length;

  // Render Submissions Tables with real live data
  renderAdminGuideMasterTable(gp.submissions);
  renderAdminGuideWiseView(gp.guides, gp.submissions);
  renderAdminElectiveTable(ep.submissions);

  // Render 5 Faculty Editor
  renderFacultyConfigList(gp.guides, gp.ninthGuideId);

  // Render Elective Analytics
  updateElectiveAnalyticsUI();

  // Update Status Banner
  const livePill = document.getElementById('adminLivePill');
  const liveText = document.getElementById('adminLiveText');
  if (livePill && liveText) {
    if (gp.isLive) {
      livePill.innerHTML = `<i class="fa-solid fa-circle-check"></i> SLOTS STATUS: LIVE`;
      livePill.className = 'live-pill live';
      liveText.textContent = 'LIVE (Open for Students)';
      liveText.className = 'text-success';
    } else {
      livePill.innerHTML = `<i class="fa-solid fa-lock"></i> SLOTS STATUS: LOCKED`;
      livePill.className = 'live-pill';
      liveText.textContent = 'LOCKED';
      liveText.className = 'text-danger';
    }
  }

  // Populate dynamic results in Formal 5-Page Report
  populateReportTables();
}

function renderAdminGuideMasterTable(submissions) {
  const cont = document.getElementById('adminGuideSubmissionsTable');
  if (!cont) return;

  if (!submissions || submissions.length === 0) {
    cont.innerHTML = `<div class="p-4 text-muted text-center"><i class="fa-solid fa-inbox fa-2x"></i><br>No guide allocations recorded yet.</div>`;
    return;
  }

  let html = `
    <table class="table-admin">
      <thead>
        <tr>
          <th>#</th>
          <th>College Reg. No</th>
          <th>Student Name</th>
          <th>Slot</th>
          <th>Allocated Guide Name</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
  `;

  submissions.forEach((s, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHTML(s.regNo)}</strong></td>
        <td>${escapeHTML(s.studentName)}</td>
        <td><span class="badge-tag">Slot #${s.slotChosen}</span></td>
        <td><strong class="text-primary">${escapeHTML(s.guideName || 'Guide Assigned')}</strong></td>
        <td><small class="text-muted">${s.timestamp || '-'}</small></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  cont.innerHTML = html;
}

function renderAdminGuideWiseView(guides, submissions) {
  const cont = document.getElementById('adminGuideWiseContainer');
  if (!cont) return;

  let html = `<div class="guide-wise-grid">`;

  guides.forEach((g, idx) => {
    const students = submissions.filter(s => s.guideId === g.id);
    const isNine = (g.maxStudents === 9);

    html += `
      <div class="guide-wise-card">
        <div class="guide-wise-header">
          <div>
            <div class="guide-wise-title">${escapeHTML(g.name || `Guide #${idx + 1}`)}</div>
            <small class="text-muted">${escapeHTML(g.designation || 'Assistant Professor')} ${isNine ? '• 9 Quota' : ''}</small>
          </div>
          <span class="guide-wise-count">${students.length} / ${g.maxStudents || 8}</span>
        </div>
        <table class="guide-wise-students-table">
          <thead>
            <tr>
              <th style="width: 15%;">#</th>
              <th style="width: 40%;">College Reg. No</th>
              <th style="width: 45%;">Student Name</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (students.length === 0) {
      html += `<tr><td colspan="3" class="text-muted text-center" style="padding: 14px 6px;">No students allocated yet</td></tr>`;
    } else {
      students.forEach((st, sIdx) => {
        html += `
          <tr>
            <td>${sIdx + 1}</td>
            <td><strong>${escapeHTML(st.regNo)}</strong></td>
            <td>${escapeHTML(st.studentName)}</td>
          </tr>
        `;
      });
    }

    html += `</tbody></table></div>`;
  });

  html += `</div>`;
  cont.innerHTML = html;
}

function renderAdminElectiveTable(submissions) {
  const cont = document.getElementById('adminElectiveSubmissionsTable');
  if (!cont) return;

  if (!submissions || submissions.length === 0) {
    cont.innerHTML = `<div class="p-4 text-muted text-center"><i class="fa-solid fa-inbox fa-2x"></i><br>No elective submissions recorded yet.</div>`;
    return;
  }

  let html = `
    <table class="table-admin">
      <thead>
        <tr>
          <th>#</th>
          <th>College Reg. No</th>
          <th>Student Name</th>
          <th>Elective II Choice</th>
          <th>Elective III Choice</th>
        </tr>
      </thead>
      <tbody>
  `;

  submissions.forEach((s, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHTML(s.regNo)}</strong></td>
        <td>${escapeHTML(s.studentName)}</td>
        <td><span class="badge-tag">${escapeHTML(s.elective2Title || s.elective2Code)}</span></td>
        <td><span class="badge-tag">${escapeHTML(s.elective3Title || s.elective3Code)}</span></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  cont.innerHTML = html;
}

function renderFacultyConfigList(guides, ninthGuideId) {
  const cont = document.getElementById('facultyConfigList');
  if (!cont) return;

  let html = '';
  guides.forEach((g, idx) => {
    const isNinth = (g.id === (ninthGuideId || 'g1')) || (g.maxStudents === 9);
    html += `
      <div class="faculty-config-card" data-guide-id="${g.id}">
        <div class="f-card-header">
          <span class="f-badge">Faculty Guide #${idx + 1} ${isNinth ? '★ (9-Student Quota)' : '(8-Student Quota)'}</span>
          <span class="f-assigned-count">${g.assignedCount || 0} / ${g.maxStudents || 8} Allocated</span>
        </div>
        <div class="form-group mb-2">
          <label>Faculty Name (Ma'am)</label>
          <input type="text" class="guide-name-input form-control" value="${escapeHTML(g.name || '')}" placeholder="e.g. Dr. K. Meenakshi">
        </div>
        <div class="form-group mb-2">
          <label>Designation</label>
          <input type="text" class="guide-desig-input form-control" value="${escapeHTML(g.designation || 'Assistant Professor, CS & DA')}">
        </div>
        <div class="form-group mb-0">
          <label>Capacity Quota (Auto-Terminated upon reaching)</label>
          <input type="number" class="guide-quota-input form-control" value="${g.maxStudents || 8}" min="1" max="15">
          <small class="text-muted">${isNinth ? 'Designated for 9th student allocation' : 'Terminated automatically at 8'}</small>
        </div>
      </div>
    `;
  });

  cont.innerHTML = html;
}

function saveGuideConfiguration(makeLive = true) {
  const db = getLocalDB();
  const cards = document.querySelectorAll('.faculty-config-card');

  cards.forEach(card => {
    const id = card.getAttribute('data-guide-id');
    const name = card.querySelector('.guide-name-input').value.trim();
    const desig = card.querySelector('.guide-desig-input').value.trim();
    const quota = parseInt(card.querySelector('.guide-quota-input').value.trim(), 10) || 8;

    const g = db.guidePortal.guides.find(item => item.id === id);
    if (g) {
      g.name = name;
      g.designation = desig;
      g.maxStudents = quota;
    }
  });

  if (makeLive) {
    db.guidePortal.isLive = true;
  }

  saveLocalDB(db);
  alert('Faculty Guide configuration saved successfully!');
  loadAdminData();
}

function activateGuideSlotsLive() {
  const db = getLocalDB();
  db.guidePortal.isLive = true;
  saveLocalDB(db);
  loadAdminData();
  alert('Project Guide selection slots are now LIVE for all students.');
}

function deactivateGuideSlotsLive() {
  const db = getLocalDB();
  db.guidePortal.isLive = false;
  saveLocalDB(db);
  loadAdminData();
  alert('Project Guide selection slots are now LOCKED.');
}

// Elective Analytics UI
function updateElectiveAnalyticsUI() {
  const db = getLocalDB();
  const subs = db.electivePortal.submissions || [];

  const e2Counts = {};
  const e3Counts = {};

  subs.forEach(s => {
    const e2 = s.elective2Title || s.elective2Code;
    const e3 = s.elective3Title || s.elective3Code;
    e2Counts[e2] = (e2Counts[e2] || 0) + 1;
    e3Counts[e3] = (e3Counts[e3] || 0) + 1;
  });

  let e2Winner = { name: 'Awaiting votes...', count: 0 };
  for (let k in e2Counts) {
    if (e2Counts[k] > e2Winner.count) e2Winner = { name: k, count: e2Counts[k] };
  }

  let e3Winner = { name: 'Awaiting votes...', count: 0 };
  for (let k in e3Counts) {
    if (e3Counts[k] > e3Winner.count) e3Winner = { name: k, count: e3Counts[k] };
  }

  const e2Title = document.getElementById('e2WinnerTitle');
  const e2Votes = document.getElementById('e2WinnerVotes');
  if (e2Title) e2Title.textContent = e2Winner.name;
  if (e2Votes) e2Votes.textContent = `${e2Winner.count} student votes`;

  const e3Title = document.getElementById('e3WinnerTitle');
  const e3Votes = document.getElementById('e3WinnerVotes');
  if (e3Title) e3Title.textContent = e3Winner.name;
  if (e3Votes) e3Votes.textContent = `${e3Winner.count} student votes`;

  const tallyCont = document.getElementById('electiveTallyList');
  if (!tallyCont) return;

  let html = '<h5>Elective II Course Distribution:</h5>';
  for (let k in e2Counts) {
    html += `
      <div class="tally-item">
        <span class="tally-name">${escapeHTML(k)}</span>
        <span class="tally-count">${e2Counts[k]} votes</span>
      </div>
    `;
  }

  html += '<h5 class="mt-3">Elective III Course Distribution:</h5>';
  for (let k in e3Counts) {
    html += `
      <div class="tally-item">
        <span class="tally-name">${escapeHTML(k)}</span>
        <span class="tally-count">${e3Counts[k]} votes</span>
      </div>
    `;
  }

  tallyCont.innerHTML = html;
}

// ==========================================
// 6. EXPORT ENGINES (EXCEL, WORD, PDF)
// ==========================================

// Helper: 100% Binary-Safe Excel Workbook Downloader
function saveWorkbookAsExcel(wb, filename) {
  try {
    // Generate ArrayBuffer directly using SheetJS DEFLATE compression
    const wbout = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
      compression: true
    });

    // Create Blob with official Microsoft Excel OpenXML MIME type
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
    });

    // Native Microsoft Edge / IE fallback
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.error('Error saving Excel file:', err);
    try {
      XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
    } catch (e2) {
      alert('Unable to download Excel file: ' + e2.message);
    }
  }
}

// 1. Master Student Allocation Excel (.xlsx)
async function downloadMasterStudentExcel() {
  try {
    const res = await fetch('/api/guide/submissions');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.submissions) {
        const db = getLocalDB();
        db.guidePortal.submissions = data.submissions;
        saveLocalDB(db);
      }
    }
  } catch (e) {}

  const db = getLocalDB();
  const gp = db.guidePortal;

  if (typeof XLSX === 'undefined') {
    window.location.href = '/api/guide/export/excel';
    return;
  }

  const wb = XLSX.utils.book_new();

  // --- SHEET 1: Master Student Allocation List ---
  const masterRows = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
    ["Affiliated to Bharathiar University | Approved by AICTE | Re-Accredited with 'A' Grade by NAAC"],
    ["Department of Computer Science with Data Analytics"],
    ["ACADEMIC BATCH 2024–2027 | SEMESTER VI - PROJECT GUIDE ALLOCATION MASTER LIST"],
    ["Total Target: 41 Students (4 Faculty Guides × 8 Quota + 1 Faculty Guide × 9 Quota = 41)"],
    ["Report Generated: " + new Date().toLocaleString()],
    [],
    ["S.No", "College Register Number", "Student Name", "Mystery Slot Chosen", "Allocated Faculty Guide", "Guide Designation", "Timestamp", "Status"]
  ];

  if (!gp.submissions || gp.submissions.length === 0) {
    masterRows.push(["N/A", "No student submissions recorded yet", "Awaiting Live Registrations", "N/A", "Awaiting Allocation", "Assistant Professor, CS & DA", new Date().toLocaleString(), "AWAITING"]);
  } else {
    gp.submissions.forEach((s, idx) => {
      const guideObj = (gp.guides || []).find(g => g.id === s.guideId);
      masterRows.push([
        idx + 1,
        String(s.regNo || ''),
        String(s.studentName || ''),
        `Slot #${s.slotChosen}`,
        String(s.guideName || (guideObj ? guideObj.name : 'Guide Assigned')),
        String(guideObj ? guideObj.designation : 'Assistant Professor, CS & DA'),
        String(s.timestamp || new Date().toLocaleString()),
        "CONFIRMED"
      ]);
    });
  }

  masterRows.push([]);
  masterRows.push(["--- OFFICIAL VERIFICATION & AUTHORIZATION SIGNATURES ---"]);
  masterRows.push(["CLASS TUTOR", "", "HEAD OF DEPARTMENT (HOD)", "", "PRINCIPAL"]);
  masterRows.push(["Signature: _______________________", "", "Signature: _______________________", "", "Signature: _______________________"]);

  const wsMaster = XLSX.utils.aoa_to_sheet(masterRows);
  wsMaster['!cols'] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 30 },
    { wch: 18 },
    { wch: 30 },
    { wch: 32 },
    { wch: 24 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMaster, "Master Student Roster");

  // --- SHEET 2: Guide-Wise Summary ---
  const gwSummaryRows = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
    ["Department of Computer Science with Data Analytics - Guide-Wise Summary"],
    ["Report Generated: " + new Date().toLocaleString()],
    []
  ];

  (gp.guides || []).forEach((g, gIdx) => {
    const students = (gp.submissions || []).filter(s => s.guideId === g.id);
    gwSummaryRows.push([`FACULTY GUIDE #${gIdx + 1}: ${g.name.toUpperCase()} (${g.designation})`, `Allocated: ${students.length} / ${g.maxStudents} Students`]);
    gwSummaryRows.push(["S.No", "College Register Number", "Student Name", "Slot Chosen", "Allocated Guide", "Status"]);

    if (students.length === 0) {
      gwSummaryRows.push(["N/A", "No students allocated to this guide yet", "Awaiting Selection", "N/A", g.name, "VACANT"]);
    } else {
      students.forEach((st, sIdx) => {
        gwSummaryRows.push([sIdx + 1, String(st.regNo || ''), String(st.studentName || ''), `Slot #${st.slotChosen}`, g.name, "CONFIRMED"]);
      });
    }
    gwSummaryRows.push([]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(gwSummaryRows);
  wsSummary['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Guide-Wise Summary");

  // --- SHEET 3: Quota Statistics & System Rules ---
  const statsRows = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
    ["Department of Computer Science with Data Analytics - Allocation Rules & Quota Status"],
    [],
    ["Metric / Rule Description", "Official Value / Configuration"],
    ["Academic Department", "Department of Computer Science with Data Analytics"],
    ["Academic Batch", "2024–2027 (Semester VI)"],
    ["Total Target Student Strength", "41 Students"],
    ["Total Registered Students", String(gp.submissions ? gp.submissions.length : 0)],
    ["Remaining Students", String(Math.max(0, 41 - (gp.submissions ? gp.submissions.length : 0)))],
    ["Completion Percentage", `${Math.round(((gp.submissions ? gp.submissions.length : 0) / 41) * 100)}%`],
    ["Guide Quota Breakdown", "4 Guides × 8 Quota + 1 Guide × 9 Quota = 41 Students"],
    ["Designated 9th Student Guide", "Dr. K. Meenakshi (Capacity: 9 students)"],
    ["Automatic Termination Rule", "Guide automatically locked and terminated upon reaching capacity (8 or 9)"],
    ["Per-Slot Anti-Collision Dynamic Shuffle", "Active (Successive picks on same slot allocate different available guides)"]
  ];
  const wsStats = XLSX.utils.aoa_to_sheet(statsRows);
  wsStats['!cols'] = [{ wch: 40 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsStats, "Quota Statistics");

  saveWorkbookAsExcel(wb, "SCSC_Master_Project_Guide_Allocations_2024_2027.xlsx");
}

// 2. Guide-Wise Grouped Student Allocation Excel (.xlsx)
async function downloadGuideWiseExcel() {
  try {
    const res = await fetch('/api/guide/submissions');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.submissions) {
        const db = getLocalDB();
        db.guidePortal.submissions = data.submissions;
        saveLocalDB(db);
      }
    }
  } catch (e) {}

  const db = getLocalDB();
  const gp = db.guidePortal;

  if (typeof XLSX === 'undefined') {
    window.location.href = '/api/guide/export/excel-guidewise';
    return;
  }

  const wb = XLSX.utils.book_new();

  // --- SHEET 1: Combined Guide-Wise Master Grouping ---
  const guideWiseRows = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
    ["Affiliated to Bharathiar University | Approved by AICTE | Re-Accredited with 'A' Grade by NAAC"],
    ["Department of Computer Science with Data Analytics"],
    ["ACADEMIC BATCH 2024–2027 | SEMESTER VI - GUIDE-WISE GROUPED ALLOCATION ROSTER"],
    ["Total Strength: 41 Students (4 Faculty Guides × 8 Quota + 1 Faculty Guide × 9 Quota = 41)"],
    ["Generated on: " + new Date().toLocaleString()],
    []
  ];

  (gp.guides || []).forEach((g, gIdx) => {
    const students = (gp.submissions || []).filter(s => s.guideId === g.id);
    guideWiseRows.push([`FACULTY GUIDE #${gIdx + 1}: ${g.name.toUpperCase()}`, `Designation: ${g.designation}`, `Allocated: ${students.length} / ${g.maxStudents} Students`]);
    guideWiseRows.push(["S.No", "College Register Number", "Student Name", "Mystery Slot Chosen", "Allocated Faculty Guide", "Status"]);

    if (students.length === 0) {
      guideWiseRows.push(["N/A", "No students allocated to this guide yet", "Awaiting Selection", "N/A", g.name, "VACANT"]);
    } else {
      students.forEach((st, sIdx) => {
        guideWiseRows.push([sIdx + 1, String(st.regNo || ''), String(st.studentName || ''), `Slot #${st.slotChosen}`, g.name, "CONFIRMED"]);
      });
    }
    guideWiseRows.push([]); // blank row
  });

  guideWiseRows.push(["--- OFFICIAL VERIFICATION & AUTHORIZATION SIGNATURES ---"]);
  guideWiseRows.push(["CLASS TUTOR", "", "HEAD OF DEPARTMENT (HOD)", "", "PRINCIPAL"]);
  guideWiseRows.push(["Signature: _______________________", "", "Signature: _______________________", "", "Signature: _______________________"]);

  const wsAll = XLSX.utils.aoa_to_sheet(guideWiseRows);
  wsAll['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsAll, "All Guides Roster");

  // --- SHEETS 2 to 6: Dedicated Tab for Each Faculty Guide ---
  (gp.guides || []).forEach((g, gIdx) => {
    const students = (gp.submissions || []).filter(s => s.guideId === g.id);
    const cleanTabName = `Guide ${gIdx + 1} - ${g.name.split(' ')[1] || g.name}`.slice(0, 30);

    const individualRows = [
      ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
      ["Department of Computer Science with Data Analytics - Project Guide Allocation"],
      [`FACULTY GUIDE: ${g.name.toUpperCase()} (${g.designation})`],
      [`Academic Batch: 2024–2027 | Semester VI | Allocated: ${students.length} of ${g.maxStudents} Students`],
      ["Generated on: " + new Date().toLocaleString()],
      [],
      ["S.No", "College Register Number", "Student Name", "Mystery Slot Chosen", "Allotment Date & Time", "Remarks"]
    ];

    if (students.length === 0) {
      individualRows.push(["N/A", "No students allocated yet", "Awaiting Student Selection", "N/A", new Date().toLocaleString(), "Pending"]);
    } else {
      students.forEach((st, sIdx) => {
        individualRows.push([sIdx + 1, String(st.regNo || ''), String(st.studentName || ''), `Slot #${st.slotChosen}`, String(st.timestamp || new Date().toLocaleString()), "Confirmed"]);
      });
    }

    individualRows.push([]);
    individualRows.push(["CLASS TUTOR", "", "FACULTY GUIDE", "", "HEAD OF DEPARTMENT (HOD)", "", "PRINCIPAL"]);
    individualRows.push(["Signature: ______________", "", "Signature: ______________", "", "Signature: ______________", "", "Signature: ______________"]);

    const wsInd = XLSX.utils.aoa_to_sheet(individualRows);
    wsInd['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 30 }, { wch: 18 }, { wch: 26 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsInd, cleanTabName);
  });

  saveWorkbookAsExcel(wb, "SCSC_Guide_Wise_Student_Allocations_2024_2027.xlsx");
}

// 3. Word Document Exports (.docx)
function downloadMasterWord() {
  window.location.href = '/api/guide/export/word';
}

function downloadGuideWiseWord() {
  window.location.href = '/api/guide/export/word-guidewise';
}

// 4. Elective Course Selections Excel (.xlsx)
async function downloadElectiveExcel() {
  try {
    const res = await fetch('/api/elective/submissions');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.submissions) {
        const db = getLocalDB();
        db.electivePortal.submissions = data.submissions;
        saveLocalDB(db);
      }
    }
  } catch (e) {}

  const db = getLocalDB();
  const ep = db.electivePortal;

  if (typeof XLSX === 'undefined') {
    window.location.href = '/api/elective/export/excel';
    return;
  }

  const wb = XLSX.utils.book_new();

  // --- SHEET 1: Student Selections ---
  const rows = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
    ["Affiliated to Bharathiar University | Approved by AICTE | Re-Accredited with 'A' Grade by NAAC"],
    ["Department of Computer Science with Data Analytics"],
    ["ACADEMIC BATCH 2024–2027 | SEMESTER VI - ELECTIVE COURSE SELECTION MASTER LIST"],
    ["Generated on: " + new Date().toLocaleString()],
    [],
    ["S.No", "College Register Number", "Student Name", "Elective II Course Code & Title", "Elective III Course Code & Title", "Submission Timestamp", "Status"]
  ];

  if (!ep.submissions || ep.submissions.length === 0) {
    rows.push(["N/A", "No elective selections recorded yet", "Awaiting Student Votes", "N/A", "N/A", new Date().toLocaleString(), "AWAITING"]);
  } else {
    ep.submissions.forEach((s, idx) => {
      rows.push([
        idx + 1,
        String(s.regNo || ''),
        String(s.studentName || ''),
        String((s.elective2Code ? s.elective2Code + ' - ' : '') + (s.elective2Title || 'Elective II')),
        String((s.elective3Code ? s.elective3Code + ' - ' : '') + (s.elective3Title || 'Elective III')),
        String(s.timestamp || new Date().toLocaleString()),
        "VOTED"
      ]);
    });
  }

  rows.push([]);
  rows.push(["--- OFFICIAL VERIFICATION & AUTHORIZATION SIGNATURES ---"]);
  rows.push(["CLASS TUTOR", "", "HEAD OF DEPARTMENT (HOD)", "", "PRINCIPAL"]);
  rows.push(["Signature: _______________________", "", "Signature: _______________________", "", "Signature: _______________________"]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 30 }, { wch: 40 }, { wch: 40 }, { wch: 24 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "Student Choices");

  // --- SHEET 2: Analytics & Course Resolution ---
  const totalVotes = ep.submissions ? ep.submissions.length : 0;
  const analyticsRows = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)"],
    ["Department of Computer Science with Data Analytics - Elective Selection Resolution"],
    [`Total Submissions Recorded: ${totalVotes} / ${ep.targetStudents || 43} Students`],
    ["Report Generated: " + new Date().toLocaleString()],
    [],
    ["ELECTIVE II COURSE DISTRIBUTION & POPULARITY ANALYSIS"],
    ["Option", "Course Code", "Course Title", "Total Student Votes", "Vote Share %", "Official Resolution"]
  ];

  // Count E2
  const e2Counts = {};
  (ep.elective2Options || []).forEach(opt => e2Counts[opt.code] = 0);
  (ep.submissions || []).forEach(s => {
    if (s.elective2Code && e2Counts[s.elective2Code] !== undefined) e2Counts[s.elective2Code]++;
  });

  const sortedE2 = [...(ep.elective2Options || [])].sort((a, b) => (e2Counts[b.code] || 0) - (e2Counts[a.code] || 0));
  const maxE2Votes = sortedE2.length > 0 ? (e2Counts[sortedE2[0].code] || 0) : 0;

  sortedE2.forEach(opt => {
    const count = e2Counts[opt.code] || 0;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const isWinner = count > 0 && count === maxE2Votes;
    analyticsRows.push([
      opt.option,
      opt.code,
      opt.title,
      count,
      `${pct}%`,
      isWinner ? "SELECTED (HIGHLY CHOSEN)" : "Alternative Option"
    ]);
  });

  analyticsRows.push([]);
  analyticsRows.push(["ELECTIVE III COURSE DISTRIBUTION & POPULARITY ANALYSIS"]);
  analyticsRows.push(["Option", "Course Code", "Course Title", "Total Student Votes", "Vote Share %", "Official Resolution"]);

  // Count E3
  const e3Counts = {};
  (ep.elective3Options || []).forEach(opt => e3Counts[opt.code] = 0);
  (ep.submissions || []).forEach(s => {
    if (s.elective3Code && e3Counts[s.elective3Code] !== undefined) e3Counts[s.elective3Code]++;
  });

  const sortedE3 = [...(ep.elective3Options || [])].sort((a, b) => (e3Counts[b.code] || 0) - (e3Counts[a.code] || 0));
  const maxE3Votes = sortedE3.length > 0 ? (e3Counts[sortedE3[0].code] || 0) : 0;

  sortedE3.forEach(opt => {
    const count = e3Counts[opt.code] || 0;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const isWinner = count > 0 && count === maxE3Votes;
    analyticsRows.push([
      opt.option,
      opt.code,
      opt.title,
      count,
      `${pct}%`,
      isWinner ? "SELECTED (HIGHLY CHOSEN)" : "Alternative Option"
    ]);
  });

  const wsAnalytics = XLSX.utils.aoa_to_sheet(analyticsRows);
  wsAnalytics['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 14 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsAnalytics, "Resolution Analytics");

  saveWorkbookAsExcel(wb, "SCSC_Elective_Course_Selections_2024_2027.xlsx");
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

// 4. Clean Printable PDF Views
function printMasterPDF() {
  const db = getLocalDB();
  const gp = db.guidePortal;

  let rowsHtml = '';
  gp.submissions.forEach((s, idx) => {
    rowsHtml += `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${escapeHTML(s.regNo)}</strong></td>
        <td>${escapeHTML(s.studentName)}</td>
        <td style="text-align: center;">Slot #${s.slotChosen}</td>
        <td><strong>${escapeHTML(s.guideName || 'Guide Assigned')}</strong></td>
      </tr>
    `;
  });

  if (gp.submissions.length === 0) {
    rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 20px;">No student submissions recorded yet.</td></tr>`;
  }

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sankara College of Science and Commerce (Autonomous) - Master Guide Allocation</title>
      <style>
        body { font-family: 'Arial', sans-serif; padding: 30px; color: #1F2937; }
        .inst-header { text-align: center; border-bottom: 2px solid #002B49; padding-bottom: 15px; margin-bottom: 20px; }
        .inst-name { font-size: 1.4rem; font-weight: bold; color: #002B49; margin: 0; }
        .dept-name { font-size: 1.1rem; color: #9B1C2E; font-weight: bold; margin: 5px 0; }
        .sub-title { font-size: 0.95rem; color: #4B5563; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9rem; }
        th, td { border: 1px solid #CBD5E1; padding: 8px 12px; }
        th { background: #002B49; color: #fff; text-align: left; }
        .sig-row { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; }
        .sig-box { text-align: center; width: 30%; }
        .sig-line { border-top: 1px solid #333; margin-bottom: 6px; }
      </style>
    </head>
    <body>
      <div class="inst-header">
        <h1 class="inst-name">SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)</h1>
        <p class="dept-name">DEPARTMENT OF COMPUTER SCIENCE WITH DATA ANALYTICS</p>
        <p class="sub-title">Semester VI Capstone Project Guide Allocation - Master Student Roster (Batch 2024–2027)</p>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%; text-align: center;">S.No</th>
            <th style="width: 25%;">College Register Number</th>
            <th style="width: 32%;">Student Name</th>
            <th style="width: 15%; text-align: center;">Slot Chosen</th>
            <th style="width: 20%;">Allocated Faculty Guide</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><strong>CLASS TUTOR</strong><br><small>Dept. of CS with DA</small></div>
        <div class="sig-box"><div class="sig-line"></div><strong>HEAD OF DEPARTMENT</strong><br><small>Dept. of CS with DA</small></div>
        <div class="sig-box"><div class="sig-line"></div><strong>PRINCIPAL</strong><br><small>SCSC (Autonomous)</small></div>
      </div>
      <script>window.onload = function() { window.print(); };<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function printGuideWisePDF() {
  const db = getLocalDB();
  const gp = db.guidePortal;

  let bodyHtml = '';
  gp.guides.forEach((g, gIdx) => {
    const students = gp.submissions.filter(s => s.guideId === g.id);
    bodyHtml += `
      <div style="margin-top: 24px;">
        <h3 style="color: #002B49; margin-bottom: 6px; font-size: 1.05rem;">
          FACULTY GUIDE #${gIdx + 1}: ${escapeHTML(g.name.toUpperCase())} (${escapeHTML(g.designation)}) 
          <span style="color: #9B1C2E; font-size: 0.9rem;">— Allocated: ${students.length} / ${g.maxStudents || 8}</span>
        </h3>
        <table>
          <thead>
            <tr>
              <th style="width: 10%; text-align: center;">S.No</th>
              <th style="width: 35%;">College Register Number</th>
              <th style="width: 40%;">Student Name</th>
              <th style="width: 15%; text-align: center;">Slot</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (students.length === 0) {
      bodyHtml += `<tr><td colspan="4" style="text-align: center; color: #6B7280; padding: 10px;">No students allocated yet.</td></tr>`;
    } else {
      students.forEach((st, sIdx) => {
        bodyHtml += `
          <tr>
            <td style="text-align: center;">${sIdx + 1}</td>
            <td><strong>${escapeHTML(st.regNo)}</strong></td>
            <td>${escapeHTML(st.studentName)}</td>
            <td style="text-align: center;">Slot #${st.slotChosen}</td>
          </tr>
        `;
      });
    }

    bodyHtml += `</tbody></table></div>`;
  });

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sankara College of Science and Commerce (Autonomous) - Guide-Wise Allocations</title>
      <style>
        body { font-family: 'Arial', sans-serif; padding: 30px; color: #1F2937; }
        .inst-header { text-align: center; border-bottom: 2px solid #002B49; padding-bottom: 15px; margin-bottom: 20px; }
        .inst-name { font-size: 1.4rem; font-weight: bold; color: #002B49; margin: 0; }
        .dept-name { font-size: 1.1rem; color: #9B1C2E; font-weight: bold; margin: 5px 0; }
        .sub-title { font-size: 0.95rem; color: #4B5563; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.9rem; }
        th, td { border: 1px solid #CBD5E1; padding: 7px 10px; }
        th { background: #002B49; color: #fff; text-align: left; }
        .sig-row { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; }
        .sig-box { text-align: center; width: 30%; }
        .sig-line { border-top: 1px solid #333; margin-bottom: 6px; }
      </style>
    </head>
    <body>
      <div class="inst-header">
        <h1 class="inst-name">SANKARA COLLEGE OF SCIENCE AND COMMERCE (AUTONOMOUS)</h1>
        <p class="dept-name">DEPARTMENT OF COMPUTER SCIENCE WITH DATA ANALYTICS</p>
        <p class="sub-title">Semester VI Project Guide Allocation - Guide-Wise Grouped Student Allocation Roster</p>
      </div>
      ${bodyHtml}
      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div><strong>CLASS TUTOR</strong><br><small>Dept. of CS with DA</small></div>
        <div class="sig-box"><div class="sig-line"></div><strong>HEAD OF DEPARTMENT</strong><br><small>Dept. of CS with DA</small></div>
        <div class="sig-box"><div class="sig-line"></div><strong>PRINCIPAL</strong><br><small>SCSC (Autonomous)</small></div>
      </div>
      <script>window.onload = function() { window.print(); };<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function promptResetGuide() {
  if (!confirm('Are you sure you want to reset all Project Guide Submissions? This action cannot be undone.')) return;
  const db = getLocalDB();
  db.guidePortal.submissions = [];
  db.guidePortal.slotHistory = {};
  db.guidePortal.lastSlotGuideMap = {};
  db.guidePortal.lastAllocatedGuideId = null;
  db.guidePortal.guides.forEach(g => g.assignedCount = 0);
  saveLocalDB(db);
  alert('Project Guide submissions have been reset.');
  loadAdminData();
}

function promptResetElective() {
  if (!confirm('Are you sure you want to reset all Elective Submissions? This action cannot be undone.')) return;
  const db = getLocalDB();
  db.electivePortal.submissions = [];
  saveLocalDB(db);
  alert('Elective submissions have been reset.');
  loadAdminData();
}

// ==========================================
// 7. OFFICIAL CIRCULARS (STAFF VIEW)
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

function renderCircularContent() {
  const bodyEl = document.getElementById('circularBodyContent');
  const refEl = document.getElementById('circRefNo');
  const dateEl = document.getElementById('circularDateText');
  if (!bodyEl) return;

  if (activeCircularType === 'guide') {
    if (refEl) refEl.textContent = 'Ref: SCSC/CSDA/2026-27/SEM6/CIR-01';
    if (dateEl) dateEl.textContent = 'Date: 28.10.2026';
    bodyEl.innerHTML = `
      <p style="margin-bottom: 16px; text-indent: 40px; text-align: justify;">
        This is to officially inform all students of the <strong>III B.Sc. Computer Science with Data Analytics (Academic Batch 2024–2027)</strong> that the selection and allotment of Faculty Project Guides for the <strong>Semester VI Capstone Project (Course Code: 24BSD63V01)</strong> is scheduled to commence as per departmental autonomy regulations.
      </p>
      <p style="margin-bottom: 16px; text-align: justify;">
        To ensure absolute merit, transparency, and impartiality, the allotment process is conducted via the <strong>Data Sorcerers Dynamic Selection Suite</strong>. Each of the 5 Faculty Guide members (Ma'ams) is assigned an equal base student quota of strictly <strong>8 students</strong> (with exactly one faculty receiving the 41st student).
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
    if (dateEl) dateEl.textContent = 'Date: 28.10.2026';
    bodyEl.innerHTML = `
      <p style="margin-bottom: 16px; text-indent: 40px; text-align: justify;">
        This is to officially inform all students of the <strong>III B.Sc. Computer Science with Data Analytics (Academic Batch 2024–2027)</strong> that the choice of Elective Courses for <strong>Semester VI</strong> is open for registration.
      </p>
      <p style="margin-bottom: 16px; text-align: justify;">
        Students are required to register their choices for <strong>Elective II</strong> and <strong>Elective III</strong> as per the prescribed Autonomous curriculum. The course with the highest aggregate student votes will be officially offered by the department.
      </p>
      <div style="background: #F8FAFC; border: 1px solid #CBD5E1; padding: 18px; border-radius: 6px; margin: 20px 0;">
        <strong style="color: #002B49; display: block; margin-bottom: 8px; font-size: 1.05rem;">
          <i class="fa-solid fa-book"></i> Offered Elective Courses:
        </strong>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px;">
          <div>
            <strong>Elective II Options:</strong>
            <ul style="margin-left: 20px; font-size: 0.9rem; line-height: 1.6;">
              <li>24BSD63E05: 5G & Future Networks</li>
              <li>24BSD63E06: Predictive Analytics</li>
              <li>24BSD63E07: Software Engineering</li>
              <li>24BSD63E08: Market Analysis</li>
            </ul>
          </div>
          <div>
            <strong>Elective III Options:</strong>
            <ul style="margin-left: 20px; font-size: 0.9rem; line-height: 1.6;">
              <li>24BSD63E09: Internet of Things (IoT)</li>
              <li>24BSD63E10: NLP</li>
              <li>24BSD63E11: Mobile App Development</li>
              <li>24BSD63E12: Blockchain Technology</li>
            </ul>
          </div>
        </div>
      </div>
      <p style="text-align: justify; margin-top: 14px;">
        Each student is strictly entitled to exactly one submission. Subsequent submissions will supersede prior entries.
      </p>
    `;
  }
}

// ==========================================
// 8. FORMAL 5-PAGE EVENT REPORT (REAL DYNAMIC RESULTS)
// ==========================================

function populateReportTables() {
  const db = getLocalDB();
  const gp = db.guidePortal;
  const ep = db.electivePortal;

  const gCont = document.getElementById('reportGuideTableContainer');
  const eCont = document.getElementById('reportElectiveTableContainer');

  if (gCont) {
    if (gp.submissions.length === 0) {
      gCont.innerHTML = `<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Awaiting student registrations...</p>`;
    } else {
      let html = `
        <table class="report-audit-table">
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">#</th>
              <th style="width: 25%;">College Register Number</th>
              <th style="width: 32%;">Student Name</th>
              <th style="width: 15%; text-align: center;">Slot</th>
              <th style="width: 20%;">Assigned Faculty Guide</th>
            </tr>
          </thead>
          <tbody>
      `;
      gp.submissions.forEach((s, idx) => {
        html += `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td><strong>${escapeHTML(s.regNo)}</strong></td>
            <td>${escapeHTML(s.studentName)}</td>
            <td style="text-align: center;">Slot #${s.slotChosen}</td>
            <td><strong>${escapeHTML(s.guideName || 'Guide Assigned')}</strong></td>
          </tr>
        `;
      });
      html += `</tbody></table>`;
      gCont.innerHTML = html;
    }
  }

  if (eCont) {
    if (ep.submissions.length === 0) {
      eCont.innerHTML = `<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Awaiting elective submissions...</p>`;
    } else {
      let html = `
        <table class="report-audit-table">
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">#</th>
              <th style="width: 25%;">College Register Number</th>
              <th style="width: 27%;">Student Name</th>
              <th style="width: 20%;">Elective II Choice</th>
              <th style="width: 20%;">Elective III Choice</th>
            </tr>
          </thead>
          <tbody>
      `;
      ep.submissions.forEach((s, idx) => {
        html += `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td><strong>${escapeHTML(s.regNo)}</strong></td>
            <td>${escapeHTML(s.studentName)}</td>
            <td>${escapeHTML(s.elective2Title || s.elective2Code)}</td>
            <td>${escapeHTML(s.elective3Title || s.elective3Code)}</td>
          </tr>
        `;
      });
      html += `</tbody></table>`;
      eCont.innerHTML = html;
    }
  }
}

function triggerLeadPhotoUpload(index) {
  const input = document.getElementById(`leadPhotoInput${index}`);
  if (input) input.click();
}

function previewLeadPhoto(event, index) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById(`leadPhotoPreview${index}`);
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Coordinator Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    }
  };
  reader.readAsDataURL(file);
}

function triggerGlimpseUpload(index) {
  const input = document.getElementById(`glimpseInput${index}`);
  if (input) input.click();
}

function previewGlimpse(event, index) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById(`glimpsePreview${index}`);
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Event Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
    }
  };
  reader.readAsDataURL(file);
}

function renderIndividualPhotoSlots() {
  // Placeholders ready
}

// ==========================================
// 9. MULTI-DEVICE NETWORK SYNC MODAL
// ==========================================

function openNetworkModal() {
  const modal = document.getElementById('networkModal');
  if (modal) modal.classList.remove('d-none');
  loadNetworkInfo();
}

function closeNetworkModal() {
  const modal = document.getElementById('networkModal');
  if (modal) modal.classList.add('d-none');
}

async function loadNetworkInfo() {
  const urlInput = document.getElementById('networkUrlInput');
  const qrImg = document.getElementById('networkQrImage');
  const currentUrl = window.location.origin;

  if (urlInput) urlInput.value = currentUrl;
  if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;

  try {
    const res = await fetch('/api/network-info');
    if (res.ok) {
      const data = await res.json();
      if (data.networkUrl && urlInput) {
        urlInput.value = data.networkUrl;
        if (qrImg) qrImg.src = data.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.networkUrl)}`;
      }
    }
  } catch (e) {}
}

function copyNetworkUrl() {
  const input = document.getElementById('networkUrlInput');
  if (!input) return;
  input.select();
  navigator.clipboard.writeText(input.value);
  alert('Network URL copied to clipboard: ' + input.value);
}

// Utility: Escape HTML
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sankara College of Science and Commerce
// Department of Computer Science with Data Analytics
// Application Logic - Gateway Landing & Multi-Step Academic Selection System

let currentView = 'view-gateway';
let activeStudentService = 'guide';
let activeStaffTab = 'staff-submissions';
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
      isLive: true
    },
    guidePortal: {
      isLive: true,
      targetStudents: 41,
      slotCount: 8,
      lastSlotGuideMap: {},
      lastAllocatedGuideId: null,
      guides: [
        { id: "g1", name: "Dr. K. Meenakshi", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
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
  }, 8000);
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
    if (errBox) errBox.textContent = 'Please enter your Student Register Number.';
    regNoInput.focus();
    return;
  }

  if (!name) {
    if (errBox) errBox.textContent = 'Please enter your Full Name.';
    nameInput.focus();
    return;
  }

  if (errBox) errBox.textContent = '';

  // Update display on Step 2
  const disp = document.getElementById('guideActiveStudentDisplay');
  if (disp) disp.textContent = `${name} (${regNo})`;

  // Advance to Step 2
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

async function handleSlotSelection(slotNum) {
  const regNo = document.getElementById('guideRegNo').value.trim().toUpperCase();
  const studentName = document.getElementById('guideStudentName').value.trim();
  const statusMsg = document.getElementById('guideStep2Status');

  if (!regNo || !studentName) {
    prevGuideStep();
    return;
  }

  // Animation on selected slot card
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
        return;
      }
    }
  } catch (err) {
    // Proceed to Local Dynamic Engine
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

  // Anti-collision impartial guide assignment (strict quota: 8 per guide, 1 receives 9th)
  const eligibleGuides = gp.guides.filter(g => (g.assignedCount || 0) < (g.maxStudents || 8));
  let assignedGuide = null;

  if (eligibleGuides.length > 0) {
    // Pick guide with least allocations to balance evenly
    eligibleGuides.sort((a, b) => (a.assignedCount || 0) - (b.assignedCount || 0));
    assignedGuide = eligibleGuides[0];
  } else {
    // All 5 guides reached 8 students; allow 41st student into the first guide
    assignedGuide = gp.guides[0];
  }

  assignedGuide.assignedCount = (assignedGuide.assignedCount || 0) + 1;

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
    confetti({ particleCount: 110, spread: 75, origin: { y: 0.6 } });
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
    if (errBox) errBox.textContent = 'Please enter your Student Register Number.';
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
  } catch (err) {
    // Proceed to Local Dynamic Engine
  }

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
    confetti({ particleCount: 110, spread: 75, origin: { y: 0.6 } });
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

function loadAdminData() {
  const db = getLocalDB();
  const gp = db.guidePortal;
  const ep = db.electivePortal;

  // Counts
  const gCount = document.getElementById('adminGuideCount');
  if (gCount) gCount.textContent = gp.submissions.length;
  const eCount = document.getElementById('adminElectiveCount');
  if (eCount) eCount.textContent = ep.submissions.length;

  // Render Submissions Table
  renderAdminGuideTable(gp.submissions);
  renderAdminElectiveTable(ep.submissions);

  // Render 5 Faculty Editor
  renderFacultyConfigList(gp.guides);

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
}

function renderAdminGuideTable(submissions) {
  const cont = document.getElementById('adminGuideSubmissionsTable');
  if (!cont) return;

  if (!submissions || submissions.length === 0) {
    cont.innerHTML = `<div class="p-3 text-muted text-center"><i class="fa-solid fa-inbox"></i> No guide allocations recorded yet.</div>`;
    return;
  }

  let html = `
    <table class="table-admin">
      <thead>
        <tr>
          <th>#</th>
          <th>Reg. Number</th>
          <th>Student Name</th>
          <th>Slot</th>
          <th>Assigned Guide</th>
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

function renderAdminElectiveTable(submissions) {
  const cont = document.getElementById('adminElectiveSubmissionsTable');
  if (!cont) return;

  if (!submissions || submissions.length === 0) {
    cont.innerHTML = `<div class="p-3 text-muted text-center"><i class="fa-solid fa-inbox"></i> No elective submissions recorded yet.</div>`;
    return;
  }

  let html = `
    <table class="table-admin">
      <thead>
        <tr>
          <th>#</th>
          <th>Reg. Number</th>
          <th>Student Name</th>
          <th>Elective II</th>
          <th>Elective III</th>
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

function renderFacultyConfigList(guides) {
  const cont = document.getElementById('facultyConfigList');
  if (!cont) return;

  let html = '';
  guides.forEach((g, idx) => {
    html += `
      <div class="faculty-config-card" data-guide-id="${g.id}">
        <div class="f-card-header">
          <span class="f-badge">Faculty Guide #${idx + 1}</span>
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
          <label>Max Students (Quota)</label>
          <input type="number" class="guide-quota-input form-control" value="${g.maxStudents || 8}" min="1" max="15">
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

  // Calculate Winners
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

  // Render Tally
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

// In-Browser Master Excel Export (.xlsx)
function downloadMasterExcel() {
  const db = getLocalDB();
  const gp = db.guidePortal;
  const ep = db.electivePortal;

  if (typeof XLSX === 'undefined') {
    window.location.href = '/api/guide/export/excel';
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Master Allotment List
  const masterData = gp.submissions.map((s, idx) => ({
    "S.No": idx + 1,
    "Register Number": s.regNo,
    "Student Name": s.studentName,
    "Mystery Slot Chosen": `Slot #${s.slotChosen}`,
    "Allocated Project Guide": s.guideName,
    "Timestamp": s.timestamp
  }));
  const wsMaster = XLSX.utils.json_to_sheet(masterData.length > 0 ? masterData : [{ "Notice": "No submissions recorded yet." }]);
  XLSX.utils.book_append_sheet(wb, wsMaster, "Master Allotment");

  // Sheet 2: Guide Distribution
  const guideDistData = gp.guides.map(g => {
    const students = gp.submissions.filter(s => s.guideId === g.id);
    return {
      "Faculty Guide Name": g.name || "Awaiting Name",
      "Designation": g.designation,
      "Base Quota Limit": g.maxStudents || 8,
      "Allocated Students Count": students.length,
      "Student Register Numbers": students.map(st => st.regNo).join(', ')
    };
  });
  const wsGuides = XLSX.utils.json_to_sheet(guideDistData);
  XLSX.utils.book_append_sheet(wb, wsGuides, "Guide Distribution");

  // Sheet 3: Elective Selections
  const electiveDataRows = ep.submissions.map((s, idx) => ({
    "S.No": idx + 1,
    "Register Number": s.regNo,
    "Student Name": s.studentName,
    "Elective II Choice": s.elective2Title,
    "Elective III Choice": s.elective3Title,
    "Timestamp": s.timestamp
  }));
  const wsElective = XLSX.utils.json_to_sheet(electiveDataRows.length > 0 ? electiveDataRows : [{ "Notice": "No elective votes recorded yet." }]);
  XLSX.utils.book_append_sheet(wb, wsElective, "Elective Voting");

  XLSX.writeFile(wb, "Sankara_CSDA_Selection_Portal_Master_Sheet.xlsx");
}

function downloadElectiveExcel() {
  downloadMasterExcel();
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

function promptResetGuide() {
  if (!confirm('Are you sure you want to reset all Project Guide Submissions? This action cannot be undone.')) return;
  const db = getLocalDB();
  db.guidePortal.submissions = [];
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
// 6. OFFICIAL CIRCULARS (STAFF VIEW)
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
        Students are required to register their choices for <strong>Elective II</strong> and <strong>Elective III</strong> as per the prescribed Autonomous Bharathiar University curriculum. The course with the highest aggregate student votes will be officially offered by the department.
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
// 7. FORMAL 5-PAGE EVENT REPORT HELPERS
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
              <th>#</th>
              <th>Register Number</th>
              <th>Student Name</th>
              <th>Slot</th>
              <th>Assigned Faculty Guide</th>
            </tr>
          </thead>
          <tbody>
      `;
      gp.submissions.forEach((s, idx) => {
        html += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(s.regNo)}</strong></td>
            <td>${escapeHTML(s.studentName)}</td>
            <td>Slot #${s.slotChosen}</td>
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
              <th>#</th>
              <th>Register Number</th>
              <th>Student Name</th>
              <th>Elective II Choice</th>
              <th>Elective III Choice</th>
            </tr>
          </thead>
          <tbody>
      `;
      ep.submissions.forEach((s, idx) => {
        html += `
          <tr>
            <td>${idx + 1}</td>
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
  // Initial placeholders
}

// ==========================================
// 8. MULTI-DEVICE NETWORK SYNC MODAL
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

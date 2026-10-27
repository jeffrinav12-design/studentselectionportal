// Sankara College of Science and Commerce
// Department of Computer Science with Data Analytics
// Application Logic - Project Guide & Elective Selection System (Live Dynamic Prototype)

let currentTab = 'tab-guide';
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
  initTabs();
  loadGuideConfig();
  loadElectiveConfig();
  loadNetworkInfo();
  renderIndividualPhotoSlots();
  renderCircularContent();

  // Polling for updates
  setInterval(() => {
    loadGuideConfig(true);
    loadElectiveConfig(true);
    if (adminUnlocked) {
      loadAdminData();
    }
  }, 8000);
});

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.getAttribute('data-tab') === tabId) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabId === 'tab-report') {
    populateReportTables();
  }
}

// Open Staff PIN prompt
function openAdminAuth() {
  switchTab('tab-admin');
  const pwdInput = document.getElementById('adminPasswordInput');
  if (pwdInput && !adminUnlocked) {
    setTimeout(() => pwdInput.focus(), 200);
  }
}

// ==========================================
// 1. GUIDE SELECTION LOGIC (STUDENT VIEW)
// ==========================================

async function loadGuideConfig(silent = false) {
  try {
    const res = await fetch('/api/guide/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        guideData = data;
        updateGuideUI();
        return;
      }
    }
  } catch (err) {
    // Serverless / static fallback
  }

  // Local fallback engine
  const db = getLocalDB();
  const gp = db.guidePortal;
  const hasNames = gp.guides.length >= 5 && gp.guides.every(g => g.name && g.name.trim().length > 0);
  
  // Recount assigned
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
  updateGuideUI();
}

function updateGuideUI() {
  if (!guideData) return;

  const reg = guideData.totalRegistered || 0;
  const target = guideData.targetStudents || 41;
  const pct = Math.min(100, Math.round((reg / target) * 100));

  const bar = document.getElementById('guideProgressBar');
  if (bar) bar.style.width = `${pct}%`;

  const progText = document.getElementById('guideProgressText');
  if (progText) progText.textContent = `${reg} of ${target} Students Registered (${pct}%)`;

  const lockCard = document.getElementById('guideLiveStatusCard');
  const lockIcon = document.getElementById('guideLiveStatusIcon');
  const lockTitle = document.getElementById('guideLiveStatusTitle');
  const lockDesc = document.getElementById('guideLiveStatusDesc');
  const lockBadge = document.getElementById('guideLiveStatusBadge');
  const slotsCont = document.getElementById('slotsContainer');

  if (guideData.isLive) {
    if (lockCard) lockCard.className = 'guide-live-status-card live';
    if (lockIcon) lockIcon.className = 'fa-solid fa-circle-check';
    if (lockTitle) lockTitle.textContent = 'Guide Selection Slots are LIVE for Students';
    if (lockDesc) lockDesc.textContent = 'Slots are active with real-time dynamic shuffling. Enter your credentials and click a slot.';
    if (lockBadge) {
      lockBadge.className = 'live-status-badge status-live';
      lockBadge.textContent = 'LIVE NOW';
    }
    if (slotsCont) slotsCont.classList.remove('slots-locked');
  } else {
    if (lockCard) lockCard.className = 'guide-live-status-card locked';
    if (lockIcon) lockIcon.className = 'fa-solid fa-lock';
    if (lockTitle) lockTitle.textContent = 'Guide Selection Locked — Awaiting Faculty Guide Names';
    if (lockDesc) lockDesc.textContent = 'Slots will become live for students tomorrow once Faculty Guide names are officially configured by Staff.';
    if (lockBadge) {
      lockBadge.className = 'live-status-badge status-locked';
      lockBadge.textContent = 'LOCKED';
    }
    if (slotsCont) slotsCont.classList.add('slots-locked');
  }
}

// Handle Student Clicking Slot (Strict Quota, Anti-Collision Shuffle & Secret Ballot)
async function handleSlotClick(slotNum) {
  if (!guideData || !guideData.isLive) {
    alert('Guide selection slots are currently locked.\n\nSlots will be enabled tomorrow morning once Faculty Guide names are officially configured by Staff.');
    return;
  }

  const regNoInput = document.getElementById('guideRegNo');
  const nameInput = document.getElementById('guideStudentName');
  const regNo = regNoInput.value.trim().toUpperCase();
  const studentName = nameInput.value.trim();
  const statusMsg = document.getElementById('slotStatusMessage');

  if (!regNo) {
    alert('Please enter your Register Number first.');
    regNoInput.focus();
    return;
  }

  if (!studentName) {
    alert('Please enter your Student Full Name.');
    nameInput.focus();
    return;
  }

  // Visual card click animation
  const slotCard = document.querySelector(`.slot-card[data-slot="${slotNum}"]`);
  if (slotCard) {
    slotCard.style.transform = 'scale(0.95)';
    setTimeout(() => { slotCard.style.transform = ''; }, 200);
  }

  statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing slot selection and dynamic guide shuffle...`;

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
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
        showGuideRevealModal(result.submission);
        statusMsg.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> Slot #${slotNum} choice cast successfully! Secret ballot recorded securely. Ready for next student.`;
        regNoInput.value = '';
        nameInput.value = '';
        loadGuideConfig();
        return;
      } else if (result.isExisting) {
        showGuideRevealModal(result.submission, true);
        statusMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i> ${escapeHTML(result.error)}`;
        return;
      }
    }
  } catch (err) {
    // Proceed to Local Live Dynamic Engine
  }

  // 2. LIVE DYNAMIC ENGINE (In-Browser Resilient Execution)
  const db = getLocalDB();
  const gp = db.guidePortal;

  // Duplicate check
  const existing = gp.submissions.find(s => s.regNo.toUpperCase() === regNo);
  if (existing) {
    showGuideRevealModal(existing, true);
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i> Register Number ${regNo} has already cast their vote via Slot #${existing.slotChosen}!`;
    return;
  }

  const totalRegistered = gp.submissions.length;
  const targetStudents = gp.targetStudents || 41;
  if (totalRegistered >= targetStudents) {
    alert('All 41 student slots for the batch are fully allocated!');
    return;
  }

  // Strict 8-count quota rule
  // For first 40: guides with < 8
  // For 41st student: guides with < 9
  let eligibleGuides;
  if (totalRegistered < 40) {
    eligibleGuides = gp.guides.filter(g => (g.assignedCount || 0) < 8);
  } else {
    eligibleGuides = gp.guides.filter(g => (g.assignedCount || 0) < 9);
  }

  if (eligibleGuides.length === 0) {
    alert('No guide capacity remaining.');
    return;
  }

  // Dynamic anti-collision shuffle
  const lastGuideIdForSlot = gp.lastSlotGuideMap ? gp.lastSlotGuideMap[slotNum] : null;
  const lastOverallGuideId = gp.lastAllocatedGuideId || null;

  let candidates = eligibleGuides;
  if (lastGuideIdForSlot && candidates.length > 1) {
    const filtered = candidates.filter(g => g.id !== lastGuideIdForSlot);
    if (filtered.length > 0) candidates = filtered;
  }
  if (lastOverallGuideId && candidates.length > 1) {
    const filtered = candidates.filter(g => g.id !== lastOverallGuideId);
    if (filtered.length > 0) candidates = filtered;
  }

  const selectedGuide = candidates[Math.floor(Math.random() * candidates.length)];
  selectedGuide.assignedCount = (selectedGuide.assignedCount || 0) + 1;

  if (!gp.lastSlotGuideMap) gp.lastSlotGuideMap = {};
  gp.lastSlotGuideMap[slotNum] = selectedGuide.id;
  gp.lastAllocatedGuideId = selectedGuide.id;

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
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }

  showGuideRevealModal(subRecord);
  statusMsg.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> Slot #${slotNum} choice cast successfully! Secret ballot recorded securely. Ready for next student.`;
  regNoInput.value = '';
  nameInput.value = '';
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
  
  const regNoInput = document.getElementById('guideRegNo');
  const nameInput = document.getElementById('guideStudentName');
  if (regNoInput) {
    regNoInput.value = '';
    regNoInput.focus();
  }
  if (nameInput) nameInput.value = '';
  const statusMsg = document.getElementById('slotStatusMessage');
  if (statusMsg) {
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-question"></i> Enter your Register Number and Name, then click any slot above to cast your confidential ballot.`;
  }
}

// ==========================================
// 2. ELECTIVE SELECTION LOGIC (STUDENT VIEW)
// ==========================================

async function loadElectiveConfig(silent = false) {
  try {
    const res = await fetch('/api/elective/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        electiveData = data;
        updateElectiveUI();
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
  updateElectiveUI();
}

function updateElectiveUI() {
  if (!electiveData) return;
  const sub = electiveData.totalSubmitted || 0;
  const target = electiveData.targetStudents || 43;
  const pct = Math.min(100, Math.round((sub / target) * 100));

  const bar = document.getElementById('electiveProgressBar');
  if (bar) bar.style.width = `${pct}%`;

  const progText = document.getElementById('electiveProgressText');
  if (progText) progText.textContent = `${sub} of ${target} Students Submitted (${pct}%)`;
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
    '24BSD63E09': 'Internet of Things',
    '24BSD63E10': 'Natural Language Processing',
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
        alert(`Elective Preferences Cast Successfully for ${studentName} (${regNo})!`);
        document.getElementById('electiveSelectionForm').reset();
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

  alert(`Elective Preferences Cast Successfully for ${studentName} (${regNo})!`);
  document.getElementById('electiveSelectionForm').reset();
  loadElectiveConfig();
}

// ==========================================
// 3. STAFF ADMIN CONSOLE (PIN PROTECTED)
// ==========================================

function handleAdminLogin(e) {
  e.preventDefault();
  const pwdInput = document.getElementById('adminPasswordInput');
  const pwd = pwdInput.value.trim().toLowerCase();
  const feedback = document.getElementById('adminLoginFeedback');

  if (pwd === 'data sorcerers') {
    adminUnlocked = true;
    feedback.textContent = '';
    
    // Reveal all Admin Only Tabs!
    document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.remove('d-none'));

    document.getElementById('adminLockState').classList.add('d-none');
    document.getElementById('adminDashboardState').classList.remove('d-none');
    
    loadAdminData();
    switchTab('tab-admin');
  } else {
    feedback.textContent = 'Incorrect security PIN / password. Please enter "data sorcerers".';
    pwdInput.focus();
  }
}

function handleAdminLogout() {
  adminUnlocked = false;
  // Hide Admin Only Tabs
  document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.add('d-none'));

  document.getElementById('adminLockState').classList.remove('d-none');
  document.getElementById('adminDashboardState').classList.add('d-none');
  document.getElementById('adminPasswordInput').value = '';
  switchTab('tab-guide');
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

  // 2. Always persist locally for instant prototype reactivity
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
    "Elective II Code": s.elective2Code,
    "Elective II Title": s.elective2Title,
    "Elective III Code": s.elective3Code,
    "Elective III Title": s.elective3Title,
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
// 4. DEPARTMENT CIRCULARS (ADMIN VIEW)
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

// Alias for backwards compatibility
const switchCircularType = toggleCircular;

function renderCircularContent() {
  const body = document.getElementById('circularBodyContent') || document.getElementById('circularDynamicBody');
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

function updateWatermarkOpacity(val) {
  const wm = document.getElementById('circularWatermark');
  const disp = document.getElementById('opacityValDisplay');
  if (wm) wm.style.opacity = val / 100;
  if (disp) disp.textContent = val + '%';
}

function printOfficialCircular() {
  window.print();
}

// ==========================================
// 5. 5-PAGE REPORT GENERATION (ADMIN VIEW)
// ==========================================

function populateReportTables() {
  const db = getLocalDB();
  const gp = db.guidePortal;
  const ep = db.electivePortal;

  // Report guide table
  const repGuideTable = document.getElementById('reportGuideTableBody');
  if (repGuideTable) {
    if (gp.submissions.length > 0) {
      repGuideTable.innerHTML = gp.submissions.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHTML(s.regNo)}</strong></td>
          <td>${escapeHTML(s.studentName)}</td>
          <td>Slot #${s.slotChosen}</td>
          <td>${escapeHTML(s.guideName)}</td>
        </tr>
      `).join('');
    } else {
      repGuideTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No student guide selections recorded yet.</td></tr>`;
    }
  }

  // Report elective table
  const repElectiveTable = document.getElementById('reportElectiveTableBody');
  if (repElectiveTable) {
    if (ep.submissions.length > 0) {
      repElectiveTable.innerHTML = ep.submissions.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHTML(s.regNo)}</strong></td>
          <td>${escapeHTML(s.studentName)}</td>
          <td>${escapeHTML(s.elective2Title)}</td>
          <td>${escapeHTML(s.elective3Title)}</td>
        </tr>
      `).join('');
    } else {
      repElectiveTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No elective votes recorded yet.</td></tr>`;
    }
  }
}

function renderIndividualPhotoSlots() {
  const grid = document.getElementById('reportStudentPhotoGrid');
  if (!grid) return;
  let html = '';
  for (let i = 1; i <= 41; i++) {
    html += `
      <div class="student-photo-item" onclick="triggerStudentPhotoUpload(${i})">
        <input type="file" id="studentPhotoInput${i}" accept="image/*" class="d-none" onchange="previewStudentPhoto(event, ${i})">
        <div class="photo-placeholder" id="photoPlaceholder${i}">
          <i class="fa-solid fa-camera"></i>
          <span>#${i}</span>
        </div>
      </div>
    `;
  }
  grid.innerHTML = html;
}

function triggerStudentPhotoUpload(idx) {
  document.getElementById(`studentPhotoInput${idx}`).click();
}

function previewStudentPhoto(e, idx) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const ph = document.getElementById(`photoPlaceholder${idx}`);
    ph.innerHTML = `<img src="${evt.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
  };
  reader.readAsDataURL(file);
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

function printReportDossier() {
  window.print();
}

// ==========================================
// 6. MULTI-DEVICE & NETWORK MODAL
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

  // Fallback to window location
  const currentUrl = window.location.origin;
  const input = document.getElementById('networkUrlInput');
  if (input) input.value = currentUrl;
}

function openNetworkModal() {
  loadNetworkInfo();
  document.getElementById('networkModal').classList.remove('d-none');
}

function closeNetworkModal() {
  document.getElementById('networkModal').classList.add('d-none');
}

function copyNetworkUrl() {
  const input = document.getElementById('networkUrlInput');
  input.select();
  document.execCommand('copy');
  alert('Network URL copied to clipboard: ' + input.value);
}

// Event Listeners
document.getElementById('btnNetworkShare')?.addEventListener('click', openNetworkModal);
document.getElementById('btnAdminAccess')?.addEventListener('click', openAdminAuth);

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

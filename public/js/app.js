// Sankara College of Science and Commerce
// Department of Computer Science with Data Analytics
// Application Logic - Project Guide & Elective Selection System

let currentTab = 'tab-home';
let adminUnlocked = false;
let guideData = null;
let electiveData = null;
let activeCircularType = 'guide';

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadGuideConfig();
  loadElectiveConfig();
  loadNetworkInfo();
  renderIndividualPhotoSlots();
  renderCircularContent();

  // Periodic polling for real-time multi-device sync
  setInterval(() => {
    loadGuideConfig(true);
    loadElectiveConfig(true);
    if (adminUnlocked) {
      loadAdminData();
    }
  }, 10000);
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

  if (tabId === 'tab-report') {
    populateReportTables();
  }
}

// ==========================================
// 1. GUIDE SELECTION LOGIC
// ==========================================

async function loadGuideConfig(silent = false) {
  try {
    const res = await fetch('/api/guide/config');
    const data = await res.json();
    if (data.success) {
      guideData = data;
      updateGuideUI();
    }
  } catch (err) {
    if (!silent) console.error('Failed to load guide config:', err);
  }
}

function updateGuideUI() {
  if (!guideData) return;

  // Badges & Counters
  const reg = guideData.totalRegistered;
  const target = guideData.targetStudents || 41;
  const pct = Math.min(100, Math.round((reg / target) * 100));

  const badge = document.getElementById('guideCountBadge');
  if (badge) badge.textContent = `${reg} / ${target}`;

  const homeStat = document.getElementById('homeGuideTotal');
  if (homeStat) homeStat.textContent = `${reg} / ${target}`;

  const bar = document.getElementById('guideProgressBar');
  if (bar) bar.style.width = `${pct}%`;

  const progText = document.getElementById('guideProgressText');
  if (progText) progText.textContent = `${reg} of ${target} Students Registered (${pct}%)`;

  // Live vs Locked state handling
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

  // Render Quota List
  const quotaList = document.getElementById('guideQuotaList');
  if (quotaList) {
    quotaList.innerHTML = guideData.guides.map(g => `
      <div class="quota-item ${g.isFull ? 'full' : ''}">
        <span class="quota-item-name">${escapeHTML(g.name || 'Awaiting Name')}</span>
        <span class="quota-item-count">${g.assignedCount} / ${g.maxStudents} ${g.isFull ? '(FULL)' : ''}</span>
      </div>
    `).join('');
  }
}

// Handle Student Clicking Slot
async function handleSlotClick(slotNum) {
  // Check if locked
  if (!guideData || !guideData.isLive) {
    alert('Guide selection slots are currently locked.\n\nSlots will be enabled tomorrow morning once Faculty Guide names are officially entered by Staff.');
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

  try {
    const res = await fetch('/api/guide/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo, studentName, slot: slotNum })
    });

    const result = await res.json();

    if (result.success) {
      // Confetti celebration
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      }

      showGuideRevealModal(result.submission);
      statusMsg.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> Slot #${slotNum} choice cast successfully! Secret ballot recorded securely. Ready for next student.`;
      
      // Clear inputs
      regNoInput.value = '';
      nameInput.value = '';

      loadGuideConfig();
    } else {
      if (result.isExisting) {
        showGuideRevealModal(result.submission, true);
        statusMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i> ${escapeHTML(result.error)}`;
      } else {
        alert(result.error || 'Submission failed.');
        statusMsg.innerHTML = `<i class="fa-solid fa-circle-xmark text-danger"></i> ${escapeHTML(result.error)}`;
      }
    }
  } catch (err) {
    console.error(err);
    alert('Error connecting to server. Please try again.');
    statusMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-danger"></i> Network connection error.`;
  }
let lastAllocatedSubmission = null;

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
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-question"></i> Enter your Register Number and Name, then click any slot above to cast your selection.`;
  }
}

function printStudentAllotmentSlip() {
  if (!lastAllocatedSubmission) return;
  const s = lastAllocatedSubmission;
  const printWindow = window.open('', '_blank', 'width=700,height=600');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Project Guide Allotment Slip - ${s.regNo}</title>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 40px; color: #002B49; }
        .slip-box { border: 2px solid #002B49; padding: 30px; text-align: center; border-radius: 8px; }
        .college-title { font-size: 20px; font-weight: bold; margin-bottom: 2px; }
        .college-sub { font-size: 13px; color: #4B5563; }
        .dept-title { font-size: 15px; font-weight: bold; color: #9B1C2E; margin: 10px 0; }
        .cert-title { font-size: 18px; font-weight: bold; text-decoration: underline; margin: 15px 0; }
        .details-table { width: 100%; margin: 20px 0; border-collapse: collapse; text-align: left; }
        .details-table td { padding: 10px; border-bottom: 1px solid #E5E7EB; font-size: 15px; }
        .details-table td.label { font-weight: bold; width: 40%; color: #374151; }
        .details-table td.value { font-weight: bold; color: #002B49; }
        .guide-highlight { font-size: 20px; color: #002B49; background: #F8FAFC; padding: 8px; border-radius: 4px; border: 1px solid #CBD5E1; }
        .footer-sigs { display: flex; justify-content: space-between; margin-top: 50px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="slip-box">
        <div class="college-title">SANKARA COLLEGE OF SCIENCE AND COMMERCE</div>
        <div class="college-sub">(Autonomous) | Affiliated to Bharathiar University | NAAC A+ Grade</div>
        <div class="dept-title">DEPARTMENT OF COMPUTER SCIENCE WITH DATA ANALYTICS</div>
        <div class="cert-title">PROJECT GUIDE ALLOTMENT SLIP (SEMESTER VI)</div>
        
        <table class="details-table">
          <tr><td class="label">Register Number:</td><td class="value">${escapeHTML(s.regNo)}</td></tr>
          <tr><td class="label">Student Name:</td><td class="value">${escapeHTML(s.studentName)}</td></tr>
          <tr><td class="label">Academic Batch:</td><td class="value">2024 – 2027 (Semester VI)</td></tr>
          <tr><td class="label">Mystery Slot Picked:</td><td class="value">Slot #${s.slotChosen}</td></tr>
          <tr>
            <td class="label">Allocated Project Guide:</td>
            <td><div class="guide-highlight">${escapeHTML(s.guideName)}</div></td>
          </tr>
          <tr><td class="label">Date & Timestamp:</td><td class="value">${new Date(s.timestamp).toLocaleString()}</td></tr>
        </table>

        <div class="footer-sigs">
          <div>Student Signature</div>
          <div>Staff Coordinator</div>
          <div>HOD Signature</div>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ==========================================
// 2. ELECTIVE SELECTION LOGIC
// ==========================================

async function loadElectiveConfig(silent = false) {
  try {
    const res = await fetch('/api/elective/config');
    const data = await res.json();
    if (data.success) {
      electiveData = data;
      updateElectiveUI();
    }
  } catch (err) {
    if (!silent) console.error('Failed to load elective config:', err);
  }
}

function updateElectiveUI() {
  if (!electiveData) return;

  const reg = electiveData.totalRegistered;
  const target = electiveData.targetStudents || 43;
  const pct = Math.min(100, Math.round((reg / target) * 100));

  const badge = document.getElementById('electiveCountBadge');
  if (badge) badge.textContent = `${reg} / ${target}`;

  const homeStat = document.getElementById('homeElectiveTotal');
  if (homeStat) homeStat.textContent = `${reg} / ${target}`;

  const bar = document.getElementById('electiveProgressBar');
  if (bar) bar.style.width = `${pct}%`;

  const progText = document.getElementById('electiveProgressText');
  if (progText) progText.textContent = `${reg} of ${target} Students Submitted (${pct}%)`;

  // Update Winners
  const e2Winner = electiveData.highestChosenE2;
  const e3Winner = electiveData.highestChosenE3;

  if (e2Winner && e2Winner.votes > 0) {
    document.getElementById('e2WinnerTitle').textContent = `${e2Winner.title} (${e2Winner.code})`;
    document.getElementById('e2WinnerVotes').textContent = `${e2Winner.votes} Student Votes (${e2Winner.percentage}%)`;
  } else {
    document.getElementById('e2WinnerTitle').textContent = "Awaiting student submissions...";
    document.getElementById('e2WinnerVotes').textContent = "0 votes";
  }

  if (e3Winner && e3Winner.votes > 0) {
    document.getElementById('e3WinnerTitle').textContent = `${e3Winner.title} (${e3Winner.code})`;
    document.getElementById('e3WinnerVotes').textContent = `${e3Winner.votes} Student Votes (${e3Winner.percentage}%)`;
  } else {
    document.getElementById('e3WinnerTitle').textContent = "Awaiting student submissions...";
    document.getElementById('e3WinnerVotes').textContent = "0 votes";
  }

  // Update Tally List
  const tallyList = document.getElementById('electiveTallyList');
  if (tallyList) {
    let html = '';
    
    html += '<strong style="font-size:0.75rem; color:#002B49; text-transform:uppercase;">Elective II Options:</strong>';
    electiveData.e2Analytics.forEach(item => {
      html += `
        <div class="tally-item">
          <div class="tally-title-row">
            <span>${escapeHTML(item.title)}</span>
            <strong>${item.votes} (${item.percentage}%)</strong>
          </div>
          <div class="tally-progress-bg">
            <div class="tally-progress-fill" style="width: ${item.percentage}%;"></div>
          </div>
        </div>
      `;
    });

    html += '<strong style="font-size:0.75rem; color:#9B1C2E; text-transform:uppercase; margin-top:8px; display:block;">Elective III Options:</strong>';
    electiveData.e3Analytics.forEach(item => {
      html += `
        <div class="tally-item">
          <div class="tally-title-row">
            <span>${escapeHTML(item.title)}</span>
            <strong>${item.votes} (${item.percentage}%)</strong>
          </div>
          <div class="tally-progress-bg">
            <div class="tally-progress-fill" style="width: ${item.percentage}%; background:#9B1C2E;"></div>
          </div>
        </div>
      `;
    });

    tallyList.innerHTML = html;
  }
}

async function handleElectiveSubmit(e) {
  e.preventDefault();
  const regNo = document.getElementById('electiveRegNo').value.trim().toUpperCase();
  const studentName = document.getElementById('electiveStudentName').value.trim();
  
  const e2Radio = document.querySelector('input[name="elective2"]:checked');
  const e3Radio = document.querySelector('input[name="elective3"]:checked');

  if (!regNo || !studentName) {
    alert('Please enter your Register Number and Name.');
    return;
  }

  if (!e2Radio) {
    alert('Please select one option for Elective II.');
    return;
  }

  if (!e3Radio) {
    alert('Please select one option for Elective III.');
    return;
  }

  const btn = document.getElementById('btnSubmitElective');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting Elective Selection...`;

  try {
    const res = await fetch('/api/elective/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regNo,
        studentName,
        elective2Code: e2Radio.value,
        elective3Code: e3Radio.value
      })
    });

    const data = await res.json();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Elective Course Selection`;

    if (data.success) {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 60 });
      }
      alert(`Success! Elective course selections submitted for ${regNo} (${studentName}).`);
      document.getElementById('electiveSelectionForm').reset();
      loadElectiveConfig();
    } else {
      alert(data.error || 'Failed to submit elective choices.');
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Elective Course Selection`;
    alert('Network error. Please try again.');
  }
}

function printElectiveSummary() {
  switchTab('tab-report');
  setTimeout(() => window.print(), 300);
}

// ==========================================
// 3. OFFICIAL CIRCULARS LOGIC
// ==========================================

function toggleCircular(type) {
  activeCircularType = type;
  document.getElementById('btnCircGuide').classList.toggle('active', type === 'guide');
  document.getElementById('btnCircElective').classList.toggle('active', type === 'elective');
  renderCircularContent();
}

function renderCircularContent() {
  const container = document.getElementById('circularBodyContent');
  const refNo = document.getElementById('circRefNo');
  const dateText = document.getElementById('circularDateText');

  const today = new Date();
  const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
  dateText.textContent = `Date: ${formattedDate}`;

  if (activeCircularType === 'guide') {
    refNo.textContent = 'Ref: SCSC/CSDA/2026-27/SEM6/CIR-01';
    container.innerHTML = `
      <p style="margin-bottom: 16px;">
        The Department of Computer Science with Data Analytics is pleased to notify all final semester students regarding the 
        <strong>Semester VI Project Guide Allocation</strong> for the academic batch <strong>2024–2027</strong>.
      </p>
      <p style="margin-bottom: 16px;">
        To uphold maximum transparency, fairness, and equal opportunity, the allocation process is executed digitally via the 
        department's customized <strong>Slot Shuffling Portal</strong>. All <strong>41 enrolled students</strong> are required to log in 
        with their official Register Number and Full Name, and choose one of the available mystery slot numbers.
      </p>
      <p style="margin-bottom: 16px;">
        The underlying system incorporates a <strong>Dynamic Anti-Collision Shuffle Mechanism</strong> behind the slots, ensuring that 
        faculty guide allocations rotate dynamically on every entry. Once a slot is clicked, the allocated Project Guide will be locked and 
        officially registered in the departmental records.
      </p>
      <p style="margin-bottom: 16px;">
        All students are instructed to complete their slot selection without delay. For any clarifications, contact the undersigned faculty coordinators.
      </p>
    `;
  } else {
    refNo.textContent = 'Ref: SCSC/CSDA/2026-27/SEM6/CIR-02';
    container.innerHTML = `
      <p style="margin-bottom: 16px;">
        The Department of Computer Science with Data Analytics hereby notifies all Semester VI students (Batch: 2024–2027) 
        regarding the selection of <strong>Elective Courses (Elective II & Elective III)</strong> as prescribed by the 
        Bharathiar University curriculum.
      </p>
      <p style="margin-bottom: 16px;">
        All <strong>43 students</strong> must submit their course preferences through the designated Elective Selection Portal. 
        Each student is entitled to select one course from Elective II (5G Technologies, Predictive Analytics, Software Engineering, Market Analysis) 
        and one course from Elective III (IoT, Natural Language Processing, Mobile App Development, Blockchain Technology).
      </p>
      <p style="margin-bottom: 16px;">
        The course securing the highest student vote count will be formally selected and offered as the departmental elective for the semester. 
        The consolidated selection outcome will be ratified by the Academic Council and forwarded to the Principal's office.
      </p>
      <p style="margin-bottom: 16px;">
        Students must ensure their selections are finalized before the announced deadline.
      </p>
    `;
  }
}

// ==========================================
// 4. SUBMISSION REPORT & PHOTO GALLERY
// ==========================================

function renderIndividualPhotoSlots() {
  const container = document.getElementById('individualPhotosContainer');
  if (!container) return;

  let html = '';
  for (let i = 1; i <= 8; i++) {
    html += `
      <div class="photo-cell" onclick="triggerStudentPhotoUpload(${i})" id="photoCell${i}">
        <input type="file" id="studentPhotoInput${i}" accept="image/*" class="d-none" onchange="previewStudentPhoto(event, ${i})">
        <i class="fa-solid fa-user-plus text-muted"></i>
        <span class="photo-cell-title">Student Photo #${i}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function triggerScreenshotUpload(index) {
  document.getElementById(`ssInput${index}`).click();
}

function previewScreenshot(event, index) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById(`ssPreview${index}`);
    preview.innerHTML = `<img src="${e.target.result}" alt="Software Screenshot ${index}">`;
  };
  reader.readAsDataURL(file);
}

function triggerBatchPhotoUpload() {
  document.getElementById('batchPhotoInput').click();
}

function previewBatchPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('batchPhotoPreview');
    preview.innerHTML = `<img src="${e.target.result}" alt="Batch Photograph 2024-2027">`;
  };
  reader.readAsDataURL(file);
}

function triggerStudentPhotoUpload(index) {
  document.getElementById(`studentPhotoInput${index}`).click();
}

function previewStudentPhoto(event, index) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const cell = document.getElementById(`photoCell${index}`);
    cell.innerHTML = `<img src="${e.target.result}" alt="Student Photo ${index}">`;
  };
  reader.readAsDataURL(file);
}

async function populateReportTables() {
  const guideContainer = document.getElementById('reportGuideTableContainer');
  const electiveContainer = document.getElementById('reportElectiveTableContainer');

  try {
    const [resGuide, resElective] = await Promise.all([
      fetch('/api/guide/submissions'),
      fetch('/api/elective/config')
    ]);

    const gData = await resGuide.json();
    const eData = await resElective.json();

    // Guide Table
    if (gData.success && gData.submissions.length > 0) {
      let gHtml = `
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Register Number</th>
              <th>Student Name</th>
              <th>Slot Chosen</th>
              <th>Allocated Guide</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody>
      `;
      gData.submissions.forEach((s, idx) => {
        gHtml += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(s.regNo)}</strong></td>
            <td>${escapeHTML(s.studentName)}</td>
            <td>Slot #${s.slotChosen}</td>
            <td><strong style="color:#002B49;">${escapeHTML(s.guideName)}</strong></td>
            <td>${new Date(s.timestamp).toLocaleString()}</td>
          </tr>
        `;
      });
      gHtml += '</tbody></table>';
      guideContainer.innerHTML = gHtml;
    } else {
      guideContainer.innerHTML = `<p class="text-muted">No student guide selections registered yet.</p>`;
    }

    // Elective Table
    if (eData.success) {
      let eHtml = `
        <table>
          <thead>
            <tr>
              <th>Track</th>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Student Votes</th>
              <th>Share (%)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `;
      const e2WinnerCode = eData.highestChosenE2 ? eData.highestChosenE2.code : null;
      eData.e2Analytics.forEach(c => {
        const isWinner = c.code === e2WinnerCode && c.votes > 0;
        eHtml += `
          <tr style="${isWinner ? 'background:#EFF6FF; font-weight:bold;' : ''}">
            <td>Elective II</td>
            <td>${c.code}</td>
            <td>${escapeHTML(c.title)}</td>
            <td>${c.votes}</td>
            <td>${c.percentage}%</td>
            <td>${isWinner ? '<span style="color:#1D4ED8;"><i class="fa-solid fa-trophy"></i> SELECTED (HIGHLY CHOSEN)</span>' : 'Alternative'}</td>
          </tr>
        `;
      });

      const e3WinnerCode = eData.highestChosenE3 ? eData.highestChosenE3.code : null;
      eData.e3Analytics.forEach(c => {
        const isWinner = c.code === e3WinnerCode && c.votes > 0;
        eHtml += `
          <tr style="${isWinner ? 'background:#FFF1F2; font-weight:bold;' : ''}">
            <td>Elective III</td>
            <td>${c.code}</td>
            <td>${escapeHTML(c.title)}</td>
            <td>${c.votes}</td>
            <td>${c.percentage}%</td>
            <td>${isWinner ? '<span style="color:#9B1C2E;"><i class="fa-solid fa-trophy"></i> SELECTED (HIGHLY CHOSEN)</span>' : 'Alternative'}</td>
          </tr>
        `;
      });

      eHtml += '</tbody></table>';
      electiveContainer.innerHTML = eHtml;
    }
  } catch (err) {
    console.error('Error loading report tables:', err);
  }
}

// ==========================================
// 5. STAFF ADMIN DASHBOARD LOGIC
// ==========================================

function handleAdminLogin(e) {
  e.preventDefault();
  const pwdInput = document.getElementById('adminPasswordInput');
  const pwd = pwdInput.value;
  const feedback = document.getElementById('adminLoginFeedback');

  // Check password (data sorcerers)
  if (pwd.trim().toLowerCase() === 'data sorcerers') {
    adminUnlocked = true;
    document.getElementById('adminLockState').classList.add('d-none');
    document.getElementById('adminDashboardState').classList.remove('d-none');
    feedback.textContent = '';
    loadAdminData();
  } else {
    feedback.textContent = 'Incorrect staff password. Please try again.';
  }
}

function handleAdminLogout() {
  adminUnlocked = false;
  document.getElementById('adminLockState').classList.remove('d-none');
  document.getElementById('adminDashboardState').classList.add('d-none');
  document.getElementById('adminPasswordInput').value = '';
}

async function loadAdminData() {
  if (!adminUnlocked) return;

  try {
    const [resGuide, resElective] = await Promise.all([
      fetch('/api/guide/submissions'),
      fetch('/api/elective/submissions')
    ]);

    const gData = await resGuide.json();
    const eData = await resElective.json();

    // Render Faculty Config Cards (Strictly 5 Guides)
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
    document.getElementById('adminGuideCount').textContent = gData.submissions.length;
    if (gData.submissions.length > 0) {
      gTable.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Reg. No</th>
              <th>Student Name</th>
              <th>Slot</th>
              <th>Allocated Guide</th>
            </tr>
          </thead>
          <tbody>
            ${gData.submissions.map((s, i) => `
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
      gTable.innerHTML = `<p class="p-3 text-muted">No guide submissions yet.</p>`;
    }

    // Render Elective Submissions Table
    const eTable = document.getElementById('adminElectiveSubmissionsTable');
    document.getElementById('adminElectiveCount').textContent = eData.submissions.length;
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
    // Update Admin Live Status Banner
    const pill = document.getElementById('adminLivePill');
    const text = document.getElementById('adminLiveText');
    if (guideData && guideData.isLive) {
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

  } catch (err) {
    console.error('Error loading admin data:', err);
  }
}

async function saveGuideConfiguration(makeLive = false) {
  const pwd = document.getElementById('adminPasswordInput').value;
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
        maxStudents: parseInt(quotaEl.value, 10)
      });
    }
  }

  // Check if names are blank when trying to make live
  if (makeLive) {
    const hasBlank = updatedGuides.some(g => !g.name || g.name.trim().length === 0);
    if (hasBlank) {
      alert(`Please fill out all ${updatedGuides.length} Faculty Guide (Ma'am) names before activating Live Slots for students!`);
      return;
    }
  }

  try {
    const res = await fetch('/api/guide/admin/update-guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, guides: updatedGuides, isLive: makeLive ? true : undefined })
    });
    const result = await res.json();
    if (result.success) {
      alert(result.message || 'Faculty Guide details updated successfully!');
      loadGuideConfig();
      loadAdminData();
    } else {
      alert(result.error || 'Failed to update guide configuration.');
    }
  } catch (err) {
    alert('Network error while saving guide config.');
  }
}

async function activateGuideSlotsLive() {
  const pwd = document.getElementById('adminPasswordInput').value;
  const guideCount = (window.currentAdminGuides && window.currentAdminGuides.length) || 5;
  for (let i = 0; i < guideCount; i++) {
    const nameEl = document.getElementById(`facultyName_${i}`);
    if (!nameEl || !nameEl.value.trim()) {
      alert(`Cannot activate slots: Please enter Guide Faculty #${i + 1} (Ma'am) name first!`);
      if (nameEl) nameEl.focus();
      return;
    }
  }

  try {
    const res = await fetch('/api/guide/admin/toggle-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, isLive: true })
    });
    const result = await res.json();
    if (result.success) {
      alert('Guide selection slots are now LIVE for all students!');
      loadGuideConfig();
      loadAdminData();
    } else {
      alert(result.error || 'Failed to activate slots.');
    }
  } catch (err) {
    alert('Network error.');
  }
}

async function deactivateGuideSlotsLive() {
  const pwd = document.getElementById('adminPasswordInput').value;
  try {
    const res = await fetch('/api/guide/admin/toggle-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, isLive: false })
    });
    const result = await res.json();
    if (result.success) {
      alert('Guide selection slots are now LOCKED.');
      loadGuideConfig();
      loadAdminData();
    } else {
      alert(result.error || 'Failed to lock slots.');
    }
  } catch (err) {
    alert('Network error.');
  }
}

// 5-Page Report Photo Handlers
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

async function promptResetGuide() {
  if (!confirm('Are you sure you want to reset all Guide Submissions? This action cannot be undone.')) return;
  const pwd = document.getElementById('adminPasswordInput').value;

  try {
    const res = await fetch('/api/guide/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const result = await res.json();
    if (result.success) {
      alert('Guide submissions have been reset.');
      loadGuideConfig();
      loadAdminData();
    } else {
      alert(result.error || 'Reset failed.');
    }
  } catch (err) {
    alert('Error connecting to server.');
  }
}

async function promptResetElective() {
  if (!confirm('Are you sure you want to reset all Elective Submissions? This action cannot be undone.')) return;
  const pwd = document.getElementById('adminPasswordInput').value;

  try {
    const res = await fetch('/api/elective/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const result = await res.json();
    if (result.success) {
      alert('Elective submissions have been reset.');
      loadElectiveConfig();
      loadAdminData();
    } else {
      alert(result.error || 'Reset failed.');
    }
  } catch (err) {
    alert('Error connecting to server.');
  }
}

// ==========================================
// 6. MULTI-DEVICE & NETWORK MODAL
// ==========================================

async function loadNetworkInfo() {
  try {
    const res = await fetch('/api/system/network-info');
    const data = await res.json();
    if (data.success) {
      document.getElementById('networkUrlInput').value = data.networkUrl;
      document.getElementById('networkQrImage').src = data.qrCodeDataUrl;
    }
  } catch (err) {
    console.error('Failed to load network info:', err);
  }
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

// Helpers
document.getElementById('btnNetworkShare')?.addEventListener('click', openNetworkModal);
document.getElementById('btnAdminAccess')?.addEventListener('click', () => {
  switchTab('tab-admin');
});

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

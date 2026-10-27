const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } = require('docx');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Database helper
function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Database not found');
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database, creating default:', err);
    const defaultDB = {
      system: {
        institutionName: "Sankara College of Science and Commerce",
        department: "Department of Computer Science with Data Analytics",
        batch: "2024-2027",
        semester: "Semester VI",
        staffPassword: "data sorcerers",
        lastUpdated: new Date().toISOString()
      },
      guidePortal: {
        targetStudents: 41,
        slotCount: 8,
        lastSlotGuideMap: {},
        guides: [
          { id: "g1", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 9, assignedCount: 0 },
          { id: "g2", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
          { id: "g3", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
          { id: "g4", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 },
          { id: "g5", name: "", designation: "Assistant Professor, CS & DA", maxStudents: 8, assignedCount: 0 }
        ],
        submissions: []
      },
      electivePortal: {
        targetStudents: 43,
        elective2Options: [
          { code: "24BSD63E05", title: "5G & Future Network Technologies", option: "A" },
          { code: "24BSD63E06", title: "Predictive Analytics", option: "B" },
          { code: "24BSD63E07", title: "Software Engineering", option: "C" },
          { code: "24BSD63E08", title: "Market Analysis and Decision Making", option: "D" }
        ],
        elective3Options: [
          { code: "24BSD63E09", title: "Internet of Things", option: "A" },
          { code: "24BSD63E10", title: "Natural Language Processing", option: "B" },
          { code: "24BSD63E11", title: "Mobile Application Development", option: "C" },
          { code: "24BSD63E12", title: "Block Chain Technology", option: "D" }
        ],
        submissions: []
      }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2), 'utf-8');
    return defaultDB;
  }
}

function saveDB(data) {
  data.system.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Get LAN IPv4 address
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Network and system info API
app.get('/api/system/network-info', async (req, res) => {
  const ip = getLocalIP();
  const localUrl = `http://localhost:${PORT}`;
  const networkUrl = `http://${ip}:${PORT}`;
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(networkUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#002B49', light: '#FFFFFF' }
    });
    res.json({
      success: true,
      ip,
      port: PORT,
      localUrl,
      networkUrl,
      qrCodeDataUrl,
      institution: "Sankara College of Science and Commerce",
      department: "Department of Computer Science with Data Analytics"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 1. GUIDE SELECTION APIS
// ==========================================

// Get Guide Portal Configuration & Status
app.get('/api/guide/config', (req, res) => {
  const db = loadDB();
  const guidePortal = db.guidePortal;
  
  // Recalculate assigned counts to be 100% accurate
  guidePortal.guides.forEach(g => {
    g.assignedCount = guidePortal.submissions.filter(s => s.guideId === g.id).length;
  });
  
  const hasConfiguredNames = guidePortal.guides.length >= 5 && guidePortal.guides.every(g => g.name && g.name.trim().length > 0);

  res.json({
    success: true,
    isLive: !!guidePortal.isLive,
    hasConfiguredNames,
    targetStudents: guidePortal.targetStudents || 41,
    totalRegistered: guidePortal.submissions.length,
    slotCount: guidePortal.slotCount || 8
  });
});

// Student Submit Slot Choice (Dynamic Shuffling Engine with Confidential Secret Ballot)
app.post('/api/guide/submit', (req, res) => {
  let { regNo, studentName, slot } = req.body;
  if (!regNo || !studentName || !slot) {
    return res.status(400).json({ success: false, error: 'Register Number, Student Name and Slot are required.' });
  }

  regNo = regNo.trim().toUpperCase();
  studentName = studentName.trim();
  slot = parseInt(slot, 10);

  const db = loadDB();
  const guidePortal = db.guidePortal;

  // Enforce slots locked until faculty guide names are configured
  const hasConfiguredNames = guidePortal.guides.some(g => g.name && g.name.trim().length > 0);
  if (!guidePortal.isLive || !hasConfiguredNames) {
    return res.status(403).json({
      success: false,
      isLocked: true,
      error: 'Guide selection slots are currently locked. Slots will be activated once Faculty Guide names are officially announced and entered by Staff.'
    });
  }

  // Check if student already submitted (Confidential duplicate check)
  const existing = guidePortal.submissions.find(s => s.regNo.toUpperCase() === regNo);
  if (existing) {
    return res.status(409).json({
      success: false,
      isExisting: true,
      error: `Register Number ${regNo} (${existing.studentName}) has already cast their vote via Slot #${existing.slotChosen}!`,
      submission: {
        regNo: existing.regNo,
        studentName: existing.studentName,
        slotChosen: existing.slotChosen,
        timestamp: existing.timestamp
      }
    });
  }

  // Recount current assignments
  guidePortal.guides.forEach(g => {
    g.assignedCount = guidePortal.submissions.filter(s => s.guideId === g.id).length;
  });

  const totalRegistered = guidePortal.submissions.length;
  const targetStudents = guidePortal.targetStudents || 41;
  if (totalRegistered >= targetStudents) {
    return res.status(400).json({ success: false, error: 'All 41 student slots for the batch are fully allocated!' });
  }

  // STRICT 8-COUNT RULE:
  // For the first 40 students (5 guides x 8 students): each guide is strictly capped at 8.
  // Once a guide reaches 8 counts, that guide is terminated (no more students assigned to her).
  // For the final 41st student (when totalRegistered === 40): exactly one guide will accept the 9th student.
  let eligibleGuides;
  if (totalRegistered < 40) {
    eligibleGuides = guidePortal.guides.filter(g => g.assignedCount < 8);
  } else {
    // 41st student
    eligibleGuides = guidePortal.guides.filter(g => g.assignedCount < 9);
  }

  if (eligibleGuides.length === 0) {
    return res.status(400).json({ success: false, error: 'No guide capacity remaining.' });
  }

  // DYNAMIC SHUFFLE LOGIC (Anti-Collision Engine):
  // 1. If slot S was previously chosen and yielded guide X, the next student who chooses slot S
  //    MUST NEVER get guide X if other eligible guides exist!
  // 2. Also avoid assigning the same guide consecutively across any back-to-back student picks if alternatives exist.
  const lastGuideIdForSlot = guidePortal.lastSlotGuideMap ? guidePortal.lastSlotGuideMap[slot] : null;
  const lastOverallGuideId = guidePortal.lastAllocatedGuideId || null;
  
  let candidates = eligibleGuides;
  // Strict rule: if the same slot was clicked previously, strip out that guide
  if (lastGuideIdForSlot && candidates.length > 1) {
    const alternativeCandidates = candidates.filter(g => g.id !== lastGuideIdForSlot);
    if (alternativeCandidates.length > 0) {
      candidates = alternativeCandidates;
    }
  }

  // Also avoid immediate consecutive guide assignment across all slots if multiple candidates remain
  if (lastOverallGuideId && candidates.length > 1) {
    const alternativeCandidates = candidates.filter(g => g.id !== lastOverallGuideId);
    if (alternativeCandidates.length > 0) {
      candidates = alternativeCandidates;
    }
  }

  // Dynamic pseudo-random selection with uniform shuffle among candidates
  const chosenIndex = Math.floor(Math.random() * candidates.length);
  const selectedGuide = candidates[chosenIndex];

  // Update tracking maps
  if (!guidePortal.lastSlotGuideMap) guidePortal.lastSlotGuideMap = {};
  guidePortal.lastSlotGuideMap[slot] = selectedGuide.id;
  guidePortal.lastAllocatedGuideId = selectedGuide.id;

  // Create submission record (Persisted safely in backend DB)
  const submissionRecord = {
    id: 'GS-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    regNo,
    studentName,
    slotChosen: slot,
    guideId: selectedGuide.id,
    guideName: selectedGuide.name,
    timestamp: new Date().toISOString()
  };

  guidePortal.submissions.push(submissionRecord);
  saveDB(db);

  // CONFIDENTIAL BALLOT RESPONSE:
  // Strictly do NOT reveal guide name on the student's screen!
  res.json({
    success: true,
    isSecretBallot: true,
    message: 'Slot selection successfully recorded! The official guide allotment list will be announced by the department after all students vote.',
    submission: {
      regNo,
      studentName,
      slotChosen: slot,
      timestamp: submissionRecord.timestamp
    }
  });
});

// Staff/Admin get all Guide Submissions
app.get('/api/guide/submissions', (req, res) => {
  const db = loadDB();
  const guidePortal = db.guidePortal;
  
  // Group by guide
  const guideGroups = guidePortal.guides.map(g => {
    const students = guidePortal.submissions
      .filter(s => s.guideId === g.id)
      .map(s => ({
        regNo: s.regNo,
        studentName: s.studentName,
        slotChosen: s.slotChosen,
        timestamp: s.timestamp
      }));
    return {
      guideId: g.id,
      guideName: g.name,
      designation: g.designation,
      maxStudents: g.maxStudents,
      assignedCount: students.length,
      students
    };
  });

  res.json({
    success: true,
    totalTarget: guidePortal.targetStudents,
    totalSubmissions: guidePortal.submissions.length,
    submissions: guidePortal.submissions,
    guideGroups
  });
});

// Admin Update Guide Faculty Names and Capacities (Password Protected)
app.post('/api/guide/admin/update-guides', (req, res) => {
  const { password, guides, slotCount, targetStudents } = req.body;
  const db = loadDB();
  
  if (password !== db.system.staffPassword) {
    return res.status(401).json({ success: false, error: 'Invalid staff password.' });
  }

  if (Array.isArray(guides)) {
    guides.forEach((g, idx) => {
      if (!db.guidePortal.guides[idx]) {
        db.guidePortal.guides[idx] = {
          id: `g${idx + 1}`,
          name: '',
          designation: 'Assistant Professor, CS & DA',
          maxStudents: 8,
          assignedCount: 0
        };
      }
      if (g.name !== undefined) db.guidePortal.guides[idx].name = g.name.trim();
      if (g.designation !== undefined) db.guidePortal.guides[idx].designation = g.designation.trim();
      if (g.maxStudents !== undefined) db.guidePortal.guides[idx].maxStudents = parseInt(g.maxStudents, 10);
    });

    // Update names in existing submissions as well so exports stay consistent
    db.guidePortal.submissions.forEach(sub => {
      const match = db.guidePortal.guides.find(g => g.id === sub.guideId);
      if (match) {
        sub.guideName = match.name;
      }
    });
  }

  if (slotCount) db.guidePortal.slotCount = parseInt(slotCount, 10);
  if (targetStudents) db.guidePortal.targetStudents = parseInt(targetStudents, 10);
  
  // If isLive is explicitly passed or if faculty names are provided, update live status
  if (req.body.isLive !== undefined) {
    db.guidePortal.isLive = !!req.body.isLive;
  } else {
    const hasNames = db.guidePortal.guides.every(g => g.name && g.name.trim().length > 0);
    if (hasNames) {
      db.guidePortal.isLive = true;
    }
  }

  saveDB(db);
  res.json({ 
    success: true, 
    isLive: db.guidePortal.isLive,
    message: db.guidePortal.isLive 
      ? 'Faculty Guide details saved and slots are now LIVE for students!' 
      : 'Faculty Guide details saved.' 
  });
});

// Admin Toggle Slots Live / Locked
app.post('/api/guide/admin/toggle-live', (req, res) => {
  const { password, isLive } = req.body;
  const db = loadDB();
  
  if (password !== db.system.staffPassword) {
    return res.status(401).json({ success: false, error: 'Invalid staff password.' });
  }

  db.guidePortal.isLive = !!isLive;
  saveDB(db);
  res.json({ 
    success: true, 
    isLive: db.guidePortal.isLive,
    message: `Slots are now ${db.guidePortal.isLive ? 'LIVE' : 'LOCKED'}` 
  });
});

// Admin Reset Guide Submissions (Password Protected)
app.post('/api/guide/admin/reset', (req, res) => {
  const { password } = req.body;
  const db = loadDB();
  
  if (password !== db.system.staffPassword) {
    return res.status(401).json({ success: false, error: 'Invalid staff password.' });
  }

  db.guidePortal.submissions = [];
  db.guidePortal.lastSlotGuideMap = {};
  db.guidePortal.guides.forEach(g => g.assignedCount = 0);

  saveDB(db);
  res.json({ success: true, message: 'Guide submissions reset successfully.' });
});

// Guide Excel Export
app.get('/api/guide/export/excel', (req, res) => {
  const db = loadDB();
  const guidePortal = db.guidePortal;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Master Allocation List
  const masterData = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE"],
    ["Department of Computer Science with Data Analytics"],
    ["Batch 2024-2027 | Semester VI - Project Guide Selection Master List"],
    ["Generated on: " + new Date().toLocaleString()],
    [],
    ["S.No", "Register Number", "Student Name", "Slot Chosen", "Allocated Project Guide", "Selection Date & Time"]
  ];

  guidePortal.submissions.forEach((s, idx) => {
    masterData.push([
      idx + 1,
      s.regNo,
      s.studentName,
      "Slot " + s.slotChosen,
      s.guideName,
      new Date(s.timestamp).toLocaleString()
    ]);
  });

  const wsMaster = XLSX.utils.aoa_to_sheet(masterData);
  wsMaster['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 30 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMaster, "Master Allocation");

  // Sheet 2: Guide-wise Grouping
  const guideWiseData = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE"],
    ["Department of Computer Science with Data Analytics - Guide-wise Student Allocation"],
    []
  ];

  guidePortal.guides.forEach(g => {
    const students = guidePortal.submissions.filter(s => s.guideId === g.id);
    guideWiseData.push([`GUIDE: ${g.name.toUpperCase()} (${g.designation})`, `Total Students: ${students.length} / ${g.maxStudents}`]);
    guideWiseData.push(["S.No", "Register Number", "Student Name", "Slot Chosen", "Allocated Guide"]);
    if (students.length === 0) {
      guideWiseData.push(["-", "No students allocated yet", "-", "-", "-"]);
    } else {
      students.forEach((st, idx) => {
        guideWiseData.push([idx + 1, st.regNo, st.studentName, "Slot " + st.slotChosen, g.name]);
      });
    }
    guideWiseData.push([]); // blank row
  });

  const wsGuideWise = XLSX.utils.aoa_to_sheet(guideWiseData);
  wsGuideWise['!cols'] = [
    { wch: 8 },
    { wch: 20 },
    { wch: 30 },
    { wch: 14 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsGuideWise, "Guide-wise Summary");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="Project_Guide_Selection_2024_2027.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// ==========================================
// 2. ELECTIVE COURSE SELECTION APIS
// ==========================================

// Get Elective Portal Config & Analytics
app.get('/api/elective/config', (req, res) => {
  const db = loadDB();
  const electivePortal = db.electivePortal;

  // Compute popularity metrics
  const e2Counts = {};
  electivePortal.elective2Options.forEach(opt => e2Counts[opt.code] = 0);
  const e3Counts = {};
  electivePortal.elective3Options.forEach(opt => e3Counts[opt.code] = 0);

  electivePortal.submissions.forEach(s => {
    if (e2Counts[s.elective2Code] !== undefined) e2Counts[s.elective2Code]++;
    if (e3Counts[s.elective3Code] !== undefined) e3Counts[s.elective3Code]++;
  });

  const total = electivePortal.submissions.length;

  const e2Analytics = electivePortal.elective2Options.map(opt => ({
    ...opt,
    votes: e2Counts[opt.code] || 0,
    percentage: total > 0 ? Math.round(((e2Counts[opt.code] || 0) / total) * 100) : 0
  })).sort((a, b) => b.votes - a.votes);

  const e3Analytics = electivePortal.elective3Options.map(opt => ({
    ...opt,
    votes: e3Counts[opt.code] || 0,
    percentage: total > 0 ? Math.round(((e3Counts[opt.code] || 0) / total) * 100) : 0
  })).sort((a, b) => b.votes - a.votes);

  const highestChosenE2 = e2Analytics.length > 0 && e2Analytics[0].votes > 0 ? e2Analytics[0] : null;
  const highestChosenE3 = e3Analytics.length > 0 && e3Analytics[0].votes > 0 ? e3Analytics[0] : null;

  res.json({
    success: true,
    targetStudents: electivePortal.targetStudents,
    totalRegistered: total,
    elective2Options: electivePortal.elective2Options,
    elective3Options: electivePortal.elective3Options,
    e2Analytics,
    e3Analytics,
    highestChosenE2,
    highestChosenE3
  });
});

// Student Submit Elective Choice
app.post('/api/elective/submit', (req, res) => {
  let { regNo, studentName, elective2Code, elective3Code } = req.body;
  if (!regNo || !studentName || !elective2Code || !elective3Code) {
    return res.status(400).json({ success: false, error: 'Register Number, Student Name, Elective II and Elective III selections are required.' });
  }

  regNo = regNo.trim().toUpperCase();
  studentName = studentName.trim();

  const db = loadDB();
  const electivePortal = db.electivePortal;

  // Prevent duplicate registration
  const existing = electivePortal.submissions.find(s => s.regNo.toUpperCase() === regNo);
  if (existing) {
    return res.status(409).json({
      success: false,
      isExisting: true,
      error: `Register Number ${regNo} has already submitted elective selections!`,
      submission: existing
    });
  }

  const opt2 = electivePortal.elective2Options.find(o => o.code === elective2Code);
  const opt3 = electivePortal.elective3Options.find(o => o.code === elective3Code);

  if (!opt2 || !opt3) {
    return res.status(400).json({ success: false, error: 'Invalid elective course choice.' });
  }

  const submissionRecord = {
    id: 'EL-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    regNo,
    studentName,
    elective2Code: opt2.code,
    elective2Title: opt2.title,
    elective2Option: opt2.option,
    elective3Code: opt3.code,
    elective3Title: opt3.title,
    elective3Option: opt3.option,
    timestamp: new Date().toISOString()
  };

  electivePortal.submissions.push(submissionRecord);
  saveDB(db);

  res.json({
    success: true,
    message: 'Elective course selection saved successfully!',
    submission: submissionRecord
  });
});

// Admin get all Elective Submissions & Breakdown
app.get('/api/elective/submissions', (req, res) => {
  const db = loadDB();
  res.json({
    success: true,
    totalTarget: db.electivePortal.targetStudents,
    totalSubmissions: db.electivePortal.submissions.length,
    submissions: db.electivePortal.submissions
  });
});

// Admin Reset Elective Submissions (Password Protected)
app.post('/api/elective/admin/reset', (req, res) => {
  const { password } = req.body;
  const db = loadDB();
  
  if (password !== db.system.staffPassword) {
    return res.status(401).json({ success: false, error: 'Invalid staff password.' });
  }

  db.electivePortal.submissions = [];
  saveDB(db);
  res.json({ success: true, message: 'Elective submissions reset successfully.' });
});

// Elective Excel Export
app.get('/api/elective/export/excel', (req, res) => {
  const db = loadDB();
  const electivePortal = db.electivePortal;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Student Selections
  const studentData = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE"],
    ["Department of Computer Science with Data Analytics"],
    ["Batch 2024-2027 | Semester VI - Elective Course Selection Master List"],
    ["Generated on: " + new Date().toLocaleString()],
    [],
    ["S.No", "Register Number", "Student Name", "Elective II Code", "Elective II Course Title", "Elective III Code", "Elective III Course Title", "Submission Time"]
  ];

  electivePortal.submissions.forEach((s, idx) => {
    studentData.push([
      idx + 1,
      s.regNo,
      s.studentName,
      s.elective2Code,
      s.elective2Title,
      s.elective3Code,
      s.elective3Title,
      new Date(s.timestamp).toLocaleString()
    ]);
  });

  const wsStudents = XLSX.utils.aoa_to_sheet(studentData);
  wsStudents['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 36 },
    { wch: 16 },
    { wch: 36 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, wsStudents, "Student Selections");

  // Sheet 2: Course Popularity & Selection Result
  const total = electivePortal.submissions.length;
  const analyticsData = [
    ["SANKARA COLLEGE OF SCIENCE AND COMMERCE"],
    ["Department of Computer Science with Data Analytics - Elective Selection Analytics & Highly Chosen Summary"],
    ["Total Submissions: " + total + " / " + electivePortal.targetStudents],
    [],
    ["ELECTIVE II ANALYSIS"],
    ["Option", "Course Code", "Course Title", "Total Student Votes", "Vote Share %", "Status"]
  ];

  // Count E2
  const e2Counts = {};
  electivePortal.elective2Options.forEach(opt => e2Counts[opt.code] = 0);
  electivePortal.submissions.forEach(s => {
    if (e2Counts[s.elective2Code] !== undefined) e2Counts[s.elective2Code]++;
  });

  const sortedE2 = [...electivePortal.elective2Options].sort((a, b) => e2Counts[b.code] - e2Counts[a.code]);
  const maxE2Votes = sortedE2.length > 0 ? e2Counts[sortedE2[0].code] : 0;

  sortedE2.forEach(opt => {
    const count = e2Counts[opt.code] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const isWinner = count > 0 && count === maxE2Votes;
    analyticsData.push([
      opt.option,
      opt.code,
      opt.title,
      count,
      pct + "%",
      isWinner ? "SELECTED (HIGHLY CHOSEN)" : "Alternative"
    ]);
  });

  analyticsData.push([]);
  analyticsData.push(["ELECTIVE III ANALYSIS"]);
  analyticsData.push(["Option", "Course Code", "Course Title", "Total Student Votes", "Vote Share %", "Status"]);

  // Count E3
  const e3Counts = {};
  electivePortal.elective3Options.forEach(opt => e3Counts[opt.code] = 0);
  electivePortal.submissions.forEach(s => {
    if (e3Counts[s.elective3Code] !== undefined) e3Counts[s.elective3Code]++;
  });

  const sortedE3 = [...electivePortal.elective3Options].sort((a, b) => e3Counts[b.code] - e3Counts[a.code]);
  const maxE3Votes = sortedE3.length > 0 ? e3Counts[sortedE3[0].code] : 0;

  sortedE3.forEach(opt => {
    const count = e3Counts[opt.code] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const isWinner = count > 0 && count === maxE3Votes;
    analyticsData.push([
      opt.option,
      opt.code,
      opt.title,
      count,
      pct + "%",
      isWinner ? "SELECTED (HIGHLY CHOSEN)" : "Alternative"
    ]);
  });

  const wsAnalytics = XLSX.utils.aoa_to_sheet(analyticsData);
  wsAnalytics['!cols'] = [
    { wch: 10 },
    { wch: 18 },
    { wch: 40 },
    { wch: 20 },
    { wch: 14 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsAnalytics, "Popularity & Selection Result");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="Elective_Course_Selection_2024_2027.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Elective Word Document (.docx) Export
app.get('/api/elective/export/word', async (req, res) => {
  const db = loadDB();
  const electivePortal = db.electivePortal;
  const total = electivePortal.submissions.length;

  // Calculate vote leaders
  const e2Counts = {};
  electivePortal.elective2Options.forEach(opt => e2Counts[opt.code] = 0);
  const e3Counts = {};
  electivePortal.elective3Options.forEach(opt => e3Counts[opt.code] = 0);

  electivePortal.submissions.forEach(s => {
    if (e2Counts[s.elective2Code] !== undefined) e2Counts[s.elective2Code]++;
    if (e3Counts[s.elective3Code] !== undefined) e3Counts[s.elective3Code]++;
  });

  const sortedE2 = [...electivePortal.elective2Options].sort((a, b) => e2Counts[b.code] - e2Counts[a.code]);
  const sortedE3 = [...electivePortal.elective3Options].sort((a, b) => e3Counts[b.code] - e3Counts[a.code]);

  const topE2 = sortedE2[0];
  const topE3 = sortedE3[0];

  const tableHeaderCell = (text, widthPct = 20) => new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF" })]
    })],
    shading: { fill: "002B49" }
  });

  const tableDataCell = (text, align = AlignmentType.LEFT, bold = false) => new TableCell({
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: String(text || '-'), bold })]
    })]
  });

  // Table of students
  const studentRows = [
    new TableRow({
      children: [
        tableHeaderCell("S.No", 8),
        tableHeaderCell("Reg. Number", 20),
        tableHeaderCell("Student Name", 28),
        tableHeaderCell("Elective II", 22),
        tableHeaderCell("Elective III", 22)
      ]
    })
  ];

  electivePortal.submissions.forEach((s, idx) => {
    studentRows.push(
      new TableRow({
        children: [
          tableDataCell(idx + 1, AlignmentType.CENTER),
          tableDataCell(s.regNo, AlignmentType.CENTER, true),
          tableDataCell(s.studentName),
          tableDataCell(s.elective2Title),
          tableDataCell(s.elective3Title)
        ]
      })
    );
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "SANKARA COLLEGE OF SCIENCE AND COMMERCE", bold: true, size: 28, color: "002B49" })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Department of Computer Science with Data Analytics", bold: true, size: 24, color: "A6192E" })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Batch 2024 - 2027 | Semester VI - Elective Course Selection Report", italics: true, size: 20 })
          ]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: "Official Resolution & Highly Chosen Courses Summary", bold: true, size: 22 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Based on the student voting conducted through the portal with a total participation of " }),
            new TextRun({ text: `${total} out of ${electivePortal.targetStudents} students`, bold: true }),
            new TextRun({ text: ", the majority choices for Semester VI electives are resolved as below:" })
          ]
        }),
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({ text: "Elective II Selected (Highest Votes): ", bold: true }),
            new TextRun({ text: topE2 ? `${topE2.title} (${topE2.code}) - ${e2Counts[topE2.code] || 0} Votes` : "Pending votes", color: "002B49", bold: true })
          ]
        }),
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({ text: "Elective III Selected (Highest Votes): ", bold: true }),
            new TextRun({ text: topE3 ? `${topE3.title} (${topE3.code}) - ${e3Counts[topE3.code] || 0} Votes` : "Pending votes", color: "002B49", bold: true })
          ]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: "Detailed Student Selection Roster", bold: true, size: 22 })
          ]
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: studentRows
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: "Staff Coordinator              Class Tutor               Head of Department               Principal", bold: true })
          ]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Disposition', 'attachment; filename="Elective_Course_Selection_Report.docx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.send(buffer);
});

// Backup & Restore API
app.get('/api/system/backup', (req, res) => {
  const db = loadDB();
  res.setHeader('Content-Disposition', 'attachment; filename="selection_portal_backup.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(db, null, 2));
});

app.post('/api/system/restore', (req, res) => {
  const { password, data } = req.body;
  const db = loadDB();
  if (password !== db.system.staffPassword) {
    return res.status(401).json({ success: false, error: 'Invalid staff password.' });
  }
  if (!data || !data.guidePortal || !data.electivePortal) {
    return res.status(400).json({ success: false, error: 'Invalid backup file structure.' });
  }
  saveDB(data);
  res.json({ success: true, message: 'System state restored successfully!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`Sankara College Selection Portal Suite is running!`);
  console.log(`Local Access:   http://localhost:${PORT}`);
  console.log(`Network Access: http://${getLocalIP()}:${PORT}`);
  console.log(`Staff Password: data sorcerers`);
  console.log(`====================================================`);
});

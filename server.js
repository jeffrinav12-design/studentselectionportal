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
const SEED_DB_PATH = path.join(__dirname, 'data', 'database.json');
const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'database.json')
  : SEED_DB_PATH;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder exists locally
if (!process.env.VERCEL && !fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

let inMemoryDB = null;

// Database helper with memory caching for fast serverless execution
function loadDB() {
  if (inMemoryDB) {
    return inMemoryDB;
  }
  try {
    if (!fs.existsSync(DB_PATH)) {
      if (fs.existsSync(SEED_DB_PATH)) {
        const seedData = fs.readFileSync(SEED_DB_PATH, 'utf-8');
        try { fs.writeFileSync(DB_PATH, seedData, 'utf-8'); } catch(e){}
        inMemoryDB = JSON.parse(seedData);
        return inMemoryDB;
      }
      throw new Error('Database seed not found');
    }
    let data = fs.readFileSync(DB_PATH, 'utf-8');
    if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
    inMemoryDB = JSON.parse(data);
    return inMemoryDB;
  } catch (err) {
    console.error('Error reading database, creating default:', err);
    const defaultDB = {
      system: {
        institutionName: "Sankara College of Science and Commerce (Autonomous)",
        department: "Department of Computer Science with Data Analytics",
        batch: "2024-2027",
        semester: "Semester VI",
        staffPassword: "data sorcerers",
        lastUpdated: new Date().toISOString()
      },
      guidePortal: {
        isLive: true,
        targetStudents: 41,
        slotCount: 8,
        ninthGuideId: "g1",
        lastSlotGuideMap: {},
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
    try { fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2), 'utf-8'); } catch(e){}
    inMemoryDB = defaultDB;
    return defaultDB;
  }
}

function saveDB(data) {
  inMemoryDB = data;
  data.system.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    // In serverless read-only instances, memory state is preserved
  }
}


const CLOUD_VAULT_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a187d424854e76';

function mergeCloudData(cloudData) {
  if (!cloudData) return;
  const db = loadDB();

  // If local DB is strictly newer than cloudData, don't overwrite local changes that haven't propagated
  if (cloudData.lastUpdated && db.system.lastUpdated) {
    const cloudTime = new Date(cloudData.lastUpdated).getTime();
    const localTime = new Date(db.system.lastUpdated).getTime();
    if (localTime > cloudTime + 500) {
      return;
    }
  }

  let changed = false;

  if (Array.isArray(cloudData.guides) && cloudData.guides.length >= 5) {
    cloudData.guides.forEach((cg, i) => {
      if (db.guidePortal.guides[i] && cg.name) {
        if (db.guidePortal.guides[i].name !== cg.name || db.guidePortal.guides[i].maxStudents !== cg.maxStudents) {
          db.guidePortal.guides[i].name = cg.name;
          db.guidePortal.guides[i].designation = cg.designation || db.guidePortal.guides[i].designation;
          db.guidePortal.guides[i].maxStudents = cg.maxStudents || db.guidePortal.guides[i].maxStudents;
          changed = true;
        }
      }
    });
  }

  if (typeof cloudData.isLive === 'boolean' && db.guidePortal.isLive !== cloudData.isLive) {
    db.guidePortal.isLive = cloudData.isLive;
    changed = true;
  }

  if (Array.isArray(cloudData.guideSubmissions)) {
    db.guidePortal.submissions = cloudData.guideSubmissions;
    changed = true;
  }

  if (Array.isArray(cloudData.electiveSubmissions)) {
    db.electivePortal.submissions = cloudData.electiveSubmissions;
    changed = true;
  }

  db.guidePortal.guides.forEach(g => {
    g.assignedCount = db.guidePortal.submissions.filter(s => s.guideId === g.id).length;
  });

  if (changed) {
    if (cloudData.lastUpdated) {
      db.system.lastUpdated = cloudData.lastUpdated;
    }
    saveDB(db);
  }
}

async function syncFromCloudVault() {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const req = https.get(CLOUD_VAULT_URL, { timeout: 3000 }, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(b);
              if (parsed && parsed.data) {
                mergeCloudData(parsed.data);
              }
            }
          } catch(e) {}
          resolve();
        });
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
    } catch(e) { resolve(); }
  });
}

async function syncToCloudVault(db) {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const payload = JSON.stringify({
        name: 'scsc_portal_live_vault',
        data: {
          guides: db.guidePortal.guides,
          isLive: db.guidePortal.isLive,
          ninthGuideId: db.guidePortal.ninthGuideId,
          guideSubmissions: db.guidePortal.submissions,
          electiveSubmissions: db.electivePortal.submissions,
          lastUpdated: new Date().toISOString()
        }
      });
      const u = new URL(CLOUD_VAULT_URL);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname,
        method: 'PUT',
        timeout: 3000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.write(payload);
      req.end();
    } catch(e) { resolve(); }
  });
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
app.get('/api/guide/config', async (req, res) => {
  await syncFromCloudVault();
  const db = loadDB();
  const guidePortal = db.guidePortal;
  
  // Recalculate assigned counts to be 100% accurate
  guidePortal.guides.forEach(g => {
    g.assignedCount = guidePortal.submissions.filter(s => s.guideId === g.id).length;
  });
  
  const hasConfiguredNames = guidePortal.guides.length >= 5 && guidePortal.guides.every(g => g.name && g.name.trim().length > 0);

  res.json({
    success: true,
    isLive: guidePortal.isLive !== false,
    hasConfiguredNames,
    targetStudents: guidePortal.targetStudents || 41,
    totalRegistered: guidePortal.submissions.length,
    slotCount: guidePortal.slotCount || 8,
    guides: guidePortal.guides
  });
});

// Staff/Admin Update Faculty Guide Configuration (Names, Designations, Quotas, Status)
app.post('/api/guide/config', async (req, res) => {
  await syncFromCloudVault();
  const db = loadDB();
  const { guides, ninthGuideId, isLive } = req.body;
  if (Array.isArray(guides) && guides.length >= 5) {
    guides.forEach((g, idx) => {
      if (db.guidePortal.guides[idx]) {
        db.guidePortal.guides[idx].name = g.name !== undefined ? g.name.trim() : db.guidePortal.guides[idx].name;
        db.guidePortal.guides[idx].designation = g.designation !== undefined ? g.designation.trim() : db.guidePortal.guides[idx].designation;
        if (g.maxStudents) {
          db.guidePortal.guides[idx].maxStudents = parseInt(g.maxStudents, 10);
        }
      }
    });
  }
  if (typeof isLive === 'boolean') {
    db.guidePortal.isLive = isLive;
  }
  if (ninthGuideId) {
    db.guidePortal.ninthGuideId = ninthGuideId;
  }
  saveDB(db);
  await syncToCloudVault(db);
  res.json({
    success: true,
    message: 'Faculty Guide configuration updated successfully and synced live!',
    guides: db.guidePortal.guides,
    isLive: db.guidePortal.isLive
  });
});

// Staff/Admin Reset Guide Submissions
// Staff/Admin Reset Single Specific Student Allocation
app.post('/api/guide/submissions/delete', async (req, res) => {
  let { regNo } = req.body;
  if (!regNo) return res.status(400).json({ success: false, error: 'Register Number is required' });
  regNo = regNo.trim().toUpperCase();

  await syncFromCloudVault();
  const db = loadDB();

  const initialCount = db.guidePortal.submissions.length;
  const deletedSub = db.guidePortal.submissions.find(s => s.regNo.toUpperCase() === regNo);
  db.guidePortal.submissions = db.guidePortal.submissions.filter(s => s.regNo.toUpperCase() !== regNo);

  if (db.guidePortal.submissions.length < initialCount) {
    // Recalculate assigned counts
    db.guidePortal.guides.forEach(g => {
      g.assignedCount = db.guidePortal.submissions.filter(s => s.guideId === g.id).length;
    });
    // Remove from slot history
    if (deletedSub && db.guidePortal.slotHistory && db.guidePortal.slotHistory[deletedSub.slotChosen]) {
      db.guidePortal.slotHistory[deletedSub.slotChosen] = db.guidePortal.slotHistory[deletedSub.slotChosen].filter(id => id !== deletedSub.guideId);
    }
    saveDB(db);
    await syncToCloudVault(db);
    return res.json({
      success: true,
      message: `Successfully reset allocation for student with Register Number ${regNo}. That student can now select again.`,
      submissions: db.guidePortal.submissions,
      guides: db.guidePortal.guides
    });
  } else {
    return res.status(404).json({ success: false, error: `Student with Register Number ${regNo} not found.` });
  }
});

app.post('/api/guide/reset', async (req, res) => {
  const db = loadDB();
  db.guidePortal.submissions = [];
  db.guidePortal.slotHistory = {};
  db.guidePortal.lastSlotGuideMap = {};
  db.guidePortal.lastAllocatedGuideId = null;
  db.guidePortal.guides.forEach(g => g.assignedCount = 0);
  saveDB(db);
  await syncToCloudVault(db);
  res.json({ success: true, message: 'All Project Guide submissions have been reset.' });
});

// Staff/Admin Reset Elective Submissions
app.post('/api/elective/reset', async (req, res) => {
  const db = loadDB();
  db.electivePortal.submissions = [];
  saveDB(db);
  await syncToCloudVault(db);
  res.json({ success: true, message: 'All Elective submissions have been reset.' });
});

// Student Submit Slot Choice (Dynamic Shuffling Engine with Confidential Secret Ballot)
app.post('/api/guide/submit', async (req, res) => {
  await syncFromCloudVault();
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

  // STRICT 8-COUNT TERMINATION & SINGLE 9-STUDENT GUIDE QUOTA RULE:
  // - 5 Guide Faculty in total.
  // - Exactly 4 guides have a strict cap of 8 students.
  // - Exactly 1 guide alone is designated for 9 allocations (8 * 4 + 9 = 41).
  // - Once a guide reaches 8 allocations, that guide is automatically terminated from receiving more students.
  // - When totalRegistered reaches 40 (the 41st student), only the single designated guide can accept the 9th student.
  const ninthGuideId = guidePortal.ninthGuideId || (guidePortal.guides[0] ? guidePortal.guides[0].id : 'g1');

  let eligibleGuides;
  if (totalRegistered < 40) {
    // For first 40 students: all guides terminated at 8
    eligibleGuides = guidePortal.guides.filter(g => (g.assignedCount || 0) < 8);
  } else {
    // For the 41st student: only the single designated guide receives the 9th student
    eligibleGuides = guidePortal.guides.filter(g => g.id === ninthGuideId && (g.assignedCount || 0) < 9);
    if (eligibleGuides.length === 0) {
      eligibleGuides = guidePortal.guides.filter(g => (g.assignedCount || 0) < 9);
    }
  }

  if (eligibleGuides.length === 0) {
    return res.status(400).json({ success: false, error: 'No guide capacity remaining.' });
  }

  // DYNAMIC ROTATION & ANTI-COLLISION LOGIC:
  // If slot 1 is clicked by 3 students, all 3 MUST receive different guide allocations!
  // We maintain a history of recently assigned guides for this slot.
  guidePortal.slotHistory = guidePortal.slotHistory || {};
  const recentGuidesForSlot = guidePortal.slotHistory[slot] || [];
  const lastOverallGuideId = guidePortal.lastAllocatedGuideId || null;

  let candidates = eligibleGuides;

  // Filter out recent guides for this slot so repeated clicks rotate through distinct guides
  if (recentGuidesForSlot.length > 0 && candidates.length > 1) {
    const nonRecent = candidates.filter(g => !recentGuidesForSlot.includes(g.id));
    if (nonRecent.length > 0) {
      candidates = nonRecent;
    } else {
      // If all candidates appear in history, exclude at least the most recent one
      const mostRecentId = recentGuidesForSlot[recentGuidesForSlot.length - 1];
      const withoutMostRecent = candidates.filter(g => g.id !== mostRecentId);
      if (withoutMostRecent.length > 0) {
        candidates = withoutMostRecent;
      }
    }
  }

  // Also prevent consecutive identical guide allocation across any two back-to-back student picks
  if (lastOverallGuideId && candidates.length > 1) {
    const alternativeCandidates = candidates.filter(g => g.id !== lastOverallGuideId);
    if (alternativeCandidates.length > 0) {
      candidates = alternativeCandidates;
    }
  }

  // Dynamic pseudo-random selection with uniform shuffle among candidates
  const chosenIndex = Math.floor(Math.random() * candidates.length);
  const selectedGuide = candidates[chosenIndex];

  // Update tracking maps & slot history (keep last 3 to guarantee at least 3 distinct guides on repeated clicks)
  if (!guidePortal.lastSlotGuideMap) guidePortal.lastSlotGuideMap = {};
  guidePortal.lastSlotGuideMap[slot] = selectedGuide.id;
  guidePortal.lastAllocatedGuideId = selectedGuide.id;

  if (!guidePortal.slotHistory[slot]) guidePortal.slotHistory[slot] = [];
  guidePortal.slotHistory[slot].push(selectedGuide.id);
  if (guidePortal.slotHistory[slot].length > 4) {
    guidePortal.slotHistory[slot].shift();
  }

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
  await syncToCloudVault(db);

  // CONFIDENTIAL SECRET BALLOT RESPONSE:
  // Zero Information Leakage: Strictly do NOT reveal guide name on student screen!
  // Guide is securely assigned behind the scenes and visible only in Staff/Admin Portal.
  res.json({
    success: true,
    isSecretBallot: true,
    message: 'Slot selection successfully recorded! Impartial assignment preserved in departmental vault.',
    submission: {
      regNo: submissionRecord.regNo,
      studentName: submissionRecord.studentName,
      slotChosen: submissionRecord.slotChosen,
      timestamp: submissionRecord.timestamp
    }
  });
});

// Staff/Admin get all Guide Submissions
app.get('/api/guide/submissions', async (req, res) => {
  await syncFromCloudVault();
  const db = loadDB();
  const guidePortal = db.guidePortal;
  
  // Recalculate assignedCount for accuracy
  guidePortal.guides.forEach(g => {
    g.assignedCount = guidePortal.submissions.filter(s => s.guideId === g.id).length;
  });

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
    guides: guidePortal.guides,
    guideGroups
  });
});

// Bi-directional state synchronization across distributed devices & Vercel lambdas
app.post('/api/sync', async (req, res) => {
  await syncFromCloudVault();
  const db = loadDB();
  db.guidePortal.guides.forEach(g => {
    g.assignedCount = db.guidePortal.submissions.filter(s => s.guideId === g.id).length;
  });

  res.json({
    success: true,
    guidePortal: {
      isLive: db.guidePortal.isLive,
      targetStudents: db.guidePortal.targetStudents,
      submissions: db.guidePortal.submissions,
      guides: db.guidePortal.guides
    },
    electivePortal: {
      targetStudents: db.electivePortal.targetStudents,
      submissions: db.electivePortal.submissions
    }
  });
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
  XLSX.utils.book_append_sheet(wb, wsAnalytics, "Selection Resolution Analytics");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
  res.setHeader('Content-Disposition', 'attachment; filename="SCSC_Elective_Course_Selections_2024_2027.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
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
            new TextRun({ text: "CLASS TUTOR                           HEAD OF DEPARTMENT (HOD)                           PRINCIPAL", bold: true })
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

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`Sankara College Selection Portal Suite is running!`);
    console.log(`Local Access:   http://localhost:${PORT}`);
    console.log(`Network Access: http://${getLocalIP()}:${PORT}`);
    console.log(`Staff Password: data sorcerers`);
    console.log(`====================================================`);
  });
}

module.exports = app;

// Global state
let currentTheme = 'dark';
let currentExam = null;
let activeQuestions = [];
let userAnswers = {};
let markedQuestions = {};
let currentIndex = 1;
let isReviewMode = false;
let examHistory = [];
let examInterval = null;
let cheatInterval = null;
let secondsLeft = 3600;
let cheatSecondsLeft = 5;
let isExamActive = false;
let lastTabBeforeExam = 'thithu';

// ========== FIREBASE ==========
let db = null;
let firebaseReady = false;
let _historyListener = null;
let _presenceRef = null;
let _presenceOnDisconnect = null;
let _presenceCache = [];

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK chưa load');
    return false;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: "AIzaSyBYShIbucv9zejMf6-0yKODYJ1GNS54RNE",
        authDomain: "studyandtest-8c425.firebaseapp.com",
        databaseURL: "https://studyandtest-8c425-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "studyandtest-8c425",
        storageBucket: "studyandtest-8c425.firebasestorage.app",
        messagingSenderId: "156100356892",
        appId: "1:156100356892:web:2aacef6b6916260fd7e8d9",
        measurementId: "G-E8LXS83RYY"
      });
    }
    db = firebase.database();
    firebaseReady = true;
    return true;
  } catch(e) {
    console.error('Firebase init lỗi:', e);
    return false;
  }
}

function startFirebaseSync(username) {
  if (!firebaseReady || !db || !username) return;
  if (_historyListener) { _historyListener.off(); _historyListener = null; }
  _historyListener = db.ref('users/' + username + '/history');
  _historyListener.on('value', snap => {
    const val = snap.val();
    if (Array.isArray(val)) {
      examHistory = val;
    } else if (val && typeof val === 'object') {
      examHistory = Object.values(val);
    } else {
      examHistory = [];
    }
    renderHistoryTable();
    if (document.getElementById('page-profile') && !document.getElementById('page-profile').classList.contains('hidden')) renderProfilePage();
    if (isAdmin() && document.getElementById('page-admin') && !document.getElementById('page-admin').classList.contains('hidden')) renderAdminPanel();
  });
  db.ref('users/' + username + '/profile').on('value', snap => {
    const val = snap.val();
    if (val && currentUser) {
      if (val.fullname) currentUser.fullname = val.fullname;
      if (val.avatar) currentUser.avatar = val.avatar;
      updateUIAfterLogin();
    }
  });
}

function stopFirebaseSync() {
  if (_historyListener) { _historyListener.off(); _historyListener = null; }
  if (_presenceRef) { _presenceRef.remove(); _presenceRef = null; }
  if (_presenceOnDisconnect) { _presenceOnDisconnect.cancel(); _presenceOnDisconnect = null; }
  if (db && currentUser) {
    db.ref('users/' + currentUser.username + '/profile').off();
  }
}

function migrateLocalToFirebase(username) {
  if (!firebaseReady || !db || !username) return;
  try {
    const raw = localStorage.getItem(getHistoryKey(username));
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        db.ref('users/' + username + '/history').once('value').then(snap => {
          if (!snap.exists()) {
            db.ref('users/' + username + '/history').set(data);
          }
        });
      }
    }
  } catch(e) {}
}

function startPresenceListener() {
  if (typeof firebase === 'undefined' || !db) return;
  db.ref('presence').on('value', snap => {
    const val = snap.val();
    const list = [];
    const now = Date.now();
    if (val) {
      Object.values(val).forEach(devices => {
        if (!devices) return;
        Object.values(devices).forEach(p => {
          if (p && p.ts) {
            const ts = (typeof p.ts === 'number') ? p.ts : now;
            if (now - ts < 120000) list.push(p);
          }
        });
      });
    }
    _presenceCache = list;
    const rankPage = document.getElementById('page-rank');
    if (rankPage && !rankPage.classList.contains('hidden')) renderRankPage();
  });
}

// ========== HỆ THỐNG ĐĂNG NHẬP ==========

const ACCOUNTS = {
"quocanha1": {password: "12345", fullname: "Quốc Anh"},
"thanhtran": { password: "123456", fullname: "Trần Công Thành"},
"admin": { password: "admin123", fullname: "Quản trị viên"},
"hocsinh1": { password: "123456", fullname: "Học sinh Demo"},
"hocsinh2": { password: "123456", fullname: "Học sinh Demo"},
"hocsinh3": { password: "123456", fullname: "Học sinh Demo"}

};

let currentUser = null;

// ========== DEVICE REGISTRY – Giới hạn cố định 2 thiết bị / tài khoản (vĩnh viễn) ==========
const MAX_DEVICES_PER_ACCOUNT = 2;
const DEVICE_REGISTRY_KEY = "nova_device_registry";

/** Tạo fingerprint thiết bị cứng hơn (canvas + thuộc tính trình duyệt) */
function getDeviceFingerprint() {
  try {
    let fp = localStorage.getItem("nova_device_fp");
    if (fp) return fp;

    const parts = [];
    parts.push(navigator.userAgent || "");
    parts.push(navigator.language || "");
    parts.push(String(screen.width) + "x" + String(screen.height) + "x" + String(screen.colorDepth || 0));
    parts.push(String(new Date().getTimezoneOffset()));
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(String(navigator.deviceMemory || 0));
    parts.push(String(navigator.maxTouchPoints || 0));
    parts.push(navigator.platform || "");

    // Canvas fingerprint
    try {
      const c = document.createElement("canvas");
      c.width = 200; c.height = 50;
      const ctx = c.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(10, 5, 80, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("NovaFP#" + (navigator.language || "vi"), 2, 15);
      ctx.strokeStyle = "#ff0";
      ctx.strokeRect(0, 0, 199, 49);
      parts.push(c.toDataURL().slice(-48));
    } catch (e) {
      parts.push("canvas_na");
    }

    // Hash đơn giản
    const raw = parts.join("||");
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    fp = "fp_" + Math.abs(hash).toString(36) + "_" + raw.length.toString(36);
    localStorage.setItem("nova_device_fp", fp);
    return fp;
  } catch (e) {
    return "fp_fallback_" + Date.now().toString(36);
  }
}

/** Tên thiết bị dễ đọc từ User-Agent */
function getDeviceFriendlyName() {
  const ua = navigator.userAgent || "";
  let browser = "Trình duyệt";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = "Opera";

  let os = "Unknown OS";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(ua)) os = "Windows 8.1";
  else if (/Windows NT 6\.1/.test(ua)) os = "Windows 7";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return browser + " – " + os;
}

function loadDeviceRegistry() {
  try {
    const raw = localStorage.getItem(DEVICE_REGISTRY_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") return data;
    }
  } catch (e) {}
  return {};
}

function saveDeviceRegistry(reg) {
  try {
    localStorage.setItem(DEVICE_REGISTRY_KEY, JSON.stringify(reg));
  } catch (e) {
    console.warn("Không lưu được device registry:", e);
  }
}

/** Lấy danh sách thiết bị đã đăng ký (vĩnh viễn) của 1 tài khoản */
function getBoundDevices(username) {
  if (!username) return [];
  const reg = loadDeviceRegistry();
  const list = reg[username];
  return Array.isArray(list) ? list : [];
}

/** Đăng ký / cập nhật thiết bị hiện tại vào registry (vĩnh viễn) */
function registerCurrentDevice(username) {
  if (!username) return;
  // Admin miễn
  if (username === ADMIN_USERNAME) return;

  const fp = getDeviceFingerprint();
  const reg = loadDeviceRegistry();
  if (!reg[username]) reg[username] = [];

  const existing = reg[username].find(d => d.id === fp);
  const nowStr = new Date().toLocaleString("vi-VN");
  if (existing) {
    existing.lastLogin = nowStr;
  } else {
    // Chỉ thêm nếu còn slot (đã check trước khi gọi)
    if (reg[username].length >= MAX_DEVICES_PER_ACCOUNT) return;
    reg[username].push({
      id: fp,
      name: getDeviceFriendlyName(),
      registeredAt: nowStr,
      lastLogin: nowStr
    });
  }
  saveDeviceRegistry(reg);
}

/** Kiểm tra thiết bị hiện tại có được phép đăng nhập không */
function canLoginOnThisDevice(username) {
  // Admin luôn được phép
  if (username === ADMIN_USERNAME) return { ok: true, devices: [] };

  const fp = getDeviceFingerprint();
  const devices = getBoundDevices(username);

  // Đã đăng ký trước đó → cho phép
  if (devices.some(d => d.id === fp)) return { ok: true, devices };

  // Chưa đủ 2 → cho phép (sẽ đăng ký sau khi login thành công)
  if (devices.length < MAX_DEVICES_PER_ACCOUNT) return { ok: true, devices };

  // Đã đủ 2 thiết bị khác → từ chối
  return { ok: false, devices };
}

/** Admin gỡ 1 thiết bị khỏi registry */
function adminRemoveDevice(username, deviceId) {
  if (!isAdmin() || !username || username === ADMIN_USERNAME) return false;
  const reg = loadDeviceRegistry();
  if (!reg[username] || !Array.isArray(reg[username])) return false;
  const before = reg[username].length;
  reg[username] = reg[username].filter(d => d.id !== deviceId);
  if (reg[username].length === before) return false;
  saveDeviceRegistry(reg);
  return true;
}

// ========== LƯU / TẢI LỊCH SỬ LÀM BÀI (localStorage) ==========
function getHistoryKey(username) {
  return "nova_history_" + (username || "guest");
}

function loadUserHistory(username) {
  if (currentUser && currentUser.username === username && Array.isArray(examHistory)) {
    return examHistory;
  }
  try {
    const raw = localStorage.getItem(getHistoryKey(username));
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function saveUserHistory(username, historyArr) {
  try {
    const toSave = historyArr.slice(0, 100);
    examHistory = toSave;
    // Firebase Realtime Database
    if (firebaseReady && db && username) {
      db.ref('users/' + username + '/history').set(toSave).catch(err => {
        console.warn('Firebase lưu lịch sử lỗi:', err);
      });
    }
    // Fallback localStorage
    localStorage.setItem(getHistoryKey(username), JSON.stringify(toSave));
  } catch (e) {
    console.warn("Không lưu được lịch sử:", e);
    alert("Không thể lưu lịch sử làm bài. Bộ nhớ trình duyệt có thể đã đầy.");
  }
}

function refreshHistoryForCurrentUser() {
  if (currentUser && currentUser.username) {
    if (!firebaseReady) {
      examHistory = loadUserHistory(currentUser.username);
    }
  } else {
    examHistory = [];
  }
}


function checkLoginState() {
  initFirebase();
  const saved = localStorage.getItem("nova_user");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      if (currentUser && currentUser.username && ACCOUNTS[currentUser.username]) {
        const deviceCheck = canLoginOnThisDevice(currentUser.username);
        if (!deviceCheck.ok) {
          currentUser = null;
          localStorage.removeItem("nova_user");
          examHistory = [];
          updateUIAfterLogin();
          return false;
        }
        registerCurrentDevice(currentUser.username);
        try {
          const avMap = JSON.parse(localStorage.getItem("nova_avatars") || "{}");
          if (avMap[currentUser.username]) currentUser.avatar = avMap[currentUser.username];
          const edits = JSON.parse(localStorage.getItem("nova_account_edits") || "{}");
          if (edits[currentUser.username] && edits[currentUser.username].fullname) {
            currentUser.fullname = edits[currentUser.username].fullname;
          }
        } catch(e) {}
        updateUIAfterLogin();
        startFirebaseSync(currentUser.username);
        migrateLocalToFirebase(currentUser.username);
        refreshHistoryForCurrentUser();
        return true;
      }
    } catch(e) {}
  }
  currentUser = null;
  examHistory = [];
  updateUIAfterLogin();
  return false;
}

function showLogin() {
  // Chỉ hiện overlay login, không ẩn toàn bộ app
  document.getElementById("login-overlay").classList.remove("hidden");
  const u = document.getElementById("login-username");
  const p = document.getElementById("login-password");
  const e = document.getElementById("login-error");
  if (u) u.value = "";
  if (p) p.value = "";
  if (e) e.innerText = "";
  // focus username
  setTimeout(() => { if(u) u.focus(); }, 100);
}

function closeLogin() {
  document.getElementById("login-overlay").classList.add("hidden");
}

function updateUIAfterLogin() {
  const userInfo = document.getElementById("user-info-nav");
  const btnLogin = document.getElementById("btn-show-login");
  const sidebarName = document.getElementById("sidebar-fullname");

  if (currentUser) {
    // Đã đăng nhập
    if (userInfo) userInfo.style.display = "flex";
    if (btnLogin) btnLogin.style.display = "none";
    document.getElementById("nav-username").innerText = currentUser.fullname;
    if (sidebarName) sidebarName.innerText = currentUser.fullname;
    // load avatar from storage if missing
    if (!currentUser.avatar) {
      try {
        const avMap = JSON.parse(localStorage.getItem("nova_avatars") || "{}");
        if (avMap[currentUser.username]) currentUser.avatar = avMap[currentUser.username];
      } catch(e) {}
    }
    if (typeof applyAvatarToUI === "function") {
      applyAvatarToUI(currentUser.avatar || "user");
    }
  } else {
    // Chưa đăng nhập
    if (userInfo) userInfo.style.display = "none";
    if (btnLogin) btnLogin.style.display = "inline-block";
    if (sidebarName) sidebarName.innerText = "Chưa đăng nhập";
    const navBtn = document.getElementById("nav-avatar-btn");
    if (navBtn) navBtn.innerHTML = '<i class="fa-solid fa-user"></i>';
  }
}

function showApp() {
  // Giữ lại để tương thích, thực chất chỉ đóng login + cập nhật UI
  closeLogin();
  updateUIAfterLogin();
  switchTab("home");
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");

  if (!username || !password) {
    errorEl.innerText = "Vui lòng nhập đầy đủ thông tin!";
    return;
  }

  const acc = ACCOUNTS[username];
  if (!acc || acc.password !== password) {
    errorEl.innerText = "Tên tài khoản hoặc mật khẩu không đúng!";
    return;
  }
  if (acc.locked) {
    errorEl.innerText = "Tài khoản này đã bị khóa. Liên hệ Admin!";
    return;
  }

  // ===== GIỚI HẠN CỐ ĐỊNH 2 THIẾT BỊ (vĩnh viễn) =====
  const deviceCheck = canLoginOnThisDevice(username);
  if (!deviceCheck.ok) {
    errorEl.innerText = "Tài khoản đã đăng ký đủ " + MAX_DEVICES_PER_ACCOUNT + " thiết bị. Liên hệ Admin để gỡ thiết bị cũ nếu cần.";
    return;
  }

  // Login success
  let fullname = acc.fullname;
  let avatar = acc.avatar || "user";
  try {
    const edits = JSON.parse(localStorage.getItem("nova_account_edits") || "{}");
    if (edits[username] && edits[username].fullname) fullname = edits[username].fullname;
    const avMap = JSON.parse(localStorage.getItem("nova_avatars") || "{}");
    if (avMap[username]) avatar = avMap[username];
  } catch(e) {}
  currentUser = { username: username, fullname: fullname, avatar: avatar };
  localStorage.setItem("nova_user", JSON.stringify(currentUser));

  // Đăng ký thiết bị vào registry vĩnh viễn (không bị xóa khi logout)
  registerCurrentDevice(username);

  errorEl.innerText = "";
  closeLogin();
  updateUIAfterLogin();
  startPresenceHeartbeat();

  // Tải lịch sử làm bài của tài khoản này
  refreshHistoryForCurrentUser();

  // Nếu đang chờ vào thi thì tự mở modal xác nhận
  if (window._pendingExamId) {
    const id = window._pendingExamId;
    window._pendingExamId = null;
    currentExam = sampleExams.find(e => e.id === id);
    if (currentExam) {
      document.getElementById('modal-confirm').classList.remove('hidden');
    }
  }
}

function handleLogout() {
  if (isExamActive && !isReviewMode) {
    if (!confirm("Bạn đang làm bài thi. Đăng xuất sẽ hủy bài làm hiện tại. Tiếp tục?")) return;
    clearInterval(examInterval);
    clearInterval(cheatInterval);
    isExamActive = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    document.getElementById("exam-container").classList.add("hidden");
    document.getElementById("navbar").classList.remove("hidden");
  }
  clearPresence();
  stopPresenceHeartbeat();
  stopFirebaseSync();
  currentUser = null;
  localStorage.removeItem("nova_user");
  examHistory = [];
  updateUIAfterLogin();
  switchTab("home");
}

// Bảo vệ: không cho vào thi nếu chưa đăng nhập
const originalClickStartExam = typeof clickStartExam === "function" ? clickStartExam : null;


// ========== HỆ THỐNG ADMIN ==========
const ADMIN_USERNAME = "admin";  // Chỉ tài khoản này được vào Admin

function isAdmin() {
  return currentUser && currentUser.username === ADMIN_USERNAME;
}

// Load thêm tài khoản từ localStorage (admin đã tạo)
function loadExtraAccounts() {
  try {
    const raw = localStorage.getItem("nova_extra_accounts");
    if (raw) {
      const extra = JSON.parse(raw);
      if (extra && typeof extra === "object") {
        Object.keys(extra).forEach(u => {
          if (!ACCOUNTS[u]) ACCOUNTS[u] = extra[u];
        });
      }
    }
  } catch(e) {}
}

function saveExtraAccounts() {
  // Chỉ lưu các tài khoản không nằm trong bản gốc cứng
  const base = ["thanhtran", "admin", "hocsinh", "student"];
  const extra = {};
  Object.keys(ACCOUNTS).forEach(u => {
    if (!base.includes(u)) extra[u] = ACCOUNTS[u];
  });
  localStorage.setItem("nova_extra_accounts", JSON.stringify(extra));
}

// Gọi khi load trang
loadExtraAccounts();

function updateAdminNav() {
  const btn = document.getElementById("nav-admin");
  if (btn) btn.style.display = isAdmin() ? "inline-block" : "none";
}

// Override updateUIAfterLogin để cập nhật nút admin
const _origUpdateUI = updateUIAfterLogin;
updateUIAfterLogin = function() {
  _origUpdateUI();
  updateAdminNav();
};

function switchTab(tab) {
  if (tab === "admin" && !isAdmin()) {
    alert("Bạn không có quyền truy cập khu vực Quản trị!");
    tab = "home";
  }

  const navIds = ["home", "thithu", "tailieu", "history", "profile", "admin"];
  navIds.forEach(id => {
    const btn = document.getElementById("nav-" + id);
    if (btn) btn.className = (tab === id) ? "active" : "";
  });

  const pageIds = ["home", "thithu", "tailieu", "history", "profile", "admin"];
  pageIds.forEach(id => {
    const page = document.getElementById("page-" + id);
    if (page) page.className = (tab === id) ? "page" : "page hidden";
  });

  if (tab === "history") {
    if (!currentUser) examHistory = [];
    renderHistoryTable();
  }
  if (tab === "thithu") {
    // reset về chọn kỳ nếu chưa chọn
    const detail = document.getElementById("thithu-detail");
    if (detail && !detail.dataset.keep) {
      document.getElementById("kythi-grid").classList.remove("hidden");
      detail.classList.add("hidden");
    }
  }
  if (tab === "profile") renderProfilePage();
  if (tab === "admin" && isAdmin()) renderAdminPanel();
}

let currentKyThi = "dgnl";
const KY_THI_META = {
  dgnl: { title: "HSA", subjects: ["Toán học", "Ngữ văn", "Tiếng anh", "Khoa học"] },
  tnthpt: { title: "TN THPT", subjects: ["Toán", "Ngữ văn", "Tiếng Anh", "Vật lý", "Hóa học", "Sinh học", "Lịch sử", "Địa lý"] },
  tsa: { title: "TSA", subjects: ["Toán", "Đọc hiểu", "Khoa học"] },
  vact: { title: "VACT", subjects: ["Toán", "Ngữ văn", "Tiếng Anh", "Khoa học tự nhiên"] }
};

function selectKyThi(ky) {
  currentKyThi = ky;
  const meta = KY_THI_META[ky] || { title: ky, subjects: [] };
  document.getElementById("kythi-grid").classList.add("hidden");
  const detail = document.getElementById("thithu-detail");
  detail.classList.remove("hidden");
  detail.dataset.keep = "1";
  document.getElementById("thithu-detail-title").innerText = meta.title;

  const subWrap = document.getElementById("thithu-subjects");
  subWrap.innerHTML = "";
  const icons = {
    "Toán học": "fa-calculator", "Toán": "fa-calculator",
    "Ngữ văn": "fa-book-open", "Tiếng anh": "fa-language", "Tiếng Anh": "fa-language",
    "Khoa học": "fa-atom", "Khoa học tự nhiên": "fa-atom",
    "Vật lý": "fa-bolt", "Hóa học": "fa-flask", "Sinh học": "fa-dna",
    "Lịch sử": "fa-landmark", "Địa lý": "fa-globe", "Đọc hiểu": "fa-book-reader"
  };
  const colors = ["#3b82f6","#f59e0b","#10b981","#ec4899","#8b5cf6","#06b6d4","#ef4444","#84cc16"];
  meta.subjects.forEach((s, i) => {
    const icon = icons[s] || "fa-file-lines";
    const col = colors[i % colors.length];
    subWrap.innerHTML += `<div class="subject-card" onclick="loadExamsForKy('${s.replace(/'/g,"\\'")}')">
      <i class="fa-solid ${icon}" style="color:${col}"></i><h3>${s}</h3></div>`;
  });

  // Load all exams for this kỳ (dgnl has real data; others empty for now)
  loadExamsForKy("all");
}

function backToKyThi() {
  document.getElementById("kythi-grid").classList.remove("hidden");
  const detail = document.getElementById("thithu-detail");
  detail.classList.add("hidden");
  delete detail.dataset.keep;
}

function loadExamsForKy(type) {
  const tbody = document.getElementById("exam-list-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">Đang tải danh sách đề...</td></tr>`;
  loadExamList().then(() => {
    _renderExamList(type);
  }).catch(err => {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger-color); padding:20px;">Lỗi tải danh sách đề.</td></tr>`;
    console.error(err);
  });
}
function _renderExamList(type) {
  const tbody = document.getElementById("exam-list-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Lọc theo kỳ thi trước (mặc định "dgnl" nếu đề chưa gán kyThi, để tương thích đề cũ)
  const examsOfKyThi = sampleExams.filter(e => (e.kyThi || "dgnl") === currentKyThi);

  if (examsOfKyThi.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:28px;">
      Đề thi <b>${(KY_THI_META[currentKyThi]||{}).title || currentKyThi}</b> đang được cập nhật. Vui lòng quay lại sau.
    </td></tr>`;
    return;
  }

  // Map subject names for filter
  const filtered = type === "all" ? examsOfKyThi : examsOfKyThi.filter(e => e.type === type);
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:28px;">Chưa có đề cho môn này.</td></tr>`;
    return;
  }
  filtered.forEach(e => {
    const freeIds = [
      'vact_de_1',
      
      'hsa_kh_1','hsa_kh_2','hsa_kh_3','hsa_kh_h',
      'hsa_toan_1', 'hsa_toan_2', 'hsa_toan_3',
      'hsa_van_1', 'hsa_van_2', 'hsa_van_3',
      'hsa_anh_1', 'hsa_anh_2', 'hsa_anh_3'
    ];
    const freeBadge = freeIds.includes(e.id)
      ? ' <span style="font-size:11px;color:#34d399;font-weight:600;">(Trải nghiệm)</span>'
      : '';

    tbody.innerHTML += `<tr>
      <td><b>${e.name}</b>${freeBadge}</td>
      <td>${e.questions || 50} câu</td>
      <td>${e.time} phút</td>
      <td>
        <button class="btn btn-primary" onclick="clickStartExam('${e.id}')">Vào thi</button>
      </td>
    </tr>`;
  });
}

function showTailieuSection(sec) {
  document.getElementById("tailieu-content").classList.remove("hidden");
  const titles = { sgk: "Kiến thức SGK", bt: "Bài tập luyện tập" };
  const clsSel = document.getElementById("tailieu-class-select");
  const cls = clsSel ? clsSel.value : "";
  const clsLabel = cls ? (" • Lớp " + cls) : "";
  document.getElementById("tailieu-section-title").innerText = (titles[sec] || sec) + clsLabel;
  const body = document.getElementById("tailieu-body");
  const clsNote = cls
    ? `<p style="margin-bottom:12px;"><span class="news-tag tag-info">Lớp ${cls}</span> Tài liệu được đề xuất theo chương trình lớp ${cls}.</p>`
    : `<p style="margin-bottom:12px; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-info-circle"></i> Chọn lớp ở trên để lọc nội dung phù hợp hơn.</p>`;
  if (sec === "sgk") {
    body.innerHTML = clsNote + `<p>Mục <b>Kiến thức SGK</b> sẽ chứa tóm tắt lý thuyết theo chương trình sách giáo khoa các môn Toán, Văn, Anh, Khoa học...</p>
      <p style="margin-top:12px; color:var(--warning-color);"><i class="fa-solid fa-clock"></i> Nội dung đang được biên soạn và sẽ cập nhật sớm.</p>`;
  } else {
    body.innerHTML = clsNote + `<p>Mục <b>Bài tập</b> sẽ chứa các chuyên đề luyện tập, bài tập có lời giải theo từng kỳ thi.</p>
      <p style="margin-top:12px; color:var(--warning-color);"><i class="fa-solid fa-clock"></i> Nội dung đang được biên soạn và sẽ cập nhật sớm.</p>`;
  }
}

function onTailieuClassChange(val) {
  const hint = document.getElementById("tailieu-class-hint");
  if (!hint) return;
  if (!val) {
    hint.textContent = "Chọn lớp để đề xuất tài liệu phù hợp";
  } else {
    hint.textContent = "Đang đề xuất tài liệu cho Lớp " + val;
  }
  // Nếu đang mở section, refresh nội dung
  const content = document.getElementById("tailieu-content");
  if (content && !content.classList.contains("hidden")) {
    const title = document.getElementById("tailieu-section-title");
    if (title && title.innerText.includes("SGK")) showTailieuSection("sgk");
    else if (title) showTailieuSection("bt");
  }
}

function hideTailieuSection() {
  document.getElementById("tailieu-content").classList.add("hidden");
}

function renderProfilePage() {
  const guest = document.getElementById("profile-guest");
  const logged = document.getElementById("profile-logged");
  if (!currentUser) {
    guest.classList.remove("hidden");
    logged.classList.add("hidden");
    return;
  }
  guest.classList.add("hidden");
  logged.classList.remove("hidden");
  const nameInp = document.getElementById("profile-fullname-input");
  if (nameInp) nameInp.value = currentUser.fullname || "";
  document.getElementById("profile-username").innerText = currentUser.username || "—";
  applyAvatarToUI(currentUser.avatar || "user");
  const picker = document.getElementById("avatar-picker-panel");
  if (picker) picker.classList.add("hidden");
  const st = typeof computeUserStats === "function" ? computeUserStats(currentUser.username) : { count:0, avg:0, best:0 };
  document.getElementById("profile-total-exams").innerText = st.count;
  document.getElementById("profile-avg").innerText = st.count ? st.avg.toFixed(1) + "%" : "—";
  document.getElementById("profile-best").innerText = st.count ? st.best.toFixed(1) + "%" : "—";
  const tbody = document.getElementById("profile-history-body");
  const hist = examHistory || [];
  if (hist.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Chưa có bài làm nào.</td></tr>`;
  } else {
    tbody.innerHTML = hist.slice(0, 10).map(h => `<tr>
      <td>${h.timeStr}</td><td><b>${h.name}</b></td>
      <td style="color:var(--success-color); font-weight:600;">${h.scoreText}</td>
    </tr>`).join("");
  }
}

const AVATAR_ICONS = {
  "user": "fa-solid fa-user",
  "user-graduate": "fa-solid fa-user-graduate",
  "user-astronaut": "fa-solid fa-user-astronaut",
  "user-ninja": "fa-solid fa-user-ninja",
  "user-tie": "fa-solid fa-user-tie",
  "robot": "fa-solid fa-robot",
  "cat": "fa-solid fa-cat",
  "dog": "fa-solid fa-dog",
  "dragon": "fa-solid fa-dragon",
  "ghost": "fa-solid fa-ghost"
};

function applyAvatarToUI(avatarKey) {
  const iconCls = AVATAR_ICONS[avatarKey] || AVATAR_ICONS["user"];
  const profileIcon = document.getElementById("profile-avatar-icon");
  if (profileIcon) profileIcon.className = iconCls;
  const navBtn = document.getElementById("nav-avatar-btn");
  if (navBtn) {
    navBtn.innerHTML = `<i class="${iconCls}"></i>`;
  }
  // highlight selected in picker
  document.querySelectorAll(".avatar-option").forEach(el => {
    el.classList.toggle("selected", el.getAttribute("data-avatar") === avatarKey);
  });
}

function toggleAvatarPicker() {
  const panel = document.getElementById("avatar-picker-panel");
  if (!panel) return;
  panel.classList.toggle("hidden");
}

function selectAvatar(key, el) {
  if (!currentUser) return;
  currentUser.avatar = key;
  if (ACCOUNTS[currentUser.username]) {
    ACCOUNTS[currentUser.username].avatar = key;
  }
  localStorage.setItem("nova_user", JSON.stringify(currentUser));
  // persist avatar per account
  try {
    const avMap = JSON.parse(localStorage.getItem("nova_avatars") || "{}");
    avMap[currentUser.username] = key;
    localStorage.setItem("nova_avatars", JSON.stringify(avMap));
  } catch(e) {}
  applyAvatarToUI(key);
  const panel = document.getElementById("avatar-picker-panel");
  if (panel) panel.classList.add("hidden");
}

function saveProfileName() {
  if (!currentUser) return;
  const inp = document.getElementById("profile-fullname-input");
  if (!inp) return;
  const newName = (inp.value || "").trim();
  if (!newName) {
    alert("Họ tên không được để trống.");
    inp.focus();
    return;
  }
  if (newName.length > 40) {
    alert("Họ tên tối đa 40 ký tự.");
    return;
  }
  currentUser.fullname = newName;
  if (ACCOUNTS[currentUser.username]) {
    ACCOUNTS[currentUser.username].fullname = newName;
  }
  localStorage.setItem("nova_user", JSON.stringify(currentUser));
  // persist name edit
  try {
    const edits = JSON.parse(localStorage.getItem("nova_account_edits") || "{}");
    if (!edits[currentUser.username]) edits[currentUser.username] = {};
    edits[currentUser.username].fullname = newName;
    localStorage.setItem("nova_account_edits", JSON.stringify(edits));
  } catch(e) {}
  // update nav + sidebar
  const navName = document.getElementById("nav-username");
  if (navName) navName.innerText = newName;
  const sidebarName = document.getElementById("sidebar-fullname");
  if (sidebarName) sidebarName.innerText = newName;
  alert("Đã cập nhật họ tên thành công!");
}

function renderAdminPanel() {
  if (!isAdmin()) return;

  // Thống kê
  const users = Object.keys(ACCOUNTS);
  document.getElementById("admin-stat-users").innerText = users.length;

  let totalExams = 0;
  users.forEach(u => {
    totalExams += loadUserHistory(u).length;
  });
  document.getElementById("admin-stat-exams").innerText = totalExams;

  // Bảng tài khoản
  const tbody = document.getElementById("admin-users-body");
  tbody.innerHTML = "";
  users.forEach(u => {
    const acc = ACCOUNTS[u];
    const histCount = loadUserHistory(u).length;
    const canDelete = u !== ADMIN_USERNAME;
    const passId = "pass-" + u.replace(/[^a-z0-9]/gi, "_");
    const locked = !!acc.locked;
    const roleHtml = u === ADMIN_USERNAME
      ? '<span style="color:#f59e0b;font-weight:600;">Admin</span>'
      : (locked ? '<span class="badge-locked">Đã khóa</span>' : "Học sinh");
    const bound = getBoundDevices(u);
    const deviceHtml = u === ADMIN_USERNAME
      ? '<span style="color:var(--text-muted);font-size:12px;">Miễn giới hạn</span>'
      : `<span style="font-weight:600;color:${bound.length >= MAX_DEVICES_PER_ACCOUNT ? 'var(--danger-color)' : 'var(--success-color)'};">${bound.length}/${MAX_DEVICES_PER_ACCOUNT}</span>`;
    tbody.innerHTML += `<tr>
      <td><b>${u}</b></td>
      <td>
        <input class="admin-edit-input" id="edit-name-${u}" value="${(acc.fullname||'').replace(/"/g,'&quot;')}" style="width:130px;">
      </td>
      <td>
        <span style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <code id="${passId}" style="background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:4px; font-size:13px; letter-spacing:1px;">••••••</code>
          <button class="btn" style="padding:3px 8px; background:rgba(255,255,255,0.08); color:var(--text-main); border:1px solid var(--border-color); font-size:12px;"
            onclick="adminTogglePass('${passId}', '${(acc.password || '').replace(/'/g, "\\'")}')" title="Ẩn/Hiện mật khẩu">
            <i class="fa-solid fa-eye" id="icon-${passId}"></i>
          </button>
          <input class="admin-edit-input" id="edit-pass-${u}" type="text" placeholder="Mk mới..." style="width:90px;">
        </span>
      </td>
      <td>${roleHtml}</td>
      <td>${histCount}</td>
      <td>${deviceHtml}</td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-success" style="padding:5px 10px;" onclick="adminSaveEdit('${u}')" title="Lưu họ tên / mật khẩu">
            <i class="fa-solid fa-floppy-disk"></i> Lưu
          </button>
          <button class="btn btn-primary" style="padding:5px 10px;" onclick="adminQuickLogin('${u}')" title="Đăng nhập nhanh">
            <i class="fa-solid fa-right-to-bracket"></i> Vào TK
          </button>
          ${u !== ADMIN_USERNAME ? `<button class="btn" style="padding:5px 10px; background:${locked?'#10b981':'#f59e0b'}; color:white;" onclick="adminToggleLock('${u}')">
            <i class="fa-solid fa-${locked?'lock-open':'lock'}"></i> ${locked?'Mở khóa':'Khóa'}
          </button>` : ''}
          ${canDelete ? `<button class="btn btn-danger" style="padding:5px 10px;" onclick="adminDeleteAccount('${u}')">
            <i class="fa-solid fa-user-minus"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  });

  // Select user (lịch sử)
  const sel = document.getElementById("admin-select-user");
  if (sel) {
    sel.innerHTML = users.map(u => `<option value="${u}">${u} (${ACCOUNTS[u].fullname})</option>`).join("");
  }
  document.getElementById("admin-history-body").innerHTML = 
    `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Chọn tài khoản rồi bấm Xem lịch sử.</td></tr>`;

  // Select user (thiết bị) – bỏ Admin vì miễn giới hạn
  const devSel = document.getElementById("admin-device-user");
  if (devSel) {
    const nonAdmin = users.filter(u => u !== ADMIN_USERNAME);
    devSel.innerHTML = nonAdmin.length
      ? nonAdmin.map(u => {
          const cnt = getBoundDevices(u).length;
          return `<option value="${u}">${u} (${ACCOUNTS[u].fullname}) – ${cnt}/${MAX_DEVICES_PER_ACCOUNT}</option>`;
        }).join("")
      : `<option value="">Không có tài khoản học sinh</option>`;
  }
  const devBody = document.getElementById("admin-devices-body");
  if (devBody) {
    devBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Chọn tài khoản để xem thiết bị đã đăng ký.</td></tr>`;
  }
}

/** Admin: tải danh sách thiết bị của 1 tài khoản */
function adminLoadDevices() {
  if (!isAdmin()) return;
  const u = document.getElementById("admin-device-user")?.value;
  const tbody = document.getElementById("admin-devices-body");
  if (!tbody) return;
  if (!u) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Chọn tài khoản.</td></tr>`;
    return;
  }
  const devices = getBoundDevices(u);
  if (devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Tài khoản này chưa đăng ký thiết bị nào.</td></tr>`;
    return;
  }
  tbody.innerHTML = devices.map(d => {
    const safeId = (d.id || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `<tr>
      <td><b>${(d.name || "Thiết bị không rõ").replace(/</g, "&lt;")}</b></td>
      <td>${d.registeredAt || "—"}</td>
      <td>${d.lastLogin || "—"}</td>
      <td>
        <button class="btn btn-danger" style="padding:5px 12px;" onclick="adminConfirmRemoveDevice('${u}', '${safeId}')">
          <i class="fa-solid fa-trash"></i> Gỡ thiết bị
        </button>
      </td>
    </tr>`;
  }).join("");
}

function adminConfirmRemoveDevice(username, deviceId) {
  if (!isAdmin()) return;
  if (!confirm("Gỡ thiết bị này khỏi tài khoản \"" + username + "\"?\nSau khi gỡ, thiết bị đó sẽ không đăng nhập được nữa (trừ khi còn slot trống).")) return;
  if (adminRemoveDevice(username, deviceId)) {
    alert("Đã gỡ thiết bị thành công.");
    adminLoadDevices();
    renderAdminPanel();
  } else {
    alert("Không tìm thấy thiết bị hoặc không thể gỡ.");
  }
}


function adminTogglePass(passId, realPass) {
  if (!isAdmin()) return;
  const el = document.getElementById(passId);
  const icon = document.getElementById("icon-" + passId);
  if (!el) return;
  if (el.dataset.shown === "1") {
    el.textContent = "••••••";
    el.dataset.shown = "0";
    if (icon) icon.className = "fa-solid fa-eye";
  } else {
    el.textContent = realPass;
    el.dataset.shown = "1";
    if (icon) icon.className = "fa-solid fa-eye-slash";
  }
}

function adminQuickLogin(username) {
  if (!isAdmin()) return;
  const acc = ACCOUNTS[username];
  if (!acc) {
    alert("Tài khoản không tồn tại!");
    return;
  }
  // Kiểm tra registry vĩnh viễn (Admin account được miễn)
  if (username !== ADMIN_USERNAME) {
    const deviceCheck = canLoginOnThisDevice(username);
    if (!deviceCheck.ok) {
      alert("Tài khoản \"" + username + "\" đã đăng ký đủ " + MAX_DEVICES_PER_ACCOUNT + " thiết bị.\nHãy gỡ thiết bị cũ trong phần Quản trị trước.");
      return;
    }
  }
  if (!confirm("Đăng nhập nhanh vào tài khoản \"" + username + "\" (" + acc.fullname + ")?\nBạn sẽ thoát phiên Admin hiện tại.")) return;

  clearPresence();
  stopPresenceHeartbeat();

  let fullname = acc.fullname;
  let avatar = acc.avatar || "user";
  try {
    const edits = JSON.parse(localStorage.getItem("nova_account_edits") || "{}");
    if (edits[username] && edits[username].fullname) fullname = edits[username].fullname;
    const avMap = JSON.parse(localStorage.getItem("nova_avatars") || "{}");
    if (avMap[username]) avatar = avMap[username];
  } catch(e) {}
  currentUser = { username: username, fullname: fullname, avatar: avatar };
  localStorage.setItem("nova_user", JSON.stringify(currentUser));
  registerCurrentDevice(username);
  refreshHistoryForCurrentUser();
  updateUIAfterLogin();
  updateAdminNav();
  startPresenceHeartbeat();
  switchTab("home");
  alert("Đã đăng nhập vào: " + fullname + " (" + username + ")");
}

function adminAddAccount() {
  if (!isAdmin()) return;
  const u = document.getElementById("admin-new-user").value.trim().toLowerCase();
  const p = document.getElementById("admin-new-pass").value;
  const n = document.getElementById("admin-new-name").value.trim();

  if (!u || !p || !n) {
    alert("Vui lòng điền đầy đủ Tên tài khoản, Mật khẩu và Họ tên!");
    return;
  }
  if (ACCOUNTS[u]) {
    alert("Tài khoản này đã tồn tại!");
    return;
  }
  if (u.length < 3) {
    alert("Tên tài khoản phải có ít nhất 3 ký tự!");
    return;
  }

  ACCOUNTS[u] = { password: p, fullname: n };
  saveExtraAccounts();
  document.getElementById("admin-new-user").value = "";
  document.getElementById("admin-new-pass").value = "";
  document.getElementById("admin-new-name").value = "";
  renderAdminPanel();
  alert("Đã thêm tài khoản: " + u);
}

function adminDeleteAccount(username) {
  if (!isAdmin()) return;
  if (username === ADMIN_USERNAME) {
    alert("Không thể xóa tài khoản Admin!");
    return;
  }
  if (!confirm(`Xóa tài khoản "${username}" và toàn bộ lịch sử + thiết bị đã đăng ký của họ?`)) return;

  delete ACCOUNTS[username];
  localStorage.removeItem(getHistoryKey(username));
  // Xóa luôn registry thiết bị của tài khoản này
  try {
    const reg = loadDeviceRegistry();
    if (reg[username]) {
      delete reg[username];
      saveDeviceRegistry(reg);
    }
  } catch(e) {}
  saveExtraAccounts();
  renderAdminPanel();
  alert("Đã xóa tài khoản: " + username);
}

function adminLoadUserHistory() {
  if (!isAdmin()) return;
  const u = document.getElementById("admin-select-user").value;
  const tbody = document.getElementById("admin-history-body");
  function renderHist(hist) {
    if (hist.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Tài khoản này chưa làm bài nào.</td></tr>`;
      return;
    }
    tbody.innerHTML = hist.map(h => `<tr>
      <td>${h.timeStr}</td>
      <td><b>${h.name}</b></td>
      <td style="color:var(--success-color); font-weight:600;">${h.scoreText}</td>
    </tr>`).join("");
  }
  if (firebaseReady && db) {
    db.ref('users/' + u + '/history').once('value').then(snap => {
      const val = snap.val();
      let hist = [];
      if (Array.isArray(val)) hist = val;
      else if (val && typeof val === 'object') hist = Object.values(val);
      renderHist(hist);
    }).catch(() => {
      renderHist(loadUserHistory(u));
    });
  } else {
    renderHist(loadUserHistory(u));
  }
}

function adminClearUserHistory() {
  if (!isAdmin()) return;
  const u = document.getElementById("admin-select-user").value;
  if (!confirm(`Xóa TOÀN BỘ lịch sử của tài khoản "${u}"?`)) return;
  if (firebaseReady && db) {
    db.ref('users/' + u + '/history').remove().catch(()=>{});
  }
  saveUserHistory(u, []);
  if (currentUser && currentUser.username === u) {
    examHistory = [];
  }
  adminLoadUserHistory();
  renderAdminPanel();
  alert("Đã xóa lịch sử của: " + u);
}


// ========== PRESENCE (online / đang làm đề) ==========
let presenceInterval = null;
function updatePresence(status) {
  if (!currentUser) return;
  const deviceId = getDeviceFingerprint();
  // Firebase Realtime Database
  if (firebaseReady && db) {
    const ref = db.ref('presence/' + currentUser.username + '/' + deviceId);
    ref.set({
      username: currentUser.username,
      fullname: currentUser.fullname,
      status: status || "online",
      deviceId: deviceId,
      ts: firebase.database.ServerValue.TIMESTAMP
    });
    if (_presenceOnDisconnect) _presenceOnDisconnect.cancel();
    _presenceOnDisconnect = ref.onDisconnect();
    _presenceOnDisconnect.remove();
    _presenceRef = ref;
  }
  // Fallback localStorage
  try {
    const key = "nova_presence_" + currentUser.username + "_" + deviceId;
    localStorage.setItem(key, JSON.stringify({
      username: currentUser.username,
      fullname: currentUser.fullname,
      status: status || "online",
      deviceId: deviceId,
      ts: Date.now()
    }));
  } catch(e) {}
}
function clearPresence() {
  if (!currentUser) return;
  try {
    const deviceId = getDeviceFingerprint();
    localStorage.removeItem("nova_presence_" + currentUser.username + "_" + deviceId);
    // Xóa luôn key cũ (không có deviceId) nếu còn sót
    localStorage.removeItem("nova_presence_" + currentUser.username);
  } catch(e) {}
}
function getPresenceList() {
  if (_presenceCache && _presenceCache.length) return _presenceCache;
  const result = [];
  const now = Date.now();
  const ONLINE_MS = 120000;
  const byUser = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("nova_presence_")) {
        try {
          const d = JSON.parse(localStorage.getItem(k));
          if (d && d.username && d.ts && (now - d.ts) < ONLINE_MS) {
            const prev = byUser[d.username];
            if (!prev || (d.status === "exam" && prev.status !== "exam")) {
              byUser[d.username] = d;
            }
          }
        } catch(e) {}
      }
    }
  } catch(e) {}
  return Object.values(byUser);
}
function startPresenceHeartbeat() {
  stopPresenceHeartbeat();
  updatePresence(isExamActive && !isReviewMode ? "exam" : "online");
  presenceInterval = setInterval(() => {
    updatePresence(isExamActive && !isReviewMode ? "exam" : "online");
  }, 30000);
}
function stopPresenceHeartbeat() {
  if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
}

// ========== Q FILTER ==========
let currentQFilter = "all";
function setQFilter(f) {
  currentQFilter = f;
  document.querySelectorAll("#q-filter-pills .filter-pill").forEach(btn => {
    btn.classList.remove("active", "active-mark", "active-undone");
    if (btn.dataset.filter === f) {
      if (f === "marked") btn.classList.add("active-mark");
      else if (f === "undone") btn.classList.add("active-undone");
      else btn.classList.add("active");
    }
  });
  renderSidebarGrid();
}

// ========== TIMER WARNING ==========
function updateTimerDisplay() {
  const el = document.getElementById("bottom-timer-clock");
  const wrap = el ? el.closest(".bottom-timer") : null;
  if (!el) return;
  let m = Math.floor(secondsLeft / 60).toString().padStart(2,"0");
  let s = (secondsLeft % 60).toString().padStart(2,"0");
  el.innerText = `${m}:${s}`;
  if (wrap) {
    wrap.classList.remove("warning", "danger");
    if (secondsLeft <= 60) wrap.classList.add("danger");
    else if (secondsLeft <= 300) wrap.classList.add("warning");
  }
}

// ========== SOUND ==========
function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === "submit") {
      osc.frequency.value = 660; gain.gain.value = 0.15;
      osc.start(); setTimeout(() => { osc.frequency.value = 880; }, 120);
      setTimeout(() => { osc.stop(); ctx.close(); }, 350);
    } else if (type === "timeout") {
      osc.frequency.value = 400; gain.gain.value = 0.2;
      osc.start(); setTimeout(() => { osc.frequency.value = 300; }, 200);
      setTimeout(() => { osc.frequency.value = 200; }, 400);
      setTimeout(() => { osc.stop(); ctx.close(); }, 700);
    } else if (type === "warn") {
      osc.frequency.value = 520; gain.gain.value = 0.12;
      osc.start(); setTimeout(() => { osc.stop(); ctx.close(); }, 180);
    }
  } catch(e) {}
}

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener("keydown", function(e) {
  if (!isExamActive || isReviewMode) return;
  // Không chặn khi đang gõ trong input
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

  const key = e.key.toLowerCase();
  const q = activeQuestions.find(item => item.id === currentIndex);
  if (!q) return;

  // A B C D chọn đáp án
  if (["a","b","c","d","1","2","3","4"].includes(key)) {
    if (q.options && q.options.length > 0) {
      const map = {a:0,b:1,c:2,d:3,"1":0,"2":1,"3":2,"4":3};
      const idx = map[key];
      if (idx !== undefined && idx < q.options.length) {
        userAnswers[q.id] = idx;
        renderSidebarGrid();
        updateWorkspace();
      }
    }
    return;
  }
  // Mũi tên trái/phải hoặc P/N
  if (e.key === "ArrowLeft" || key === "p") { e.preventDefault(); navQuestion(-1); }
  if (e.key === "ArrowRight" || key === "n") { e.preventDefault(); navQuestion(1); }
  // F đánh dấu
  if (key === "f") {
    markedQuestions[q.id] = !markedQuestions[q.id];
    renderSidebarGrid();
    updateWorkspace();
  }
});

// ========== RANKING ==========
function computeUserStats(username) {
  const hist = loadUserHistory(username);
  if (hist.length === 0) return { count:0, avg:0, best:0 };
  let totalPct = 0, best = 0;
  hist.forEach(h => {
    // scoreText dạng "x/y"
    const parts = String(h.scoreText || "0/50").split("/");
    const correct = parseInt(parts[0]) || 0;
    const total = parseInt(parts[1]) || 50;
    const pct = total > 0 ? (correct / total) * 100 : 0;
    totalPct += pct;
    if (pct > best) best = pct;
  });
  return { count: hist.length, avg: totalPct / hist.length, best };
}

function renderRankPage() {
  loadExtraAccounts();
  const users = Object.keys(ACCOUNTS);
  const presence = getPresenceList();
  const onlineSet = {};
  const examSet = {};
  presence.forEach(p => {
    onlineSet[p.username] = true;
    if (p.status === "exam") examSet[p.username] = true;
  });

  document.getElementById("rank-total-users").innerText = users.length;
  document.getElementById("rank-online").innerText = Object.keys(onlineSet).length;
  document.getElementById("rank-inexam").innerText = Object.keys(examSet).length;

  let totalAttempts = 0;
  const rows = users.map(u => {
    const st = computeUserStats(u);
    totalAttempts += st.count;
    let status = '<span style="color:var(--text-muted);">Offline</span>';
    if (examSet[u]) status = '<span style="color:#f59e0b;font-weight:600;">Đang làm đề</span>';
    else if (onlineSet[u]) status = '<span style="color:#10b981;font-weight:600;">Online</span>';
    return {
      username: u,
      fullname: ACCOUNTS[u].fullname || u,
      count: st.count,
      avg: st.avg,
      best: st.best,
      statusHtml: status,
      locked: !!ACCOUNTS[u].locked
    };
  });
  document.getElementById("rank-total-attempts").innerText = totalAttempts;

  // sort by avg desc, then count
  rows.sort((a,b) => b.avg - a.avg || b.count - a.count);

  const medals = ["🥇","🥈","🥉"];
  const tbody = document.getElementById("rank-table-body");
  if (rows.every(r => r.count === 0)) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Chưa có dữ liệu làm bài.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r, i) => {
    const rank = i < 3 ? `<span class="rank-medal">${medals[i]}</span>` : (i+1);
    const name = r.locked ? `${r.fullname} <span class="badge-locked">Đã khóa</span>` : r.fullname;
    return `<tr>
      <td style="text-align:center;font-weight:700;">${rank}</td>
      <td>${name}</td>
      <td>${r.username}</td>
      <td>${r.count}</td>
      <td style="font-weight:600;color:var(--primary-light);">${r.count ? r.avg.toFixed(1)+"%" : "—"}</td>
      <td>${r.count ? r.best.toFixed(1)+"%" : "—"}</td>
      <td>${r.statusHtml}</td>
    </tr>`;
  }).join("");
}

// ========== ADMIN: edit name/pass + lock ==========
function adminToggleLock(username) {
  if (!isAdmin() || username === ADMIN_USERNAME) return;
  if (!ACCOUNTS[username]) return;
  ACCOUNTS[username].locked = !ACCOUNTS[username].locked;
  saveExtraAccounts();
  // also persist lock on base accounts
  try {
    const locks = JSON.parse(localStorage.getItem("nova_locks") || "{}");
    locks[username] = !!ACCOUNTS[username].locked;
    localStorage.setItem("nova_locks", JSON.stringify(locks));
  } catch(e) {}
  renderAdminPanel();
}

function adminSaveEdit(username) {
  if (!isAdmin()) return;
  const nameEl = document.getElementById("edit-name-" + username);
  const passEl = document.getElementById("edit-pass-" + username);
  if (!nameEl || !passEl) return;
  const newName = nameEl.value.trim();
  const newPass = passEl.value;
  if (!newName) { alert("Họ tên không được để trống!"); return; }
  if (newPass && newPass.length < 3) { alert("Mật khẩu tối thiểu 3 ký tự!"); return; }
  ACCOUNTS[username].fullname = newName;
  if (newPass) ACCOUNTS[username].password = newPass;
  saveExtraAccounts();
  // update base locks/names store
  try {
    const edits = JSON.parse(localStorage.getItem("nova_edits") || "{}");
    edits[username] = { fullname: ACCOUNTS[username].fullname, password: ACCOUNTS[username].password };
    localStorage.setItem("nova_edits", JSON.stringify(edits));
  } catch(e) {}
  alert("Đã lưu thay đổi cho: " + username);
  renderAdminPanel();
}

function loadLocksAndEdits() {
  try {
    const locks = JSON.parse(localStorage.getItem("nova_locks") || "{}");
    Object.keys(locks).forEach(u => { if (ACCOUNTS[u]) ACCOUNTS[u].locked = !!locks[u]; });
    const edits = JSON.parse(localStorage.getItem("nova_edits") || "{}");
    Object.keys(edits).forEach(u => {
      if (ACCOUNTS[u] && edits[u]) {
        if (edits[u].fullname) ACCOUNTS[u].fullname = edits[u].fullname;
        if (edits[u].password) ACCOUNTS[u].password = edits[u].password;
      }
    });
  } catch(e) {}
}


// ========== WEBSOCKET REALTIME ==========
// Đổi URL này nếu server chạy ở máy/host khác
const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + (localStorage.getItem("nova_ws_host") || "localhost:3080");

let novaWS = null;
let wsReconnectTimer = null;
let wsConnected = false;
let remotePresence = {}; // key = "username|deviceId" -> {username, fullname, status, deviceId, ts}

function setRTStatus(state, text) {
  const badge = document.getElementById("rt-status");
  const label = document.getElementById("rt-status-text");
  if (!badge || !label) return;
  badge.classList.remove("connected");
  if (state === "connected") {
    badge.classList.add("connected");
    label.innerText = text || "Realtime";
  } else if (state === "connecting") {
    label.innerText = text || "Đang kết nối...";
  } else {
    label.innerText = text || "Ngoại tuyến (local)";
  }
}

function connectWebSocket() {
  if (novaWS && (novaWS.readyState === WebSocket.OPEN || novaWS.readyState === WebSocket.CONNECTING)) return;
  setRTStatus("connecting");
  try {
    novaWS = new WebSocket(WS_URL);
  } catch (e) {
    setRTStatus("offline", "Ngoại tuyến (local)");
    scheduleWsReconnect();
    return;
  }

  novaWS.onopen = () => {
    wsConnected = true;
    setRTStatus("connected", "Realtime");
    // gửi join + presence hiện tại
    wsSend({ type: "hello", client: "nova-web" });
    if (currentUser) {
      wsSend({
        type: "presence",
        username: currentUser.username,
        fullname: currentUser.fullname,
        status: (isExamActive && !isReviewMode) ? "exam" : "online",
        deviceId: getDeviceFingerprint(),
        ts: Date.now()
      });
    }
    // xin snapshot
    wsSend({ type: "sync_request" });
  };

  novaWS.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleWSMessage(msg);
    } catch (e) {}
  };

  novaWS.onclose = () => {
    wsConnected = false;
    setRTStatus("offline", "Ngoại tuyến (local)");
    scheduleWsReconnect();
  };

  novaWS.onerror = () => {
    try { novaWS.close(); } catch(e) {}
  };
}

function scheduleWsReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(connectWebSocket, 4000);
}

function wsSend(obj) {
  if (novaWS && novaWS.readyState === WebSocket.OPEN) {
    try { novaWS.send(JSON.stringify(obj)); } catch(e) {}
  }
}

function handleWSMessage(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === "presence" && msg.username) {
    // Hỗ trợ multi-device: key = username|deviceId (fallback username nếu server cũ không gửi deviceId)
    const devId = msg.deviceId || "unknown";
    const key = msg.username + "|" + devId;
    remotePresence[key] = {
      username: msg.username,
      fullname: msg.fullname || msg.username,
      status: msg.status || "online",
      deviceId: devId,
      ts: msg.ts || Date.now()
    };
    // nếu đang xem bảng xếp hạng thì refresh
    const page = document.getElementById("page-rank");
    if (page && !page.classList.contains("hidden")) renderRankPage();
  }

  if (msg.type === "presence_left" && msg.username) {
    // Xóa theo deviceId nếu có, nếu không xóa tất cả device của user đó
    if (msg.deviceId) {
      delete remotePresence[msg.username + "|" + msg.deviceId];
    } else {
      Object.keys(remotePresence).forEach(k => {
        if (k.startsWith(msg.username + "|")) delete remotePresence[k];
      });
    }
    const page = document.getElementById("page-rank");
    if (page && !page.classList.contains("hidden")) renderRankPage();
  }

  if (msg.type === "presence_snapshot" && msg.list) {
    remotePresence = {};
    (msg.list || []).forEach(p => {
      if (p && p.username) {
        const devId = p.deviceId || "unknown";
        remotePresence[p.username + "|" + devId] = {
          username: p.username,
          fullname: p.fullname || p.username,
          status: p.status || "online",
          deviceId: devId,
          ts: p.ts || Date.now()
        };
      }
    });
    const page = document.getElementById("page-rank");
    if (page && !page.classList.contains("hidden")) renderRankPage();
  }

  if (msg.type === "history_updated") {
    // ai đó nộp bài → cập nhật rank
    const page = document.getElementById("page-rank");
    if (page && !page.classList.contains("hidden")) renderRankPage();
  }
}

// Ghi đè updatePresence để vừa localStorage vừa WS
const _origUpdatePresence = updatePresence;
updatePresence = function(status) {
  _origUpdatePresence(status);
  if (currentUser) {
    wsSend({
      type: "presence",
      username: currentUser.username,
      fullname: currentUser.fullname,
      status: status || "online",
      deviceId: getDeviceFingerprint(),
      ts: Date.now()
    });
  }
};

const _origClearPresence = clearPresence;
clearPresence = function() {
  if (currentUser) {
    wsSend({
      type: "presence_left",
      username: currentUser.username,
      deviceId: getDeviceFingerprint()
    });
  }
  _origClearPresence();
};

// Gộp presence: ưu tiên WS, fallback localStorage – vẫn unique theo username (cho bảng xếp hạng)
const _origGetPresenceList = getPresenceList;
getPresenceList = function() {
  const local = _origGetPresenceList();
  if (!wsConnected) return local;

  // merge remote + local, unique theo username (exam ưu tiên)
  const map = {};
  local.forEach(p => { map[p.username] = p; });
  Object.values(remotePresence).forEach(p => {
    if (p && p.username && p.ts && (Date.now() - p.ts) < 120000) {
      const prev = map[p.username];
      if (!prev || (p.status === "exam" && prev.status !== "exam")) {
        map[p.username] = p;
      }
    }
  });
  return Object.values(map);
};

// Khi nộp bài xong → báo rank cập nhật
const _origAutoSubmitForWS = null;

window.onload = function() {
initFirebase();
startPresenceListener();
loadExamList().catch(e => console.warn("loadExamList", e));
loadPassages().catch(e => console.warn("loadPassages", e));

loadExtraAccounts();
loadLocksAndEdits();
checkLoginState();
updateAdminNav();
startPresenceHeartbeat();
connectWebSocket();

document.body.setAttribute('data-theme', currentTheme);
}
function toggleTheme() {
currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
document.body.setAttribute('data-theme', currentTheme);
document.querySelector('.theme-toggle i').className = currentTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function loadExams(type) {

  if (typeof loadExamsForKy === "function") loadExamsForKy(type);
}
function clickStartExam(id) {
  const exam = sampleExams.find(e => e.id === id);

  const freeIds = [
    'vact_de_1'
    
    'hsa_kh_1','hsa_kh_2','hsa_kh_3','hsa_kh_h',
    'hsa_toan_1', 'hsa_toan_2', 'hsa_toan_3',
    'hsa_van_1', 'hsa_van_2', 'hsa_van_3',
    'hsa_anh_1', 'hsa_anh_2', 'hsa_anh_3'
  ];
  const isFree = exam && freeIds.includes(exam.id);

  if (!currentUser && !isFree) {
    window._pendingExamId = id;
    showLogin();
    return;
  }

  currentExam = exam;
  lastTabBeforeExam = 'thithu';
  document.getElementById('modal-confirm').classList.remove('hidden');
}
function closeConfirmModal() { document.getElementById('modal-confirm').classList.add('hidden'); }
function startExamReal() {
closeConfirmModal();
isReviewMode = false; userAnswers = {}; markedQuestions = {};

const examId = currentExam.id;
const btn = document.getElementById("btn-exit-exam");
if (btn) btn.innerText = "Đang tải đề...";

loadQuestionsForExam(examId).then(qs => {
  if (!qs || !qs.length) {
    alert("Không tải được đề thi. Kiểm tra kết nối hoặc file data.");
    if (btn) btn.innerText = "Nộp bài thi";
    return;
  }
  activeQuestions = qs;
  currentIndex = activeQuestions[0].id;

  loadPassages().then(() => {
    secondsLeft = currentExam.time * 60;
    document.getElementById('navbar').classList.add('hidden');
    document.getElementById('exam-container').classList.remove('hidden');
    document.getElementById('btn-exit-exam').innerText = "Nộp bài thi";
    updateUILayoutMode();
    renderSidebarGrid();
    updateWorkspace();
    clearInterval(examInterval);
    examInterval = setInterval(() => {
      if(isReviewMode) return;
      secondsLeft--;
      updateTimerDisplay();
      if (secondsLeft === 300) playBeep('warn');
      if (secondsLeft === 60) playBeep('warn');
      if(secondsLeft <= 0) { clearInterval(examInterval); playBeep('timeout'); autoSubmit(); }
    }, 1000);
    updateTimerDisplay();
    updatePresence('exam');
    forceFullscreen();
    isExamActive = true;
  });
}).catch(err => {
  console.error(err);
  alert("Lỗi tải đề thi: " + (err && err.message ? err.message : err));
  if (btn) btn.innerText = "Nộp bài thi";
});
}

function updateUILayoutMode() {
const layoutContainer = document.getElementById('exam-main-layout');
const q = activeQuestions.find(item => item.id === currentIndex);
if (q && q.passage) {
layoutContainer.className = "exam-main-layout layout-3-col";
} else {
layoutContainer.className = "exam-main-layout layout-2-col";
}
document.getElementById('exam-header-title').innerText = isReviewMode ? `${currentExam.name} (XEM LẠI)` : currentExam.name;
}
// Chuẩn hóa câu trả lời để so sánh (xử lý dấu phẩy/chấm, khoảng trắng)
function normalizeAnswerStr(str) {
  if (str === null || str === undefined) return '';
  return String(str).trim().toLowerCase().replace(',', '.');
}
function renderSidebarGrid() {
const grid = document.getElementById('sidebar-q-grid');
grid.innerHTML = '';
activeQuestions.forEach(q => {
const i = q.id;
const hasAnswer = userAnswers[i] !== undefined && userAnswers[i] !== '';
const isMarked = !!markedQuestions[i];
// Filter
if (currentQFilter === 'undone' && hasAnswer) return;
if (currentQFilter === 'marked' && !isMarked) return;
const cell = document.createElement('div');
cell.className = 'q-cell';
cell.innerText = i;
if (i === currentIndex) { cell.classList.add('current'); }
else if (isMarked) { cell.classList.add('marked'); }
else if (hasAnswer) { cell.classList.add('done'); }
else { cell.classList.add('undone'); }
if (isReviewMode && i !== currentIndex) {
  if (q.options && q.options.length > 0) {
    if (userAnswers[i] === q.correct) { cell.style.backgroundColor = 'var(--success-color)'; }
    else if (hasAnswer) { cell.style.backgroundColor = 'var(--danger-color)'; }
  } else {
    // Với câu nhập đáp án
    const isTextCorrect = normalizeAnswerStr(userAnswers[i]) === normalizeAnswerStr(q.answer);
    if (isTextCorrect) { cell.style.backgroundColor = 'var(--success-color)'; }
    else if (hasAnswer) { cell.style.backgroundColor = 'var(--danger-color)'; }
  }
}
cell.onclick = () => { currentIndex = i; updateUILayoutMode(); updateWorkspace(); renderSidebarGrid(); };
grid.appendChild(cell);
});
const doneCnt = Object.values(userAnswers).filter(val => val !== undefined && val !== '').length;
document.getElementById('sidebar-progress-text').innerText = `${doneCnt}/${activeQuestions.length} câu`;
document.getElementById('sidebar-progress-fill').style.width = `${(doneCnt/activeQuestions.length)*100}%`;
}
function updateWorkspace() {
const space = document.getElementById('exam-dynamic-workspace');
space.innerHTML = '';
const q = activeQuestions.find(item => item.id === currentIndex);
if(!q) return;
if (q.passage) {
const colPassage = document.createElement('div');
colPassage.className = 'panel-scroll border-r';
colPassage.innerHTML = `<div class="passage-box">${passages[q.passage]}</div>`;
const colQuestion = document.createElement('div');
colQuestion.className = 'panel-scroll border-r';
colQuestion.appendChild(renderSingleQuestionBlock(q));
space.appendChild(colPassage);
space.appendChild(colQuestion);
} else {
const colQuestion = document.createElement('div');
colQuestion.className = 'panel-scroll border-r';
colQuestion.style.gridColumn = "span 1";
colQuestion.appendChild(renderSingleQuestionBlock(q));
space.appendChild(colQuestion);
}
}
function renderSingleQuestionBlock(question) {
const block = document.createElement('div');
const titleContainer = document.createElement('div');
titleContainer.className = 'question-title-container';
titleContainer.innerHTML = `<div class="question-badge">${question.id}</div> <span style="white-space: pre-line;">${question.question}</span>`;
block.appendChild(titleContainer);
// === ĐOẠN CODE HIỂN THỊ ẢNH (CHÈN VÀO ĐÂY) ===
    if (question.image) {
      const imgBox = document.createElement('div');
      imgBox.style.cssText = "text-align: center; margin: 15px 0;";
      const imgEl = document.createElement('img');
      imgEl.src = question.image;
      imgEl.alt = `Hình minh họa câu ${question.id}`;
      imgEl.style.cssText = "max-width: 100%; max-height: 350px; height: auto; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 2px 8px rgba(0,0,0,0.15);";
      imgBox.appendChild(imgEl);
      block.appendChild(imgBox);
    }
    // ============================================
if (!isReviewMode) {
const markBtn = document.createElement('button');
markBtn.className = "btn";
markBtn.style.cssText = "margin-bottom:20px; background-color:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--border-color);";
markBtn.innerHTML = markedQuestions[question.id] ? `<i class="fa-solid fa-flag" style="color:var(--warning-color)"></i> Bỏ đánh dấu` : `<i class="fa-regular fa-flag"></i> Đánh dấu câu hỏi`;
markBtn.onclick = () => { markedQuestions[question.id] = !markedQuestions[question.id]; renderSidebarGrid(); updateWorkspace(); };
block.appendChild(markBtn);
}
// Kiểm tra xem câu hỏi có trắc nghiệm (options) hay nhập đáp án trực tiếp
if (question.options && question.options.length > 0) {
  // CÂU HỎI TRẮC NGHIỆM MULTIPLE CHOICE
  const group = document.createElement('div');
  group.className = 'options-group';
  question.options.forEach((opt, idx) => {
    const box = document.createElement('div');
    box.className = 'option-box';
    let isSel = userAnswers[question.id] === idx;
    if(isSel) box.classList.add('selected');
    let radioIcon = isSel ? `<i class="fa-solid fa-circle-dot" style="color:var(--primary-light)"></i>` : `<i class="fa-regular fa-circle"></i>`;
    box.innerHTML = `${radioIcon} <span>${opt}</span>`;
    if(!isReviewMode) {
      box.onclick = () => {
        userAnswers[question.id] = idx;
        renderSidebarGrid();
        updateWorkspace();
      };
    } else {
      if (idx === question.correct) {
        box.className = "option-box correct";
        box.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${opt}</span> <span class="result-status-tag"><i class="fa-solid fa-check"></i> Đúng</span>`;
      } else if (isSel) {
        box.className = "option-box incorrect";
        box.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <span>${opt}</span>`;
      }
    }
    group.appendChild(box);
  });
  block.appendChild(group);
} else {
  // CÂU HỎI ĐIỀN ĐÁP ÁN (FILL-IN-THE-BLANK)
  const inputGroup = document.createElement('div');
  inputGroup.className = 'text-answer-group';
  const label = document.createElement('label');
  label.style.cssText = "font-size:14px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:5px;";
  label.innerText = "Điền đáp án của bạn:";
  inputGroup.appendChild(label);
  const inputEl = document.createElement('input');
  inputEl.type = "text";
  inputEl.className = "text-answer-input";
  inputEl.placeholder = "Nhập đáp án (ví dụ: 0,00 hoặc 15/3(nếu không yêu cầu làm tròn) )...";
  inputEl.value = userAnswers[question.id] !== undefined ? userAnswers[question.id] : "";
  if (!isReviewMode) {
    inputEl.oninput = (e) => {
      userAnswers[question.id] = e.target.value;
      renderSidebarGrid();
    };
  } else {
    inputEl.disabled = true;
    const isCorrect = normalizeAnswerStr(userAnswers[question.id]) === normalizeAnswerStr(question.answer);
    const resBox = document.createElement('div');
    resBox.className = `text-answer-result ${isCorrect ? 'correct' : 'incorrect'}`;
    if (isCorrect) {
      resBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> Chính xác! Đáp án: <b>${question.answer}</b>`;
    } else {
      const userVal = userAnswers[question.id] ? userAnswers[question.id] : "(Bỏ trống)";
      resBox.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Bạn nhập: <b>${userVal}</b> | Đáp án đúng: <b>${question.answer}</b>`;
    }
    inputGroup.appendChild(resBox);
  }
  inputGroup.insertBefore(inputEl, inputGroup.children[1]);
  block.appendChild(inputGroup);
}
if (isReviewMode) {
const exp = document.createElement('div');
exp.className = 'explanation-box';
exp.innerHTML = `<div style="font-weight:bold; color:var(--warning-color); margin-bottom:6px;"><i class="fa-regular fa-lightbulb"></i> Lời giải chi tiết</div><p style="font-size:14px; line-height:1.6; color:var(--text-main);">${question.explanation}</p>`; 
block.appendChild(exp);
}
return block;
}
function navQuestion(dir) {
let currIdx = activeQuestions.findIndex(item => item.id === currentIndex);
let targetIdx = currIdx + dir;
if(targetIdx >= 0 && targetIdx < activeQuestions.length) {
currentIndex = activeQuestions[targetIdx].id;
updateUILayoutMode();
updateWorkspace();
renderSidebarGrid();
}
}
function forceFullscreen() {
const el = document.documentElement;
if (el.requestFullscreen) el.requestFullscreen();
}
function forceReturnFullscreen() { forceFullscreen(); }
document.addEventListener('fullscreenchange', () => {
if (!isExamActive || isReviewMode) return;
const isFull = document.fullscreenElement;
if (!isFull) {
document.getElementById('modal-cheat').classList.remove('hidden');
cheatSecondsLeft = 5;
document.getElementById('cheat-countdown').innerText = cheatSecondsLeft;
clearInterval(cheatInterval);
cheatInterval = setInterval(() => {
cheatSecondsLeft--;
document.getElementById('cheat-countdown').innerText = cheatSecondsLeft;
if(cheatSecondsLeft <= 0) { clearInterval(cheatInterval); autoSubmit(); }
}, 1000);
} else {
clearInterval(cheatInterval);
document.getElementById('modal-cheat').classList.add('hidden');
}
});
function triggerExitOrSubmit() {
if (isReviewMode) { exitToHome(); }
else {
  const doneCnt = Object.values(userAnswers).filter(v => v !== undefined && v !== '').length;
  const total = activeQuestions.length;
  const msg = `Bạn đã làm ${doneCnt}/${total} câu.\n\nXác nhận NỘP BÀI?\nSau khi nộp sẽ không thể sửa.`;
  if (confirm(msg)) { playBeep('submit'); autoSubmit(); }
}
}
function autoSubmit() {
isExamActive = false;
clearInterval(examInterval); clearInterval(cheatInterval);
updatePresence('online');
document.getElementById('modal-cheat').classList.add('hidden');
if(document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen().catch(()=>{}); }
let correctCount = 0;
activeQuestions.forEach(q => {
  if (q.options && q.options.length > 0) {
    if(userAnswers[q.id] === q.correct) correctCount++;
  } else {
    if(normalizeAnswerStr(userAnswers[q.id]) === normalizeAnswerStr(q.answer)) correctCount++;
  }
});
examHistory.unshift({
timeStr: new Date().toLocaleString('vi-VN'),
name: currentExam.name,
scoreText: `${correctCount}/${activeQuestions.length}`,
savedAnswers: { ...userAnswers },
savedQuestions: JSON.parse(JSON.stringify(activeQuestions)),
savedExamObj: currentExam
});
// Lưu lịch sử vào localStorage theo tài khoản
if (currentUser && currentUser.username) {
  saveUserHistory(currentUser.username, examHistory);
  // Realtime: thông báo bảng xếp hạng cập nhật
  if (typeof wsSend === "function") {
    wsSend({
      type: "history_updated",
      username: currentUser.username,
      fullname: currentUser.fullname,
      scoreText: examHistory[0] ? examHistory[0].scoreText : "",
      name: examHistory[0] ? examHistory[0].name : ""
    });
  }
}
document.getElementById('result-score-text').innerText = `Kết quả chấm điểm trực tiếp: ${correctCount} / ${activeQuestions.length} câu đúng`;
document.getElementById('modal-result').classList.remove('hidden');
}
function reviewCurrentExam() {
document.getElementById('modal-result').classList.add('hidden');
isReviewMode = true;
document.getElementById('btn-exit-exam').innerText = "Quay lại";
document.getElementById('bottom-timer-clock').innerText = "00:00";
currentIndex = activeQuestions[0].id;
updateUILayoutMode();
renderSidebarGrid();
updateWorkspace();
}
function exitToHome() {
document.getElementById('modal-result').classList.add('hidden');
document.getElementById('exam-container').classList.add('hidden');
document.getElementById('navbar').classList.remove('hidden');
// Quay về trang trước khi vào thi (thay vì luôn về trang chủ)
switchTab(lastTabBeforeExam || 'home');
}
function renderHistoryTable() {
  const tbody = document.getElementById('history-list-body');
  const btnClear = document.getElementById('btn-clear-history');
  tbody.innerHTML = '';

  // Khóa nút xóa hết mặc định
  if (btnClear) {
    btnClear.disabled = true;
    btnClear.title = "Chưa có lịch sử để xóa";
  }

  if (!currentUser) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">
      <i class="fa-solid fa-lock" style="font-size:24px; margin-bottom:8px; display:block;"></i>
      Vui lòng <b>đăng nhập</b> để xem và quản lý lịch sử làm bài.
    </td></tr>`;
    return;
  }

  if (examHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">
      Chưa có bài thi nào trong lịch sử.<br>
      <span style="font-size:13px;">Hãy làm bài để lịch sử xuất hiện tại đây.</span>
    </td></tr>`;
    return;
  }

  // Có dữ liệu → mở khóa nút xóa hết
  if (btnClear) {
    btnClear.disabled = false;
    btnClear.title = "Xóa toàn bộ lịch sử làm bài";
  }

  examHistory.forEach((h, index) => {
    tbody.innerHTML += `<tr>
      <td>${h.timeStr}</td>
      <td><b>${h.name}</b></td>
      <td>Vừa xong</td>
      <td style="color:var(--success-color); font-weight:bold;">${h.scoreText} Câu đúng</td>
      <td>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-success" onclick="viewHistoryItem(${index})" style="padding:6px 12px;">
            <i class="fa-solid fa-eye"></i> Xem lại
          </button>
          <button class="btn btn-danger" onclick="deleteHistoryItem(${index})" title="Xóa bài này" style="padding:6px 12px;">
            <i class="fa-solid fa-trash"></i> Xóa
          </button>
        </div>
      </td>
    </tr>`;
  });
}

// ========== XÁC NHẬN XÓA AN TOÀN ==========
let _pendingDelete = null; // { type: 'single'|'all', index?: number }

function deleteHistoryItem(index) {
  if (!currentUser) return;
  _pendingDelete = { type: 'single', index: index };
  const item = examHistory[index];
  document.getElementById('delete-modal-title').innerText = 'Xóa bài làm này?';
  document.getElementById('delete-modal-msg').innerHTML = 
    `Bạn sắp xóa bài <b>${item ? item.name : ''}</b> (${item ? item.scoreText : ''} câu đúng).<br>Hành động này <b>không thể hoàn tác</b>.`;
  document.getElementById('delete-type-confirm').style.display = 'none';
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('btn-confirm-delete').disabled = false;
  document.getElementById('modal-delete-confirm').classList.remove('hidden');
}

function clearAllHistory() {
  if (!currentUser) return;
  if (examHistory.length === 0) return;
  _pendingDelete = { type: 'all' };
  document.getElementById('delete-modal-title').innerText = 'Xóa TOÀN BỘ lịch sử?';
  document.getElementById('delete-modal-msg').innerHTML = 
    `Bạn sắp xóa <b style="color:var(--danger-color);">${examHistory.length} bài làm</b> trong lịch sử.<br>
     Hành động này <b>không thể hoàn tác</b>. Vui lòng xác nhận bằng cách gõ chữ <b>XÓA</b>.`;
  document.getElementById('delete-type-confirm').style.display = 'block';
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('btn-confirm-delete').disabled = true;
  document.getElementById('modal-delete-confirm').classList.remove('hidden');
  // focus input
  setTimeout(() => {
    const inp = document.getElementById('delete-confirm-input');
    if (inp) inp.focus();
  }, 100);
}

function closeDeleteModal() {
  document.getElementById('modal-delete-confirm').classList.add('hidden');
  _pendingDelete = null;
  document.getElementById('delete-confirm-input').value = '';
}

function executeDelete() {
  if (!_pendingDelete || !currentUser) {
    closeDeleteModal();
    return;
  }
  
  // Nếu là xóa toàn bộ → bắt buộc gõ đúng "XÓA"
  if (_pendingDelete.type === 'all') {
    const typed = document.getElementById('delete-confirm-input').value.trim().toUpperCase();
    if (typed !== 'XÓA' && typed !== 'XOA') {
      alert('Vui lòng gõ chính xác chữ "XÓA" để xác nhận!');
      return;
    }
    examHistory = [];
  } else if (_pendingDelete.type === 'single') {
    examHistory.splice(_pendingDelete.index, 1);
  }
  
  saveUserHistory(currentUser.username, examHistory);
  closeDeleteModal();
  renderHistoryTable();
}

// Cho phép nhấn Enter trong ô xác nhận
document.addEventListener('DOMContentLoaded', function() {
  const inp = document.getElementById('delete-confirm-input');
  if (inp) {
    inp.addEventListener('input', function() {
      const val = this.value.trim().toUpperCase();
      const btn = document.getElementById('btn-confirm-delete');
      if (btn && _pendingDelete && _pendingDelete.type === 'all') {
        btn.disabled = !(val === 'XÓA' || val === 'XOA');
      }
    });
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeDelete();
      }
    });
  }
});

function viewHistoryItem(index) {
const h = examHistory[index];
currentExam = h.savedExamObj;
activeQuestions = h.savedQuestions;
userAnswers = h.savedAnswers;
isReviewMode = true;
lastTabBeforeExam = 'history'; // Quay lại trang lịch sử khi thoát xem lại
document.getElementById('navbar').classList.add('hidden');
document.getElementById('exam-container').classList.remove('hidden');
document.getElementById('btn-exit-exam').innerText = "Quay lại";
document.getElementById('bottom-timer-clock').innerText = "00:00";
currentIndex = activeQuestions[0].id;
updateUILayoutMode();
renderSidebarGrid();
updateWorkspace();
}

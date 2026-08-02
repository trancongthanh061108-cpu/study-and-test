/**
 * data-loader.js – Tải đề thi & passages từ file JSON khi cần
 * Giữ nguyên tên biến global để tương thích app.js
 */
let passages = {};
let sampleExams = [];
const _questionCache = {};

const EXAM_FILES = {
  "hsa_anh_1": "data/anh/de1.json",
  "hsa_anh_10": "data/anh/de10.json",
  "hsa_anh_11": "data/anh/de11.json",
  "hsa_anh_12": "data/anh/de12.json",
  "hsa_anh_13": "data/anh/de13.json",
  "hsa_anh_14": "data/anh/de14.json",
  "hsa_anh_15": "data/anh/de15.json",
  "hsa_anh_16": "data/anh/de16.json",
  "hsa_anh_17": "data/anh/de17.json",
  "hsa_anh_18": "data/anh/de18.json",
  "hsa_anh_19": "data/anh/de19.json",
  "hsa_anh_2": "data/anh/de2.json",
  "hsa_anh_20": "data/anh/de20.json",
  "hsa_anh_21": "data/anh/de21.json",
  "hsa_anh_22": "data/anh/de22.json",
  "hsa_anh_23": "data/anh/de23.json",
  "hsa_anh_24": "data/anh/de24.json",
  "hsa_anh_25": "data/anh/de25.json",
  "hsa_anh_26": "data/anh/de26.json",
  "hsa_anh_27": "data/anh/de27.json",
  "hsa_anh_28": "data/anh/de28.json",
  "hsa_anh_29": "data/anh/de29.json",
  "hsa_anh_3": "data/anh/de3.json",
  "hsa_anh_30": "data/anh/de30.json",
  "hsa_anh_31": "data/anh/de31.json",
  "hsa_anh_32": "data/anh/de32.json",
  "hsa_anh_33": "data/anh/de33.json",
  "hsa_anh_34": "data/anh/de34.json",
  "hsa_anh_35": "data/anh/de35.json",
  "hsa_anh_4": "data/anh/de4.json",
  "hsa_anh_5": "data/anh/de5.json",
  "hsa_anh_6": "data/anh/de6.json",
  "hsa_anh_7": "data/anh/de7.json",
  "hsa_anh_8": "data/anh/de8.json",
  "hsa_anh_9": "data/anh/de9.json",
    "hsa_kh_1": "data/tonghop/deall1.json",

  "hsa_kh_d": "data/tonghop/ded924.json",
  "hsa_kh_h": "data/tonghop/deh924.json",
  "hsa_kh_l": "data/tonghop/del924.json",
  "hsa_kh_s": "data/tonghop/des924.json",
  "hsa_kh_sh": "data/tonghop/desh924.json",
  "hsa_toan_1": "data/toan/de1.json",
    "hsa_toan_11": "data/toan/de11.json", 
    "hsa_toan_12": "data/toan/de12.json",
    "hsa_toan_13": "data/toan/de13.json",
    "hsa_toan_14": "data/toan/de14.json",
    "hsa_toan_15": "data/toan/de15.json",
    "hsa_toan_17": "data/toan/de17.json",
    "hsa_toan_18": "data/toan/de18.json",
    "hsa_toan_19": "data/toan/de19.json",
    "hsa_toan_20": "data/toan/de20.json",
    "hsa_toan_21": "data/toan/de21.json",
    "hsa_toan_22": "data/toan/de22.json",
    "hsa_toan_23": "data/toan/de23.json",
    "hsa_toan_24": "data/toan/de24.json",
    "hsa_toan_25": "data/toan/de25.json",
    "hsa_toan_26": "data/toan/de26.json",
    "hsa_toan_27": "data/toan/de27.json",
    "hsa_toan_28": "data/toan/de28.json",
    "hsa_toan_29": "data/toan/de29.json",
    "hsa_toan_30": "data/toan/de30.json",
    "hsa_toan_31": "data/toan/de31.json",
    "hsa_toan_32": "data/toan/de32.json",
    "hsa_toan_33": "data/toan/de33.json",
    "hsa_toan_34": "data/toan/de34.json",
    "hsa_toan_35": "data/toan/de35.json",
    "hsa_toan_36": "data/toan/de36.json",
    "hsa_toan_37": "data/toan/de37.json",
    "hsa_toan_38": "data/toan/de38.json",
    "hsa_toan_39": "data/toan/de39.json",
      "hsa_toan_40": "data/toan/de40.json",
    "hsa_toan_41": "data/toan/de41.json",
    "hsa_toan_42": "data/toan/de42.json",
    "hsa_toan_43": "data/toan/de43.json",
  "hsa_toan_10": "data/toan/de10.json",
  "hsa_toan_2": "data/toan/de2.json",
  "hsa_toan_3": "data/toan/de3.json",
  "hsa_toan_4": "data/toan/de4.json",
  "hsa_toan_5": "data/toan/de5.json",
  "hsa_toan_6": "data/toan/de6.json",
  "hsa_toan_7": "data/toan/de7.json",
  "hsa_toan_8": "data/toan/de8.json",
  "hsa_toan_9": "data/toan/de9.json",
  "hsa_van_1": "data/van/de1.json",
  "hsa_van_10": "data/van/de10.json",
  "hsa_van_11": "data/van/de11.json",
  "hsa_van_12": "data/van/de12.json",
  "hsa_van_13": "data/van/de13.json",
  "hsa_van_14": "data/van/de14.json",
  "hsa_van_15": "data/van/de15.json",
  "hsa_van_16": "data/van/de16.json",
  "hsa_van_17": "data/van/de17.json",
  "hsa_van_18": "data/van/de18.json",
  "hsa_van_19": "data/van/de19.json",
  "hsa_van_2": "data/van/de2.json",
  "hsa_van_20": "data/van/de20.json",
  "hsa_van_21": "data/van/de21.json",
  "hsa_van_22": "data/van/de22.json",
  "hsa_van_23": "data/van/de23.json",
  "hsa_van_24": "data/van/de24.json",
  "hsa_van_25": "data/van/de25.json",
  "hsa_van_26": "data/van/de26.json",
  "hsa_van_27": "data/van/de27.json",
  "hsa_van_28": "data/van/de28.json",
  "hsa_van_29": "data/van/de29.json",
  "hsa_van_3": "data/van/de3.json",
  "hsa_van_30": "data/van/de30.json",
  "hsa_van_31": "data/van/de31.json",
  "hsa_van_32": "data/van/de32.json",
  "hsa_van_33": "data/van/de33.json",
  "hsa_van_34": "data/van/de34.json",
  "hsa_van_35": "data/van/de35.json",
  "hsa_van_36": "data/van/de36.json",
  "hsa_van_37": "data/van/de37.json",
  "hsa_van_38": "data/van/de38.json",
  "hsa_van_39": "data/van/de39.json",
  "hsa_van_4": "data/van/de4.json",
  "hsa_van_5": "data/van/de5.json",
  "hsa_van_6": "data/van/de6.json",
  "hsa_van_7": "data/van/de7.json",
  "hsa_van_8": "data/van/de8.json",
  "hsa_van_9": "data/van/de9.json",
};

async function loadPassages() {
  if (Object.keys(passages).length) return passages;
  const res = await fetch("data/passages.json");
  passages = await res.json();
  return passages;
}

async function loadExamList() {
  if (sampleExams.length) return sampleExams;
  const res = await fetch("data/exams.json");
  sampleExams = await res.json();
  return sampleExams;
}

async function loadQuestionsForExam(examId) {
  if (_questionCache[examId]) {
    return JSON.parse(JSON.stringify(_questionCache[examId]));
  }
  const path = EXAM_FILES[examId];
  if (!path) {
    console.error("Không tìm thấy file đề:", examId);
    return [];
  }
  const res = await fetch(path);
  if (!res.ok) {
    console.error("Lỗi tải đề:", path, res.status);
    return [];
  }
  const data = await res.json();
  _questionCache[examId] = data;
  return JSON.parse(JSON.stringify(data));
}

// Export cho app
window.loadPassages = loadPassages;
window.loadExamList = loadExamList;
window.loadQuestionsForExam = loadQuestionsForExam;
window.EXAM_FILES = EXAM_FILES;

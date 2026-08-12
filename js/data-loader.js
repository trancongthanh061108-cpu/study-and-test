/**
 * data-loader.js – Tải đề thi & passages từ file JSON khi cần
 * Giữ nguyên tên biến global để tương thích app.js
 */
let passages = {};
let sampleExams = [];
const _questionCache = {};

const EXAM_FILES = {
  "hsa_anh_1": "data/hsa/anh/de1.json",
  "hsa_anh_10": "data/hsa/anh/de10.json",
  "hsa_anh_11": "data/hsa/anh/de11.json",
  "hsa_anh_12": "data/hsa/anh/de12.json",
  "hsa_anh_13": "data/hsa/anh/de13.json",
  "hsa_anh_14": "data/hsa/anh/de14.json",
  "hsa_anh_15": "data/hsa/anh/de15.json",
  "hsa_anh_16": "data/hsa/anh/de16.json",
  "hsa_anh_17": "data/hsa/anh/de17.json",
  "hsa_anh_18": "data/hsa/anh/de18.json",
  "hsa_anh_19": "data/hsa/anh/de19.json",
  "hsa_anh_2": "data/hsa/anh/de2.json",
  "hsa_anh_20": "data/hsa/anh/de20.json",
  "hsa_anh_21": "data/hsa/anh/de21.json",
  "hsa_anh_22": "data/hsa/anh/de22.json",
  "hsa_anh_23": "data/hsa/anh/de23.json",
  "hsa_anh_24": "data/hsa/anh/de24.json",
  "hsa_anh_25": "data/hsa/anh/de25.json",
  "hsa_anh_26": "data/hsa/anh/de26.json",
  "hsa_anh_27": "data/hsa/anh/de27.json",
  "hsa_anh_28": "data/hsa/anh/de28.json",
  "hsa_anh_29": "data/hsa/anh/de29.json",
  "hsa_anh_3": "data/hsa/anh/de3.json",
  "hsa_anh_30": "data/hsa/anh/de30.json",
  "hsa_anh_31": "data/hsa/anh/de31.json",
  "hsa_anh_32": "data/hsa/anh/de32.json",
  "hsa_anh_33": "data/hsa/anh/de33.json",
  "hsa_anh_34": "data/hsa/anh/de34.json",
  "hsa_anh_35": "data/hsa/anh/de35.json",
  "hsa_anh_4": "data/hsa/anh/de4.json",
  "hsa_anh_5": "data/hsa/anh/de5.json",
  "hsa_anh_6": "data/hsa/anh/de6.json",
  "hsa_anh_7": "data/hsa/anh/de7.json",
  "hsa_anh_8": "data/hsa/anh/de8.json",
  "hsa_anh_9": "data/hsa/anh/de9.json",
  
    "hsa_kh_1": "data/hsa/khoa học/deall1.json",
    "hsa_kh_2": "data/hsa/khoa học/deall2.json",
    "hsa_kh_3": "data/hsa/khoa học/deall3.json",
    "hsa_kh_4": "data/hsa/khoa học/deall4.json",
    "hsa_kh_5": "data/hsa/khoa học/deall5.json",
    "hsa_kh_6": "data/hsa/khoa học/deall6.json",
    "hsa_kh_7": "data/hsa/khoa học/deall7.json",
    "hsa_kh_8": "data/hsa/khoa học/deall8.json",
    "hsa_kh_25": "data/hsa/khoa học/deall25.json",
    "hsa_kh_27": "data/hsa/khoa học/deall27.json",
    "hsa_kh_28": "data/hsa/khoa học/deall28.json",
    "hsa_kh_29": "data/hsa/khoa học/deall29.json",
    "hsa_kh_30": "data/hsa/khoa học/deall30.json",
    "hsa_kh_31": "data/hsa/khoa học/deall32.json",
    "hsa_kh_32": "data/hsa/khoa học/deall32.json",
    "hsa_kh_33": "data/hsa/khoa học/deall33.json",
    "hsa_kh_34": "data/hsa/khoa học/deall34.json",
    "hsa_kh_35": "data/hsa/khoa học/deall35.json",
    "hsa_kh_d": "data/hsa/khoa học/ded924.json",
    "hsa_kh_h": "data/hsa/khoa học/deh924.json",
    "hsa_kh_s": "data/hsa/khoa học/des924.json",
    "hsa_kh_sh": "data/hsa/khoa học/desh924.json",
  
"hsa_toan_1": "data/hsa/toán/de1.json",
"hsa_toan_11": "data/hsa/toán/de11.json", 
"hsa_toan_12": "data/hsa/toán/de12.json",
"hsa_toan_13": "data/hsa/toán/de13.json",
"hsa_toan_14": "data/hsa/toán/de14.json",
"hsa_toan_15": "data/hsa/toán/de15.json",
"hsa_toan_17": "data/hsa/toán/de17.json",
"hsa_toan_18": "data/hsa/toán/de18.json",
"hsa_toan_19": "data/hsa/toán/de19.json",
"hsa_toan_20": "data/hsa/toán/de20.json",
"hsa_toan_21": "data/hsa/toán/de21.json",
"hsa_toan_22": "data/hsa/toán/de22.json",
"hsa_toan_23": "data/hsa/toán/de23.json",
"hsa_toan_24": "data/hsa/toán/de24.json",
"hsa_toan_25": "data/hsa/toán/de25.json",
"hsa_toan_26": "data/hsa/toán/de26.json",
"hsa_toan_27": "data/hsa/toán/de27.json",
"hsa_toan_28": "data/hsa/toán/de28.json",
"hsa_toan_29": "data/hsa/toán/de29.json",
"hsa_toan_30": "data/hsa/toán/de30.json",
"hsa_toan_31": "data/hsa/toán/de31.json",
"hsa_toan_32": "data/hsa/toán/de32.json",
"hsa_toan_33": "data/hsa/toán/de33.json",
"hsa_toan_34": "data/hsa/toán/de34.json",
"hsa_toan_35": "data/hsa/toán/de35.json",
"hsa_toan_36": "data/hsa/toán/de36.json",
"hsa_toan_37": "data/hsa/toán/de37.json",
"hsa_toan_38": "data/hsa/toán/de38.json",
"hsa_toan_39": "data/hsa/toán/de39.json",
"hsa_toan_40": "data/hsa/toán/de40.json",
"hsa_toan_41": "data/hsa/toán/de41.json",
"hsa_toan_42": "data/hsa/toán/de42.json",
"hsa_toan_43": "data/hsa/toán/de43.json",
"hsa_toan_10": "data/hsa/toán/de10.json",
"hsa_toan_2": "data/hsa/toán/de2.json",
"hsa_toan_3": "data/hsa/toán/de3.json",
"hsa_toan_4": "data/hsa/toán/de4.json",
"hsa_toan_5": "data/hsa/toán/de5.json",
"hsa_toan_6": "data/hsa/toán/de6.json",
"hsa_toan_7": "data/hsa/toán/de7.json",
"hsa_toan_8": "data/hsa/toán/de8.json",
"hsa_toan_9": "data/hsa/toán/de9.json",
  
    "hsa_van_1": "data/hsa/văn/de1.json",
    "hsa_van_10": "data/hsa/văn/de10.json",
    "hsa_van_11": "data/hsa/văn/de11.json",
    "hsa_van_12": "data/hsa/văn/de12.json",
    "hsa_van_13": "data/hsa/văn/de13.json",
    "hsa_van_14": "data/hsa/văn/de14.json",
    "hsa_van_15": "data/hsa/văn/de15.json",
    "hsa_van_16": "data/hsa/văn/de16.json",
    "hsa_van_17": "data/hsa/văn/de17.json",
    "hsa_van_18": "data/hsa/văn/de18.json",
    "hsa_van_19": "data/hsa/văn/de19.json",
    "hsa_van_2": "data/hsa/văn/de2.json",
    "hsa_van_20": "data/hsa/văn/de20.json",
    "hsa_van_21": "data/hsa/văn/de21.json",
    "hsa_van_22": "data/hsa/văn/de22.json",
    "hsa_van_23": "data/hsa/văn/de23.json",
    "hsa_van_24": "data/hsa/văn/de24.json",
    "hsa_van_25": "data/hsa/văn/de25.json",
    "hsa_van_26": "data/hsa/văn/de26.json",
    "hsa_van_27": "data/hsa/văn/de27.json",
    "hsa_van_28": "data/hsa/văn/de28.json",
    "hsa_van_29": "data/hsa/văn/de29.json",
    "hsa_van_3": "data/hsa/văn/de3.json",
    "hsa_van_30": "data/hsa/văn/de30.json",
    "hsa_van_31": "data/hsa/văn/de31.json",
    "hsa_van_32": "data/hsa/văn/de32.json",
    "hsa_van_33": "data/hsa/văn/de33.json",
    "hsa_van_34": "data/hsa/văn/de34.json",
    "hsa_van_35": "data/hsa/văn/de35.json",
    "hsa_van_36": "data/hsa/văn/de36.json",
    "hsa_van_37": "data/hsa/văn/de37.json",
    "hsa_van_38": "data/hsa/văn/de38.json",
    "hsa_van_39": "data/hsa/văn/de39.json",
    "hsa_van_4": "data/hsa/văn/de4.json",
    "hsa_van_5": "data/hsa/văn/de5.json",
    "hsa_van_6": "data/hsa/văn/de6.json",
    "hsa_van_7": "data/hsa/văn/de7.json",
    "hsa_van_8": "data/hsa/văn/de8.json",
    "hsa_van_9": "data/hsa/văn/de9.json",
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

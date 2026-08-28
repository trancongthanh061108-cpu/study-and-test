/**
 * data-loader.js – Tải đề thi & passages từ file JSON khi cần
 * Giữ nguyên tên biến global để tương thích app.js
 */
let passages = {};
let sampleExams = [];
const _questionCache = {};

const EXAM_FILES = {
  "vact_toan_1": "data/Thi thử/VACT/Toán học/de1.json",
  
  "vact_van_1": "data/Thi thử/VACT/Ngữ Văn/de1.json",
  
  "vact_anh_1": "data/Thi thử/VACT/Tiếng Anh/de1.json",
  "vact_anh_2": "data/Thi thử/VACT/Tiếng Anh/de2.json",
  "vact_anh_3": "data/Thi thử/VACT/Tiếng Anh/de3.json",
  

  
  "hsa_anh_1": "data/Thi thử/HSA/Tiếng Anh/de1.json",
  "hsa_anh_2": "data/Thi thử/HSA/Tiếng Anh/de2.json",
  "hsa_anh_3": "data/Thi thử/HSA/Tiếng Anh/de3.json",
  
  "hsa_toan_1": "data/Thi thử/HSA/Tư duy định lượng/de1.json",
  "hsa_toan_2": "data/Thi thử/HSA/Tư duy định lượng/de2.json",
  "hsa_toan_3": "data/Thi thử/HSA/Tư duy định lượng/de3.json",

  "hsa_van_1": "data/Thi thử/HSA/Tư duy định tính/de1.json",
  "hsa_van_2": "data/Thi thử/HSA/Tư duy định tính/de2.json",
  "hsa_van_3": "data/Thi thử/HSA/Tư duy định tính/de3.json",
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

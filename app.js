import { initializePwa } from "./src/pwa.js";
import { $, message } from "./src/ui.js";
import { jsonFile } from "./src/files.js";
import { createApi } from "./src/api.js";
import { formatDate } from "./src/dates.js";
import { loadCalendar, loadMaterials, renderContent } from "./src/content.js";
import { initializeRecruitment } from "./src/recruitment.js";
import { initializeReservations } from "./src/reservations.js";
import { initializeFeedback } from "./src/feedback.js";
import { initializePerformances } from "./src/performances.js";
import { initializeNavigation } from "./src/navigation.js";

let api = null;
const getApi = () => api;
const recruitment = initializeRecruitment(getApi);
const reservations = initializeReservations(getApi);
const performances = initializePerformances(initializeFeedback(getApi, formatDate));
const navigation = initializeNavigation({ reservations, performances, recruitment });

async function initialize() {
  navigation.show();
  recruitment.connect();
  const contentTask = jsonFile("data/content.json").then(content => {
    renderContent(content);
    recruitment.renderSlots(content);
    performances.render(content.performances || []);
    navigation.show();
  }).catch(() => {
    $("introduction").textContent = "내용을 불러올 수 없습니다. 페이지를 새로고침해 주세요.";
    message("schedule-list", "일정을 불러올 수 없습니다.", "error");
    message("guitar-class-content", "기타교실 정보를 불러올 수 없습니다. 페이지를 새로고침해 주세요.", "error");
    throw new Error("CONTENT");
  });
  void loadCalendar();
  void loadMaterials();
  try {
    const [config] = await Promise.all([jsonFile("config.json"), contentTask]);
    api = createApi(config);
    recruitment.connect();
  } catch { message("connection-status", "모집 기능에 연결할 수 없습니다. 운영진에게 문의해 주세요.", "error"); }
  reservations.connect();
  if (location.hash === "#recruitment") void recruitment.refresh();
}

void initialize();

void initializePwa();

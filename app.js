import { initializePwa } from "./src/pwa.js";
import { $, message } from "./src/ui.js";
import { jsonFile } from "./src/files.js";
import { createApi } from "./src/api.js";
import { formatDate } from "./src/dates.js";
import { loadMaterials, renderContent } from "./src/content.js";
import { loadCalendars } from "./src/calendar.js";
import { initializeReservations } from "./src/reservations.js";
import { initializeFeedback } from "./src/feedback.js";
import { initializePerformances } from "./src/performances.js";
import { initializeNavigation } from "./src/navigation.js";

let api = null;
const getApi = () => api;
const reservations = initializeReservations(getApi);
const performances = initializePerformances(initializeFeedback(getApi, formatDate));
const navigation = initializeNavigation({ reservations, performances });

async function initialize() {
  navigation.show();
  const contentTask = jsonFile("data/content.json").then(content => {
    renderContent(content);
    performances.render(content.performances || []);
    navigation.show();
  }).catch(() => {
    $("introduction").textContent = "내용을 불러올 수 없습니다. 페이지를 새로고침해 주세요.";
    message("guitar-class-content", "기타교실 정보를 불러올 수 없습니다. 페이지를 새로고침해 주세요.", "error");
    throw new Error("CONTENT");
  });
  void loadCalendars();
  void loadMaterials();
  try {
    const [config] = await Promise.all([jsonFile("config.json"), contentTask]);
    api = createApi(config);
    } catch { message("connection-status", "예약·피드백 기능에 연결할 수 없습니다. 잠시 후 다시 접속해 주세요.", "error"); }
  reservations.connect();
}

void initialize();

void initializePwa();

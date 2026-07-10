const SUPABASE_URL = "https://vgkyoyosjewdygxtnqvu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZna3lveW9zamV3ZHlneHRucXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTAxNDAsImV4cCI6MjA5ODIyNjE0MH0.oDxSWg61UFLqMh2MeEW6yxarZAjobhEA6TWm0KS_7CA";
const ADMIN_PIN = "2580";

const STORAGE_EMPLOYEE_KEY = "sbmSafetyAcademyEmployee";
const STORAGE_PROGRESS_PREFIX = "sbmSafetyAcademyProgress:";

const state = {
  supabase: null,
  employee: null,
  videos: [],
  categories: [],
  views: new Map(),
  localProgress: {},
  progressSync: {},
  currentVideo: null,
  adminRows: [],
  adminVideos: [],
  adminAuthenticated: false
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  bindEvents();
  boot();
});

function cacheDom() {
  Object.assign(dom, {
    appAlert: document.getElementById("appAlert"),
    registerPanel: document.getElementById("registerPanel"),
    learnerArea: document.getElementById("learnerArea"),
    employeeForm: document.getElementById("employeeForm"),
    fullName: document.getElementById("fullName"),
    cedula: document.getElementById("cedula"),
    projectSite: document.getElementById("projectSite"),
    sessionBadge: document.getElementById("sessionBadge"),
    learnerName: document.getElementById("learnerName"),
    learnerProject: document.getElementById("learnerProject"),
    changeUserBtn: document.getElementById("changeUserBtn"),
    metricPercent: document.getElementById("metricPercent"),
    metricCompleted: document.getElementById("metricCompleted"),
    metricPending: document.getElementById("metricPending"),
    progressSummary: document.getElementById("progressSummary"),
    progressBar: document.getElementById("progressBar"),
    completionPanel: document.getElementById("completionPanel"),
    nextTrainingPanel: document.getElementById("nextTrainingPanel"),
    nextTitle: document.getElementById("nextTitle"),
    nextDescription: document.getElementById("nextDescription"),
    continueNextBtn: document.getElementById("continueNextBtn"),
    videoViewer: document.getElementById("videoViewer"),
    backToLibraryBtn: document.getElementById("backToLibraryBtn"),
    viewerStatus: document.getElementById("viewerStatus"),
    viewerCategory: document.getElementById("viewerCategory"),
    viewerTitle: document.getElementById("viewerTitle"),
    viewerDescription: document.getElementById("viewerDescription"),
    trainingPlayer: document.getElementById("trainingPlayer"),
    externalPlayerWrap: document.getElementById("externalPlayerWrap"),
    externalOpenLink: document.getElementById("externalOpenLink"),
    viewerProgressBar: document.getElementById("viewerProgressBar"),
    viewerProgressText: document.getElementById("viewerProgressText"),
    completeVideoBtn: document.getElementById("completeVideoBtn"),
    openVideoLink: document.getElementById("openVideoLink"),
    viewerSignatureNote: document.getElementById("viewerSignatureNote"),
    videoList: document.getElementById("videoList"),
    emptyState: document.getElementById("emptyState"),
    reloadBtn: document.getElementById("reloadBtn"),
    adminOpenBtn: document.getElementById("adminOpenBtn"),
    adminModal: document.getElementById("adminModal"),
    adminCloseBtn: document.getElementById("adminCloseBtn"),
    adminPinForm: document.getElementById("adminPinForm"),
    adminPin: document.getElementById("adminPin"),
    adminContent: document.getElementById("adminContent"),
    adminRecordsTab: document.getElementById("adminRecordsTab"),
    adminVideosTab: document.getElementById("adminVideosTab"),
    adminRecordsPanel: document.getElementById("adminRecordsPanel"),
    adminVideosPanel: document.getElementById("adminVideosPanel"),
    adminTotalViews: document.getElementById("adminTotalViews"),
    adminCompletedViews: document.getElementById("adminCompletedViews"),
    adminPendingViews: document.getElementById("adminPendingViews"),
    filterPerson: document.getElementById("filterPerson"),
    filterProject: document.getElementById("filterProject"),
    filterVideo: document.getElementById("filterVideo"),
    adminRows: document.getElementById("adminRows"),
    adminEmpty: document.getElementById("adminEmpty"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    newVideoBtn: document.getElementById("newVideoBtn"),
    videoAdminForm: document.getElementById("videoAdminForm"),
    adminVideoId: document.getElementById("adminVideoId"),
    adminVideoCategory: document.getElementById("adminVideoCategory"),
    adminVideoCode: document.getElementById("adminVideoCode"),
    adminVideoTitle: document.getElementById("adminVideoTitle"),
    adminVideoDescription: document.getElementById("adminVideoDescription"),
    adminVideoFilePath: document.getElementById("adminVideoFilePath"),
    adminVideoOrder: document.getElementById("adminVideoOrder"),
    adminVideoActive: document.getElementById("adminVideoActive"),
    cancelVideoEditBtn: document.getElementById("cancelVideoEditBtn"),
    adminVideoList: document.getElementById("adminVideoList"),
    adminVideoEmpty: document.getElementById("adminVideoEmpty")
  });
}

function bindEvents() {
  on(dom.employeeForm, "submit", saveEmployee);
  on(dom.changeUserBtn, "click", changeUser);
  on(dom.reloadBtn, "click", refreshAll);
  on(dom.continueNextBtn, "click", openNextVideo);
  on(dom.backToLibraryBtn, "click", closeVideoViewer);
  on(dom.trainingPlayer, "loadedmetadata", restoreCurrentVideoPosition);
  on(dom.trainingPlayer, "play", () => startVideo(state.currentVideo?.id));
  on(dom.trainingPlayer, "timeupdate", handleCurrentVideoProgress);
  on(dom.trainingPlayer, "pause", syncCurrentVideoProgress);
  on(dom.trainingPlayer, "ended", () => handleCurrentVideoProgress(true));
  on(dom.trainingPlayer, "error", () => {
    if (!state.currentVideo) return;
    showAlert(`El video ${getVideoCode(state.currentVideo)} no se pudo reproducir. Use "Abrir video en pestana nueva" o revise la ruta exacta en GitHub/Supabase.`);
  });
  on(dom.completeVideoBtn, "click", completeCurrentVideo);
  on(dom.adminOpenBtn, "click", openAdmin);
  on(dom.adminCloseBtn, "click", closeAdmin);
  on(dom.adminModal, "click", (event) => {
    if (event.target === dom.adminModal) closeAdmin();
  });
  on(dom.adminPinForm, "submit", unlockAdmin);
  on(dom.adminRecordsTab, "click", () => setAdminTab("records"));
  on(dom.adminVideosTab, "click", () => setAdminTab("videos"));
  [dom.filterPerson, dom.filterProject, dom.filterVideo].forEach((control) => {
    on(control, "input", renderAdminRows);
    on(control, "change", renderAdminRows);
  });
  on(dom.exportCsvBtn, "click", exportExcel);
  on(dom.newVideoBtn, "click", startNewVideoForm);
  on(dom.cancelVideoEditBtn, "click", resetVideoForm);
  on(dom.videoAdminForm, "submit", saveAdminVideo);
}

async function boot() {
  initSupabase();
  restoreEmployee();
  await refreshAll();
}

function initSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    showAlert("No se pudo cargar Supabase JS. Revise la conexion a internet o el CDN configurado.");
    return;
  }
  state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function restoreEmployee() {
  const saved = safeJsonParse(localStorage.getItem(STORAGE_EMPLOYEE_KEY), null);
  if (!saved || !saved.id) return;
  state.employee = saved;
  dom.fullName.value = saved.full_name || "";
  dom.cedula.value = saved.cedula || "";
  dom.projectSite.value = saved.project_site || "";
  loadLocalProgress();
  updateSession();
}

async function refreshAll() {
  clearAlert();
  await Promise.all([loadCategories(), loadVideos()]);
  if (state.employee) await loadViews();
  renderLearnerExperience();
}

async function saveEmployee(event) {
  event.preventDefault();
  if (!requireSupabase()) return;

  const payload = {
    full_name: dom.fullName.value.trim(),
    cedula: dom.cedula.value.trim(),
    project_site: dom.projectSite.value.trim(),
    updated_at: new Date().toISOString()
  };

  if (!payload.full_name || !payload.cedula || !payload.project_site) {
    showAlert("Complete nombre, cedula y proyecto/site para continuar.");
    return;
  }

  setFormBusy(true);
  const { data, error } = await state.supabase
    .rpc("ehs_register_employee", {
      p_full_name: payload.full_name,
      p_cedula: payload.cedula,
      p_project_site: payload.project_site
    });
  setFormBusy(false);

  if (error) {
    showAlert(`No se pudo guardar el colaborador: ${error.message}`);
    return;
  }

  const employee = Array.isArray(data) ? data[0] : data;
  if (!employee?.id) {
    showAlert("No se pudo confirmar el registro del colaborador. Intente nuevamente.");
    return;
  }

  state.employee = employee;
  localStorage.setItem(STORAGE_EMPLOYEE_KEY, JSON.stringify(employee));
  loadLocalProgress();
  updateSession();
  await loadViews();
  renderLearnerExperience();
}

function changeUser() {
  localStorage.removeItem(STORAGE_EMPLOYEE_KEY);
  state.employee = null;
  state.views = new Map();
  state.localProgress = {};
  state.currentVideo = null;
  if (dom.trainingPlayer) {
    dom.trainingPlayer.pause();
    dom.trainingPlayer.removeAttribute("src");
    dom.trainingPlayer.load();
  }
  if (dom.employeeForm) dom.employeeForm.reset();
  renderLearnerExperience();
}

async function loadCategories() {
  state.categories = [];
  if (!requireSupabase(false)) return;
  const { data, error } = await state.supabase
    .from("ehs_training_categories")
    .select("id, name, description, sort_order, active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    showAlert(`No se pudieron cargar las categorias: ${error.message}`);
    return;
  }
  state.categories = data || [];
}

async function loadVideos() {
  state.videos = [];
  if (!requireSupabase(false)) return;
  const { data, error } = await state.supabase
    .from("ehs_training_videos")
    .select("id, category_id, video_code, title, description, file_path, active, sort_order, ehs_training_categories(name)")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("video_code", { ascending: true });
  if (error) {
    showAlert(`No se pudieron cargar los videos: ${error.message}`);
    return;
  }
  state.videos = data || [];
}

async function loadViews() {
  state.views = new Map();
  if (!state.employee || !requireSupabase(false)) return;
  const { data, error } = await state.supabase
    .from("ehs_video_views")
    .select("*")
    .eq("employee_id", state.employee.id);
  if (error) {
    showAlert(`No se pudo cargar el progreso personal: ${error.message}`);
    return;
  }
  (data || []).forEach((view) => state.views.set(view.video_id, view));
}

function renderLearnerExperience() {
  updateSession();
  renderProgress();
  renderNextTraining();
  renderVideoLibrary();
  updateCurrentViewer();
}

function updateSession() {
  const hasEmployee = Boolean(state.employee);
  toggleHidden(dom.registerPanel, hasEmployee);
  toggleHidden(dom.learnerArea, !hasEmployee);

  if (!hasEmployee) {
    setText(dom.sessionBadge, "Sin registro");
    setClassName(dom.sessionBadge, "status-pill pending");
    return;
  }

  setText(dom.sessionBadge, `Registrado: ${state.employee.full_name}`);
  setClassName(dom.sessionBadge, "status-pill completed");
  setText(dom.learnerName, state.employee.full_name || "colaborador");
  setText(dom.learnerProject, `Proyecto: ${state.employee.project_site || "--"}`);
}

function renderProgress() {
  const total = state.videos.length;
  const completed = state.videos.filter((video) => state.views.get(video.id)?.completed).length;
  const pending = Math.max(0, total - completed);
  const percent = total ? Math.round((completed / total) * 100) : 0;

  setText(dom.metricPercent, `${percent}%`);
  setText(dom.metricCompleted, `${completed} de ${total}`);
  setText(dom.metricPending, `${pending}`);
  setText(dom.progressSummary, `${completed} de ${total} completados`);
  setWidth(dom.progressBar, `${percent}%`);
  toggleHidden(dom.completionPanel, !(total > 0 && completed === total));
}

function renderNextTraining() {
  const next = getNextPendingVideo();
  toggleHidden(dom.nextTrainingPanel, !next);
  if (!next) return;
  setText(dom.nextTitle, `${getVideoCode(next)} - ${next.title || "Capacitacion"}`);
  setText(dom.nextDescription, next.description || "Continua con la siguiente capacitacion pendiente de tu ruta.");
  if (dom.continueNextBtn) dom.continueNextBtn.disabled = false;
}

function getNextPendingVideo() {
  return state.videos.find((video) => !state.views.get(video.id)?.completed) || null;
}

function openNextVideo() {
  const next = getNextPendingVideo();
  if (next) openVideo(next.id);
}

function renderVideoLibrary() {
  if (!dom.videoList) return;
  dom.videoList.innerHTML = "";
  toggleHidden(dom.emptyState, state.videos.length > 0);

  state.videos.forEach((video) => {
    const view = state.views.get(video.id);
    const progress = getVideoProgress(video.id, view);
    const status = getStatus(progress, view);
    const card = document.createElement("article");
    card.className = "video-card";
    card.innerHTML = `
      <div class="video-body">
        <div class="video-meta">
          <span class="category-chip">${escapeHtml(getCategoryName(video))}</span>
          <span class="code-chip">${escapeHtml(getVideoCode(video))}</span>
          <span class="status-pill ${status.className}">${status.label}</span>
        </div>
        <div>
          <h3>${escapeHtml(video.title || "Capacitacion sin titulo")}</h3>
          <p class="muted">${escapeHtml(video.description || "Sin descripcion.")}</p>
        </div>
        <p class="muted">Avance del video: <strong>${Math.round(progress)}%</strong></p>
        <div class="video-actions">
          <button class="primary-btn" type="button" data-open-video="${escapeAttribute(video.id)}">Ver video</button>
          <a class="secondary-btn" href="${escapeAttribute(video.file_path || "#")}" target="_blank" rel="noopener">Abrir video en pestana nueva</a>
        </div>
        <p class="muted">Debe firmar RH-F-05 al completar esta capacitacion.</p>
      </div>
    `;
    card.querySelector("[data-open-video]").addEventListener("click", () => openVideo(video.id));
    dom.videoList.appendChild(card);
  });
}

function openVideo(videoId) {
  const video = state.videos.find((item) => item.id === videoId);
  if (!video) {
    showAlert("No se encontro la capacitacion seleccionada.");
    return;
  }
  state.currentVideo = video;
  toggleHidden(dom.videoViewer, false);
  resetExternalPlayer();
  if (isExternalVideo(video.file_path)) {
    toggleHidden(dom.trainingPlayer, true);
    toggleHidden(dom.externalPlayerWrap, false);
    if (dom.externalOpenLink) dom.externalOpenLink.href = video.file_path || "#";
    startVideo(video.id);
    window.open(video.file_path, "_blank", "noopener");
  } else if (dom.trainingPlayer) {
    toggleHidden(dom.trainingPlayer, false);
    toggleHidden(dom.externalPlayerWrap, true);
    dom.trainingPlayer.src = video.file_path || "";
    dom.trainingPlayer.load();
  }
  updateCurrentViewer();
  if (dom.videoViewer) dom.videoViewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeVideoViewer() {
  syncCurrentVideoProgress();
  if (dom.trainingPlayer) dom.trainingPlayer.pause();
  resetExternalPlayer();
  toggleHidden(dom.videoViewer, true);
}

function updateCurrentViewer() {
  const video = state.currentVideo;
  if (!video) return;

  const view = state.views.get(video.id);
  const progress = getVideoProgress(video.id, view);
  const status = getStatus(progress, view);

  setClassName(dom.viewerStatus, `status-pill ${status.className}`);
  setText(dom.viewerStatus, status.label);
  setText(dom.viewerCategory, getCategoryName(video));
  setText(dom.viewerTitle, `${getVideoCode(video)} - ${video.title || "Capacitacion"}`);
  setText(dom.viewerDescription, video.description || "Sin descripcion.");
  if (dom.openVideoLink) dom.openVideoLink.href = video.file_path || "#";
  setWidth(dom.viewerProgressBar, `${Math.min(100, Math.round(progress))}%`);
  if (isExternalVideo(video.file_path) && !view?.completed) {
    setText(dom.viewerProgressText, "Video externo: se abre en una pestana nueva. Al terminar de verlo, regrese y marque como completado.");
  } else {
    setText(dom.viewerProgressText, `Avance visto: ${Math.round(progress)}%. Debe llegar al 95% para completar.`);
  }
  setText(
    dom.viewerSignatureNote,
    isExternalVideo(video.file_path)
      ? "El registro digital no sustituye la firma fisica. Estos videos Vimeo pueden firmarse juntos en una hoja regular de capacitacion."
      : "El registro digital no sustituye la firma fisica. Debe firmar RH-F-05."
  );
  if (dom.completeVideoBtn) {
    dom.completeVideoBtn.disabled = isExternalVideo(video.file_path) ? Boolean(view?.completed) : !isCompleteButtonEnabled(progress, view);
    dom.completeVideoBtn.textContent = view?.completed ? "Completado" : "Marcar como completado";
  }
}

async function startVideo(videoId) {
  if (!videoId || !state.employee || !requireSupabase(false)) return;
  if (state.views.has(videoId)) return;

  const payload = {
    employee_id: state.employee.id,
    video_id: videoId,
    started_at: new Date().toISOString(),
    progress_percent: getVideoProgress(videoId),
    completed: false,
    signature_required: true,
    signature_reminder_ack: false
  };

  const { data, error } = await state.supabase
    .from("ehs_video_views")
    .upsert(payload, { onConflict: "employee_id,video_id" })
    .select()
    .single();
  if (!error && data) state.views.set(videoId, data);
}

function handleCurrentVideoProgress(forceComplete = false) {
  const video = state.currentVideo;
  const player = dom.trainingPlayer;
  if (!video || !player.duration || Number.isNaN(player.duration)) return;

  const percent = Math.min(100, (player.currentTime / player.duration) * 100);
  const nextProgress = forceComplete === true ? 100 : percent;
  if (!state.localProgress[video.id] || nextProgress > state.localProgress[video.id]) {
    state.localProgress[video.id] = nextProgress;
    saveLocalProgress();
  }
  updateCurrentViewer();
  renderVideoLibrary();
  syncPartialProgress(video.id, nextProgress, forceComplete === true);
}

function syncCurrentVideoProgress() {
  const video = state.currentVideo;
  if (video && isExternalVideo(video.file_path)) {
    syncPartialProgress(video.id, getVideoProgress(video.id), true);
    return;
  }
  const player = dom.trainingPlayer;
  if (!video || !player.duration || Number.isNaN(player.duration)) return;
  const percent = Math.min(100, (player.currentTime / player.duration) * 100);
  if (percent > 0) syncPartialProgress(video.id, percent, true);
}

function restoreCurrentVideoPosition() {
  const video = state.currentVideo;
  if (video && isExternalVideo(video.file_path)) return;
  const player = dom.trainingPlayer;
  if (!video || !player.duration || Number.isNaN(player.duration)) return;

  const view = state.views.get(video.id);
  if (view?.completed) return;
  const progress = getVideoProgress(video.id, view);
  if (progress < 2 || progress >= 95) return;

  const resumeAt = Math.max(0, ((progress / 100) * player.duration) - 5);
  if (resumeAt > 0 && resumeAt < player.duration) player.currentTime = resumeAt;
}

function resetExternalPlayer() {
  if (dom.externalOpenLink) dom.externalOpenLink.href = "#";
}

async function syncPartialProgress(videoId, progress, force = false) {
  if (!state.employee || !requireSupabase(false)) return;
  const existing = state.views.get(videoId);
  if (existing?.completed) return;

  const now = Date.now();
  const last = state.progressSync[videoId] || { at: 0, progress: Number(existing?.progress_percent || 0) };
  const roundedProgress = Math.min(100, Math.round(progress));
  const progressedEnough = roundedProgress >= last.progress + 5;
  const waitedEnough = now - last.at >= 12000;

  if (!force && roundedProgress < 1) return;
  if (!force && !progressedEnough && !waitedEnough) return;

  const payload = {
    employee_id: state.employee.id,
    video_id: videoId,
    started_at: existing?.started_at || new Date().toISOString(),
    progress_percent: Math.max(Number(existing?.progress_percent || 0), roundedProgress),
    completed: false,
    signature_required: true,
    signature_reminder_ack: false,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await state.supabase
    .from("ehs_video_views")
    .upsert(payload, { onConflict: "employee_id,video_id" })
    .select()
    .single();

  if (!error && data) {
    state.views.set(videoId, data);
    state.progressSync[videoId] = { at: now, progress: Number(data.progress_percent || roundedProgress) };
    renderProgress();
    renderNextTraining();
  }
}

async function completeCurrentVideo() {
  const video = state.currentVideo;
  if (!video) return;
  if (!state.employee) {
    showAlert("Primero registre el colaborador para guardar el avance personal.");
    return;
  }
  if (!requireSupabase()) return;

  const progress = Math.max(95, getVideoProgress(video.id));
  const existing = state.views.get(video.id);
  const payload = {
    employee_id: state.employee.id,
    video_id: video.id,
    started_at: existing?.started_at || new Date().toISOString(),
    completed_at: new Date().toISOString(),
    progress_percent: progress,
    completed: true,
    signature_required: true,
    signature_reminder_ack: true,
    updated_at: new Date().toISOString()
  };

  const query = existing
    ? state.supabase.from("ehs_video_views").update(payload).eq("id", existing.id)
    : state.supabase.from("ehs_video_views").insert(payload);

  const { data, error } = await query.select().single();
  if (error) {
    showAlert(`No se pudo guardar la capacitacion completada: ${error.message}`);
    return;
  }

  state.views.set(video.id, data);
  state.progressSync[video.id] = { at: Date.now(), progress: Number(data.progress_percent || progress) };
  state.localProgress[video.id] = Math.max(state.localProgress[video.id] || 0, progress);
  saveLocalProgress();
  renderLearnerExperience();
}

function getVideoProgress(videoId, view = state.views.get(videoId)) {
  return Math.max(Number(view?.progress_percent || 0), Number(state.localProgress[videoId] || 0));
}

function getVideoCode(video) {
  return video?.video_code || video?.code || "";
}

function getCategoryName(video) {
  return video?.ehs_training_categories?.name || state.categories.find((item) => item.id === video?.category_id)?.name || "EHS";
}

function isExternalVideo(filePath) {
  return /^https?:\/\//i.test(String(filePath || ""));
}

function getStatus(progress, view) {
  if (view?.completed) return { label: "Completado", className: "completed" };
  if (progress > 0) return { label: "En progreso", className: "in-progress" };
  return { label: "Pendiente", className: "pending" };
}

function isCompleteButtonEnabled(progress, view) {
  return Boolean(state.employee && !view?.completed && progress >= 95);
}

function loadLocalProgress() {
  state.localProgress = safeJsonParse(localStorage.getItem(progressStorageKey()), {});
}

function saveLocalProgress() {
  if (!state.employee) return;
  localStorage.setItem(progressStorageKey(), JSON.stringify(state.localProgress));
}

function progressStorageKey() {
  return `${STORAGE_PROGRESS_PREFIX}${state.employee?.cedula || "anon"}`;
}

async function openAdmin() {
  toggleHidden(dom.adminModal, false);
  if (dom.adminPin) dom.adminPin.focus();
  if (state.adminAuthenticated) await loadAdminData();
}

function closeAdmin() {
  toggleHidden(dom.adminModal, true);
}

async function unlockAdmin(event) {
  event.preventDefault();
  if (dom.adminPin.value !== ADMIN_PIN) {
    showAlert("Clave de administrador incorrecta.");
    return;
  }
  state.adminAuthenticated = true;
  toggleHidden(dom.adminPinForm, true);
  toggleHidden(dom.adminContent, false);
  await loadAdminData();
}

function setAdminTab(tab) {
  const isRecords = tab === "records";
  toggleClass(dom.adminRecordsTab, "active", isRecords);
  toggleClass(dom.adminVideosTab, "active", !isRecords);
  toggleHidden(dom.adminRecordsPanel, !isRecords);
  toggleHidden(dom.adminVideosPanel, isRecords);
}

async function loadAdminData() {
  await Promise.all([loadAdminRows(), loadAdminVideos()]);
  populateCategorySelect();
}

async function loadAdminRows() {
  if (!requireSupabase()) return;
  const { data, error } = await state.supabase
    .from("ehs_video_views")
    .select("completed_at, progress_percent, completed, ehs_employees(full_name, cedula, project_site), ehs_training_videos(id, video_code, title)")
    .order("updated_at", { ascending: false });

  if (error) {
    showAlert(`No se pudieron cargar los registros del administrador: ${error.message}`);
    return;
  }

  state.adminRows = data || [];
  populateVideoFilter();
  renderAdminSummary();
  renderAdminRows();
}

async function loadAdminVideos() {
  if (!requireSupabase()) return;
  const { data, error } = await state.supabase
    .from("ehs_training_videos")
    .select("id, category_id, video_code, title, description, file_path, active, sort_order, ehs_training_categories(name)")
    .order("sort_order", { ascending: true })
    .order("video_code", { ascending: true });

  if (error) {
    showAlert(`No se pudieron cargar las capacitaciones del administrador: ${error.message}`);
    return;
  }

  state.adminVideos = data || [];
  renderAdminVideos();
}

function renderAdminSummary() {
  const total = state.adminRows.length;
  const completed = state.adminRows.filter((row) => row.completed).length;
  setText(dom.adminTotalViews, total);
  setText(dom.adminCompletedViews, completed);
  setText(dom.adminPendingViews, Math.max(0, total - completed));
}

function populateVideoFilter() {
  if (!dom.filterVideo) return;
  const current = dom.filterVideo.value;
  const options = new Map();
  [...state.videos, ...state.adminVideos].forEach((video) => {
    if (video?.id) options.set(video.id, `${getVideoCode(video)} - ${video.title}`);
  });

  dom.filterVideo.innerHTML = '<option value="">Todos los videos</option>';
  [...options.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, label]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    dom.filterVideo.appendChild(option);
  });
  dom.filterVideo.value = current;
}

function getFilteredAdminRows() {
  const person = normalize(dom.filterPerson.value);
  const project = normalize(dom.filterProject.value);
  const videoId = dom.filterVideo.value;

  return state.adminRows.filter((row) => {
    const employee = row.ehs_employees || {};
    const video = row.ehs_training_videos || {};
    const personText = normalize(`${employee.full_name || ""} ${employee.cedula || ""}`);
    const projectText = normalize(employee.project_site || "");
    return (!person || personText.includes(person))
      && (!project || projectText.includes(project))
      && (!videoId || video.id === videoId);
  });
}

function renderAdminRows() {
  const rows = getFilteredAdminRows();
  if (!dom.adminRows) return;
  dom.adminRows.innerHTML = "";
  rows.forEach((row) => {
    const employee = row.ehs_employees || {};
    const video = row.ehs_training_videos || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(employee.full_name || "")}</td>
      <td>${escapeHtml(employee.cedula || "")}</td>
      <td>${escapeHtml(employee.project_site || "")}</td>
      <td>${escapeHtml(`${getVideoCode(video)} - ${video.title || ""}`)}</td>
      <td>${escapeHtml(formatDate(row.completed_at))}</td>
      <td>${Math.round(Number(row.progress_percent || 0))}%</td>
    `;
    dom.adminRows.appendChild(tr);
  });
  toggleHidden(dom.adminEmpty, rows.length > 0);
}

async function exportExcel() {
  const rows = getFilteredAdminRows();
  const headers = ["Colaborador", "Cedula", "Proyecto", "Video", "Fecha", "Porcentaje", "Completado"];
  const body = rows.map((row) => {
    const employee = row.ehs_employees || {};
    const video = row.ehs_training_videos || {};
    return [
      employee.full_name || "",
      employee.cedula || "",
      employee.project_site || "",
      `${getVideoCode(video)} - ${video.title || ""}`,
      formatDate(row.completed_at || row.updated_at),
      Math.round(Number(row.progress_percent || 0)),
      row.completed ? "si" : "no"
    ];
  });

  if (!window.ExcelJS) {
    const csv = [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `sbm-safety-academy-registros-${new Date().toISOString().slice(0, 10)}.csv`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SBM Safety Academy";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Resumen");
  const records = workbook.addWorksheet("Registros", { views: [{ state: "frozen", ySplit: 1 }] });
  const completed = body.filter((row) => row[6] === "si").length;

  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "SBM Safety Academy - Registros";
  summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  summary.addRow([]);
  summary.addRow(["Fecha de exportacion", new Date(), "Total registros", body.length]);
  summary.addRow(["Completados", completed, "Pendientes", body.length - completed]);
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 22;
  summary.getColumn(3).width = 18;
  summary.getColumn(4).width = 16;
  summary.getCell("B3").numFmt = "yyyy-mm-dd hh:mm";

  records.addRow(headers);
  body.forEach((row) => records.addRow(row));
  records.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  records.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  records.columns = headers.map((header, index) => {
    const longest = Math.max(header.length, ...body.map((row) => String(row[index] || "").length));
    return { width: Math.min(Math.max(longest + 3, 14), 44) };
  });
  records.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
      if (rowNumber > 1 && rowNumber % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `sbm-safety-academy-registros-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function populateCategorySelect() {
  if (!dom.adminVideoCategory) return;
  dom.adminVideoCategory.innerHTML = "";
  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    dom.adminVideoCategory.appendChild(option);
  });
  if (!state.categories.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Sin categorias disponibles";
    dom.adminVideoCategory.appendChild(option);
  }
}

function renderAdminVideos() {
  if (!dom.adminVideoList) return;
  dom.adminVideoList.innerHTML = "";
  toggleHidden(dom.adminVideoEmpty, state.adminVideos.length > 0);

  state.adminVideos.forEach((video) => {
    const card = document.createElement("article");
    card.className = "admin-video-card";
    card.innerHTML = `
      <div>
        <div class="video-meta">
          <span class="category-chip">${escapeHtml(getCategoryName(video))}</span>
          <span class="code-chip">${escapeHtml(getVideoCode(video))}</span>
          <span class="status-pill ${video.active ? "completed" : "pending"}">${video.active ? "Activo" : "Inactivo"}</span>
        </div>
        <h3>${escapeHtml(video.title || "Capacitacion")}</h3>
        <p class="muted">${escapeHtml(video.file_path || "")}</p>
      </div>
      <div class="admin-video-actions">
        <button class="secondary-btn" type="button" data-edit-video="${escapeAttribute(video.id)}">Editar datos</button>
        <button class="secondary-btn" type="button" data-toggle-video="${escapeAttribute(video.id)}">${video.active ? "Desactivar" : "Activar"}</button>
      </div>
    `;
    card.querySelector("[data-edit-video]").addEventListener("click", () => editAdminVideo(video.id));
    card.querySelector("[data-toggle-video]").addEventListener("click", () => toggleAdminVideo(video.id));
    dom.adminVideoList.appendChild(card);
  });
}

function startNewVideoForm() {
  resetVideoForm();
  toggleHidden(dom.videoAdminForm, false);
  if (dom.adminVideoCode) dom.adminVideoCode.focus();
}

function editAdminVideo(videoId) {
  const video = state.adminVideos.find((item) => item.id === videoId);
  if (!video) return;
  dom.adminVideoId.value = video.id;
  dom.adminVideoCategory.value = video.category_id || "";
  dom.adminVideoCode.value = getVideoCode(video);
  dom.adminVideoTitle.value = video.title || "";
  dom.adminVideoDescription.value = video.description || "";
  dom.adminVideoFilePath.value = video.file_path || "";
  dom.adminVideoOrder.value = Number(video.sort_order || 0);
  dom.adminVideoActive.checked = Boolean(video.active);
  toggleHidden(dom.videoAdminForm, false);
  if (dom.videoAdminForm) dom.videoAdminForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetVideoForm() {
  if (dom.videoAdminForm) dom.videoAdminForm.reset();
  if (dom.adminVideoId) dom.adminVideoId.value = "";
  if (dom.adminVideoOrder) dom.adminVideoOrder.value = 0;
  if (dom.adminVideoActive) dom.adminVideoActive.checked = true;
  if (state.categories[0] && dom.adminVideoCategory) dom.adminVideoCategory.value = state.categories[0].id;
  toggleHidden(dom.videoAdminForm, true);
}

async function saveAdminVideo(event) {
  event.preventDefault();
  if (!requireSupabase()) return;
  if (!dom.adminVideoCategory.value) {
    showAlert("Debe existir al menos una categoria para guardar una capacitacion.");
    return;
  }

  const id = dom.adminVideoId.value;
  const payload = {
    category_id: dom.adminVideoCategory.value,
    video_code: dom.adminVideoCode.value.trim(),
    title: dom.adminVideoTitle.value.trim(),
    description: dom.adminVideoDescription.value.trim(),
    file_path: dom.adminVideoFilePath.value.trim(),
    sort_order: Number(dom.adminVideoOrder.value || 0),
    active: dom.adminVideoActive.checked,
    updated_at: new Date().toISOString()
  };

  if (!payload.video_code || !payload.title || !payload.file_path) {
    showAlert("Complete codigo, titulo y file_path para guardar la capacitacion.");
    return;
  }

  const request = id
    ? state.supabase.from("ehs_training_videos").update(payload).eq("id", id)
    : state.supabase.from("ehs_training_videos").insert(payload);

  const { error } = await request;
  if (error) {
    showAlert(`No se pudo guardar la capacitacion. Revise permisos RLS para insert/update en ehs_training_videos. Detalle: ${error.message}`);
    return;
  }

  resetVideoForm();
  await Promise.all([loadVideos(), loadAdminVideos()]);
  populateVideoFilter();
  renderLearnerExperience();
}

async function toggleAdminVideo(videoId) {
  if (!requireSupabase()) return;
  const video = state.adminVideos.find((item) => item.id === videoId);
  if (!video) return;

  const { error } = await state.supabase
    .from("ehs_training_videos")
    .update({ active: !video.active, updated_at: new Date().toISOString() })
    .eq("id", videoId);

  if (error) {
    showAlert(`No se pudo cambiar el estado del video. Revise permisos RLS para update en ehs_training_videos. Detalle: ${error.message}`);
    return;
  }

  await Promise.all([loadVideos(), loadAdminVideos()]);
  renderLearnerExperience();
}

function setFormBusy(isBusy) {
  if (!dom.employeeForm) return;
  dom.employeeForm.querySelectorAll("input, button").forEach((el) => {
    el.disabled = isBusy;
  });
}

function requireSupabase(show = true) {
  const ready = Boolean(state.supabase);
  if (!ready && show) showAlert("Supabase no esta disponible. Revise la conexion de red y la anon key configurada.");
  return ready;
}

function showAlert(message) {
  if (!dom.appAlert) {
    console.error(message);
    return;
  }
  dom.appAlert.textContent = message;
  dom.appAlert.classList.remove("hidden");
  dom.appAlert.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearAlert() {
  setText(dom.appAlert, "");
  toggleHidden(dom.appAlert, true);
}

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function setClassName(element, value) {
  if (element) element.className = value;
}

function setWidth(element, value) {
  if (element) element.style.width = value;
}

function toggleHidden(element, shouldHide) {
  toggleClass(element, "hidden", shouldHide);
}

function toggleClass(element, className, force) {
  if (element) element.classList.toggle(className, force);
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

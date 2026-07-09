const STORAGE_KEY = "lillytech.asset.manager.v2";
const LEGACY_STORAGE_KEY = "lillytech.asset.manager.v1";
const BACKUP_KEY = "lillytech.asset.manager.lastBackup";

/* =====================================================================
   CONFIGURACION SUPABASE  ->  PEGA AQUI TUS DOS DATOS
   Los encuentras en: Supabase > Project Settings > API
   - SUPABASE_URL  = "Project URL"
   - SUPABASE_ANON_KEY = "anon public"
   ===================================================================== */
const SUPABASE_URL = "https://vtbqplzhyhboiindyind.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0YnFwbHpoeWhib2lpbmR5aW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MDkzMzcsImV4cCI6MjA5NzQ4NTMzN30.YVhDdTBrZPj5N528D7yqH8NQmQP1RbrY8OEzJEHYS7o";
const SUPABASE_TABLE = "lillytech_assets";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// Indicador de estado de sincronizacion (esquina). Se crea solo.
function syncStatus(text, kind = "ok") {
  let el = document.getElementById("syncStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "syncStatus";
    el.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:9999;font:600 12px/1.4 Inter,sans-serif;" +
      "padding:8px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);transition:opacity .3s;";
    document.body.appendChild(el);
  }
  const colors = {
    ok: "background:#0d3b34;color:#5eead4;border:1px solid #14b8a6",
    saving: "background:#3b340d;color:#fde68a;border:1px solid #d4a514",
    error: "background:#3b0d0d;color:#fca5a5;border:1px solid #ef4444"
  };
  el.style.cssText += colors[kind] || colors.ok;
  el.textContent = text;
  el.style.opacity = "1";
  if (kind === "ok") setTimeout(() => { el.style.opacity = "0"; }, 2000);
}

const TECH_OPTIONS = [
  "GitHub",
  "Supabase",
  "OpenAI",
  "Make",
  "Twilio",
  "Apps Script",
  "Replit",
  "Google Drive",
  "OneDrive",
  "Canva",
  "Firebase",
  "HTML/CSS/JS"
];

const DEPENDENCY_OPTIONS = [
  "OpenAI API",
  "GitHub",
  "GitHub Pages",
  "Replit",
  "Supabase",
  "Apps Script",
  "Google Drive",
  "OneDrive",
  "Canva",
  "Make",
  "Twilio",
  "Firebase",
  "Google Sheets"
];

const USE_OPTIONS = [
  "Uso interno",
  "Cliente especifico",
  "Demo publica",
  "Demo privada",
  "Comercializable",
  "Producto propio"
];

const URL_FIELDS = [
  ["publicUrl", "URL publica"],
  ["demoUrl", "URL demo"],
  ["privateUrl", "URL privada"],
  ["githubRepoUrl", "GitHub Repository"],
  ["githubPagesUrl", "GitHub Pages"],
  ["replitUrl", "Replit"],
  ["supabaseUrl", "Supabase"],
  ["appsScriptUrl", "Apps Script"],
  ["googleDriveUrl", "Google Drive"],
  ["oneDriveUrl", "OneDrive"],
  ["canvaUrl", "Canva"],
  ["makeUrl", "Make"],
  ["twilioUrl", "Twilio"],
  ["openAiUrl", "OpenAI"],
  ["sheetsUrl", "Google Sheets"]
];

const STATUS_ALIASES = {
  Activa: "Produccion",
  Produccion: "Produccion",
  "Producción": "Produccion",
  Desarrollo: "Pruebas",
  Archivada: "Descontinuado"
};

const DataStore = {
  // Trae todas las apps del usuario desde Supabase
  async load() {
    if (!currentUser) return [];
    const { data, error } = await sb
      .from(SUPABASE_TABLE)
      .select("data")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Supabase load:", error);
      syncStatus("Error al cargar", "error");
      return [];
    }
    return (data || []).map((row) => normalizeAsset(row.data));
  },
  // Sincroniza TODO el inventario: sube los actuales y borra los que ya no existen
  async save(nextAssets) {
    if (!currentUser) return;
    syncStatus("Guardando...", "saving");
    try {
      const rows = nextAssets.map((a) => ({
        id: a.id,
        user_id: currentUser.id,
        data: a,
        updated_at: a.updatedAt || new Date().toISOString()
      }));

      if (rows.length) {
        const { error } = await sb.from(SUPABASE_TABLE).upsert(rows, { onConflict: "id" });
        if (error) throw error;
      }

      // Borrar de la nube lo que ya no esta en memoria (deletes / imports)
      const { data: existing, error: selErr } = await sb.from(SUPABASE_TABLE).select("id");
      if (selErr) throw selErr;
      const keep = new Set(nextAssets.map((a) => a.id));
      const toDelete = (existing || []).map((r) => r.id).filter((id) => !keep.has(id));
      if (toDelete.length) {
        const { error: delErr } = await sb.from(SUPABASE_TABLE).delete().in("id", toDelete);
        if (delErr) throw delErr;
      }

      syncStatus("Guardado en la nube", "ok");
    } catch (err) {
      console.error("Supabase save:", err);
      syncStatus("Error al guardar", "error");
      alert("No se pudo guardar en la nube. Revisa tu conexion. Tus cambios siguen en pantalla; vuelve a intentar.");
    }
  }
};

let assets = [];
let currentTasks = [];
let visibleSecrets = new Set();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  dialog: $("#assetDialog"),
  form: $("#assetForm"),
  assetList: $("#assetList"),
  locationsList: $("#locationsList"),
  accessList: $("#accessList"),
  technicalList: $("#technicalList"),
  dependenciesList: $("#dependenciesList"),
  costsList: $("#costsList"),
  clientsList: $("#clientsList"),
  tasksList: $("#tasksList"),
  docsList: $("#docsList"),
  techStats: $("#techStats"),
  costStats: $("#costStats"),
  staleApps: $("#staleApps"),
  recentUpdates: $("#recentUpdates"),
  search: $("#globalSearch"),
  statusFilter: $("#statusFilter")
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeStatus(status) {
  return STATUS_ALIASES[status] || status || "Idea";
}

function statusClass(status) {
  return `status-${normalize(normalizeStatus(status)).replace(/\s+/g, "-")}`;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAsset(asset) {
  const technologies = (asset.technologies || []).map((tech) => tech === "HTML" || tech === "JavaScript" ? "HTML/CSS/JS" : tech);
  return {
    id: asset.id || uid(),
    name: asset.name || "",
    category: asset.category || "",
    description: asset.description || asset.docs?.functionalDescription || "",
    createdAt: asset.createdAt || today(),
    status: normalizeStatus(asset.status),
    urls: { ...(asset.urls || {}) },
    access: { ...(asset.access || {}) },
    technologies: [...new Set(technologies)],
    dependencies: asset.dependencies || asset.docs?.dependencies?.split("\n").filter(Boolean) || [],
    dependencyNotes: asset.dependencyNotes || "",
    costs: {
      monthly: Number(asset.costs?.monthly || 0),
      annual: Number(asset.costs?.annual || 0),
      paymentStatus: asset.costs?.paymentStatus || "Gratis",
      notes: asset.costs?.notes || ""
    },
    uses: asset.uses || [],
    clientName: asset.clientName || "",
    owner: asset.owner || "",
    relatedProject: asset.relatedProject || "",
    tasks: asset.tasks || [],
    docs: { ...(asset.docs || {}) },
    createdRecordAt: asset.createdRecordAt || new Date().toISOString(),
    updatedAt: asset.updatedAt || new Date().toISOString()
  };
}

function filteredAssets() {
  const query = normalize(elements.search.value);
  const status = elements.statusFilter.value;
  return assets.filter((asset) => {
    const statusMatches = !status || normalizeStatus(asset.status) === status;
    if (!statusMatches) return false;
    if (!query) return true;

    const haystack = [
      asset.name,
      asset.category,
      asset.description,
      asset.clientName,
      asset.owner,
      asset.relatedProject,
      asset.status,
      asset.dependencyNotes,
      asset.costs?.notes,
      ...Object.values(asset.urls || {}),
      ...(asset.technologies || []),
      ...(asset.dependencies || []),
      ...(asset.uses || []),
      ...Object.values(asset.docs || {})
    ].join(" ");
    return normalize(haystack).includes(query);
  });
}

function emptyState() {
  return $("#emptyTemplate").content.firstElementChild.cloneNode(true);
}

function render() {
  const list = filteredAssets();
  renderMetrics(list);
  renderDashboard(list);
  renderInventory(list);
  renderLocations(list);
  renderAccess(list);
  renderTechnical(list);
  renderDependencies(list);
  renderCosts(list);
  renderClients(list);
  renderTasks(list);
  renderDocs(list);
  renderBackupStatus();
}

function renderMetrics(list) {
  $("#totalApps").textContent = list.length;
  $("#productionApps").textContent = list.filter((asset) => asset.status === "Produccion").length;
  $("#testingApps").textContent = list.filter((asset) => asset.status === "Pruebas").length;
  $("#ideaApps").textContent = list.filter((asset) => asset.status === "Idea").length;
  $("#discontinuedApps").textContent = list.filter((asset) => asset.status === "Descontinuado").length;
  $("#activeClients").textContent = new Set(list.map((asset) => asset.clientName || asset.owner).filter(Boolean)).size;
  $("#monthlyCost").textContent = money(list.reduce((sum, asset) => sum + Number(asset.costs?.monthly || 0), 0));
  $("#annualCost").textContent = money(list.reduce((sum, asset) => sum + Number(asset.costs?.annual || 0), 0));
}

function renderDashboard(list) {
  const counts = TECH_OPTIONS.map((tech) => ({
    tech,
    count: list.filter((asset) => (asset.technologies || []).includes(tech)).length
  })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);

  elements.techStats.innerHTML = "";
  if (!counts.length) elements.techStats.append(emptyState());
  counts.slice(0, 8).forEach((item) => {
    elements.techStats.insertAdjacentHTML("beforeend", `<div class="stat-row"><strong>${escapeHtml(item.tech)}</strong><span>${item.count}</span></div>`);
  });

  elements.recentUpdates.innerHTML = "";
  const recent = [...list].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 7);
  if (!recent.length) elements.recentUpdates.append(emptyState());
  recent.forEach((asset) => {
    elements.recentUpdates.insertAdjacentHTML("beforeend", `
      <div class="activity-row">
        <div><strong>${escapeHtml(asset.name)}</strong><br><span>${escapeHtml(asset.category || "Sin categoria")}</span></div>
        <span>${escapeHtml((asset.updatedAt || "").slice(0, 10))}</span>
      </div>
    `);
  });

  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const stale = list.filter((asset) => new Date(asset.updatedAt || asset.createdAt || 0).getTime() < cutoff);
  elements.staleApps.innerHTML = "";
  if (!stale.length) elements.staleApps.innerHTML = `<div class="stat-row"><strong>Todo al dia</strong><span>0</span></div>`;
  stale.slice(0, 8).forEach((asset) => {
    elements.staleApps.insertAdjacentHTML("beforeend", `
      <div class="activity-row">
        <div><strong>${escapeHtml(asset.name)}</strong><br><span>${escapeHtml(asset.clientName || asset.owner || "Sin cliente")}</span></div>
        <span>${escapeHtml((asset.updatedAt || asset.createdAt || "").slice(0, 10))}</span>
      </div>
    `);
  });

  const free = list.filter((asset) => asset.costs?.paymentStatus === "Gratis" || (!asset.costs?.monthly && !asset.costs?.annual)).length;
  const paid = list.length - free;
  elements.costStats.innerHTML = `
    <div class="stat-row"><strong>Servicios gratuitos</strong><span>${free}</span></div>
    <div class="stat-row"><strong>Servicios de pago</strong><span>${paid}</span></div>
    <div class="stat-row"><strong>Total mensual</strong><span>${money(list.reduce((sum, asset) => sum + Number(asset.costs?.monthly || 0), 0))}</span></div>
    <div class="stat-row"><strong>Total anual</strong><span>${money(list.reduce((sum, asset) => sum + Number(asset.costs?.annual || 0), 0))}</span></div>
  `;
}

function renderInventory(list) {
  elements.assetList.innerHTML = "";
  if (!list.length) return elements.assetList.append(emptyState());

  list.forEach((asset) => {
    elements.assetList.insertAdjacentHTML("beforeend", `
      <article class="asset-card">
        <div>
          <div class="card-meta">
            <span class="status-badge ${statusClass(asset.status)}">${escapeHtml(asset.status)}</span>
            <span class="chip">${escapeHtml(asset.category || "Sin categoria")}</span>
            <span class="chip">Creada: ${escapeHtml(asset.createdAt || "Sin fecha")}</span>
            <span class="chip">Actualizada: ${escapeHtml((asset.updatedAt || "").slice(0, 10) || "Sin fecha")}</span>
          </div>
          <h4>${escapeHtml(asset.name)}</h4>
          <p>${escapeHtml(asset.description || "Sin descripcion registrada.")}</p>
          <div class="chip-row">${chipList(asset.technologies, "Sin tecnologias marcadas")}</div>
        </div>
        <button class="secondary-btn" data-edit="${asset.id}">Editar</button>
      </article>
    `);
  });
}

function renderLocations(list) {
  renderDetailList(elements.locationsList, list, (asset) => {
    const links = URL_FIELDS
      .filter(([key]) => asset.urls?.[key])
      .map(([key, label]) => `<a class="link-pill" href="${escapeHtml(asset.urls[key])}" target="_blank" rel="noopener">Abrir ${escapeHtml(label)}</a>`)
      .join("");
    return `<div class="link-grid">${links || "<span class='chip'>Sin ubicaciones registradas</span>"}</div>`;
  });
}

function renderAccess(list) {
  renderDetailList(elements.accessList, list, (asset) => {
    const access = asset.access || {};
    return `
      <div class="access-grid">
        <span class="chip">Usuario: ${escapeHtml(access.username || "Sin usuario")}</span>
        <span class="chip">Correo: ${escapeHtml(access.email || "Sin correo")}</span>
        <span class="chip">MFA: ${escapeHtml(access.mfaEnabled || "No registrado")}</span>
        <span class="chip">Metodo MFA: ${escapeHtml(access.mfaMethod || "Sin metodo")}</span>
        <span class="chip">Ubicacion MFA: ${escapeHtml(access.mfaLocation || "Sin ubicacion")}</span>
      </div>
      ${secretRow(asset.id, "password", "Contrasena", access.password)}
      ${secretRow(asset.id, "apiKeys", "API Keys", access.apiKeys)}
      <p>${escapeHtml(access.accessNotes || "Sin notas de acceso.")}</p>
    `;
  });
}

function secretRow(assetId, field, label, value) {
  const key = `${assetId}:${field}`;
  const isVisible = visibleSecrets.has(key);
  const shown = isVisible ? value || "Sin registrar" : value ? "************" : "Sin registrar";
  return `
    <div class="password-row">
      <strong>${label}:</strong>
      <span class="password-value">${escapeHtml(shown)}</span>
      <button class="secondary-btn" data-secret="${key}" type="button">${isVisible ? "Ocultar" : "Mostrar"}</button>
    </div>
  `;
}

function renderTechnical(list) {
  renderDetailList(elements.technicalList, list, (asset) => `<div class="chip-row">${chipList(asset.technologies, "Sin tecnologias marcadas")}</div>`);
}

function renderDependencies(list) {
  renderDetailList(elements.dependenciesList, list, (asset) => `
    <div class="chip-row">${chipList(asset.dependencies, "Sin dependencias registradas")}</div>
    <p>${escapeHtml(asset.dependencyNotes || "Sin notas de dependencia.")}</p>
  `);
}

function renderCosts(list) {
  renderDetailList(elements.costsList, list, (asset) => `
    <div class="access-grid">
      <span class="chip">Mensual: ${money(asset.costs?.monthly)}</span>
      <span class="chip">Anual: ${money(asset.costs?.annual)}</span>
      <span class="chip">Pago: ${escapeHtml(asset.costs?.paymentStatus || "Gratis")}</span>
    </div>
    <p>${escapeHtml(asset.costs?.notes || "Sin notas de costo.")}</p>
  `);
}

function renderClients(list) {
  renderDetailList(elements.clientsList, list, (asset) => `
    <div class="chip-row">${chipList(asset.uses, "Sin uso marcado")}</div>
    <p><strong>Cliente:</strong> ${escapeHtml(asset.clientName || "No registrado")}</p>
    <p><strong>Propietario:</strong> ${escapeHtml(asset.owner || "No registrado")}</p>
    <p><strong>Proyecto relacionado:</strong> ${escapeHtml(asset.relatedProject || "No registrado")}</p>
  `);
}

function renderTasks(list) {
  renderDetailList(elements.tasksList, list, (asset) => {
    const tasks = asset.tasks || [];
    if (!tasks.length) return "<span class='chip'>Sin pendientes registrados</span>";
    return tasks.map((task) => `
      <div class="task-item ${task.completed ? "completed" : ""}">
        <input type="checkbox" data-task-toggle="${asset.id}:${task.id}" ${task.completed ? "checked" : ""}>
        <div>
          <div class="task-title">${escapeHtml(task.text)}</div>
          <div class="task-type">${escapeHtml(task.type)}</div>
        </div>
        <span class="chip">${task.completed ? "Completado" : "Pendiente"}</span>
      </div>
    `).join("");
  });
}

function renderDocs(list) {
  renderDetailList(elements.docsList, list, (asset) => {
    const docs = asset.docs || {};
    return `
      ${docLine("Descripcion funcional", asset.description)}
      ${docLine("Como funciona", docs.howItWorks)}
      ${docLine("Como actualizar", docs.howToUpdate)}
      ${docLine("Problemas conocidos", docs.knownIssues)}
      ${docLine("Proximas mejoras", docs.futureImprovements)}
      ${docLine("Alojamiento", docs.hosting)}
      ${docLine("Recuperacion", docs.recovery)}
      ${docLine("Publicacion", docs.publishing)}
    `;
  });
}

function renderBackupStatus() {
  const stamp = localStorage.getItem(BACKUP_KEY);
  $("#backupStatus").textContent = `Ultimo respaldo: ${stamp || "sin registrar"}`;
}

function chipList(items, fallback) {
  return (items || []).length ? items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("") : `<span class="chip">${fallback}</span>`;
}

function docLine(label, value) {
  return `<p><strong>${label}:</strong> ${escapeHtml(value || "Sin documentar")}</p>`;
}

function renderDetailList(container, list, contentBuilder) {
  container.innerHTML = "";
  if (!list.length) return container.append(emptyState());
  list.forEach((asset) => {
    container.insertAdjacentHTML("beforeend", `
      <article class="detail-card">
        <div class="card-meta">
          <span class="status-badge ${statusClass(asset.status)}">${escapeHtml(asset.status)}</span>
          <span class="chip">${escapeHtml(asset.category || "Sin categoria")}</span>
        </div>
        <h4>${escapeHtml(asset.name)}</h4>
        ${contentBuilder(asset)}
      </article>
    `);
  });
}

function openDialog(asset = null) {
  const normalized = asset ? normalizeAsset(asset) : null;
  elements.form.reset();
  currentTasks = normalized?.tasks ? structuredClone(normalized.tasks) : [];
  $("#assetId").value = normalized?.id || "";
  $("#dialogTitle").textContent = normalized ? "Editar aplicacion" : "Nueva aplicacion";
  $("#deleteAssetBtn").style.display = normalized ? "inline-flex" : "none";

  const values = {
    name: normalized?.name || "",
    category: normalized?.category || "",
    createdAt: normalized?.createdAt || today(),
    status: normalized?.status || "Idea",
    description: normalized?.description || "",
    clientName: normalized?.clientName || "",
    owner: normalized?.owner || "",
    relatedProject: normalized?.relatedProject || "",
    dependencyNotes: normalized?.dependencyNotes || "",
    monthlyCostInput: normalized?.costs?.monthly || "",
    annualCostInput: normalized?.costs?.annual || "",
    paymentStatus: normalized?.costs?.paymentStatus || "Gratis",
    costNotes: normalized?.costs?.notes || "",
    ...normalized?.urls,
    ...normalized?.access,
    ...normalized?.docs
  };

  Object.entries(values).forEach(([key, value]) => {
    const input = $(`#${key}`);
    if (input) input.value = value || "";
  });

  renderCheckboxes("techCheckboxes", TECH_OPTIONS, normalized?.technologies || []);
  renderCheckboxes("dependencyCheckboxes", DEPENDENCY_OPTIONS, normalized?.dependencies || []);
  renderCheckboxes("useCheckboxes", USE_OPTIONS, normalized?.uses || []);
  renderFormTasks();
  elements.dialog.showModal();
}

function renderCheckboxes(containerId, options, selected) {
  const container = $(`#${containerId}`);
  container.innerHTML = options.map((option) => `
    <label><input type="checkbox" value="${escapeHtml(option)}" ${selected.includes(option) ? "checked" : ""}> ${escapeHtml(option)}</label>
  `).join("");
}

function renderFormTasks() {
  const container = $("#formTasks");
  container.innerHTML = "";
  if (!currentTasks.length) {
    container.innerHTML = "<span class='chip'>Sin pendientes agregados</span>";
    return;
  }
  currentTasks.forEach((task) => {
    container.insertAdjacentHTML("beforeend", `
      <div class="task-item ${task.completed ? "completed" : ""}">
        <input type="checkbox" data-form-task="${task.id}" ${task.completed ? "checked" : ""}>
        <div>
          <div class="task-title">${escapeHtml(task.text)}</div>
          <div class="task-type">${escapeHtml(task.type)}</div>
        </div>
        <button class="danger-btn" type="button" data-remove-task="${task.id}">Quitar</button>
      </div>
    `);
  });
}

function collectChecked(containerId) {
  return $$(`#${containerId} input:checked`).map((input) => input.value);
}

function collectAsset() {
  const id = $("#assetId").value || uid();
  const existing = assets.find((asset) => asset.id === id);
  return normalizeAsset({
    id,
    name: $("#name").value.trim(),
    category: $("#category").value.trim(),
    description: $("#description").value.trim(),
    createdAt: $("#createdAt").value,
    status: $("#status").value,
    urls: Object.fromEntries(URL_FIELDS.map(([key]) => [key, $(`#${key}`).value.trim()])),
    access: {
      username: $("#username").value.trim(),
      email: $("#email").value.trim(),
      password: $("#password").value,
      apiKeys: $("#apiKeys").value,
      mfaEnabled: $("#mfaEnabled").value,
      mfaMethod: $("#mfaMethod").value.trim(),
      mfaLocation: $("#mfaLocation").value.trim(),
      accessNotes: $("#accessNotes").value.trim()
    },
    technologies: collectChecked("techCheckboxes"),
    dependencies: collectChecked("dependencyCheckboxes"),
    dependencyNotes: $("#dependencyNotes").value.trim(),
    costs: {
      monthly: Number($("#monthlyCostInput").value || 0),
      annual: Number($("#annualCostInput").value || 0),
      paymentStatus: $("#paymentStatus").value,
      notes: $("#costNotes").value.trim()
    },
    uses: collectChecked("useCheckboxes"),
    clientName: $("#clientName").value.trim(),
    owner: $("#owner").value.trim(),
    relatedProject: $("#relatedProject").value.trim(),
    tasks: currentTasks,
    docs: {
      howItWorks: $("#howItWorks").value.trim(),
      howToUpdate: $("#howToUpdate").value.trim(),
      knownIssues: $("#knownIssues").value.trim(),
      futureImprovements: $("#futureImprovements").value.trim(),
      hosting: $("#hosting").value.trim(),
      recovery: $("#recovery").value.trim(),
      publishing: $("#publishing").value.trim()
    },
    createdRecordAt: existing?.createdRecordAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function upsertAsset(asset) {
  const index = assets.findIndex((item) => item.id === asset.id);
  if (index >= 0) assets[index] = asset;
  else assets.unshift(asset);
  DataStore.save(assets);
  render();
}

function deleteAsset(id) {
  assets = assets.filter((asset) => asset.id !== id);
  DataStore.save(assets);
  render();
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function markBackup() {
  localStorage.setItem(BACKUP_KEY, new Date().toLocaleString("es-CR"));
  renderBackupStatus();
}

function exportJson() {
  download(`lillytech-assets-${today()}.json`, JSON.stringify(assets, null, 2), "application/json");
  markBackup();
}

function exportFullBackup() {
  const backup = {
    app: "LillyTech Asset Manager",
    version: 2,
    exportedAt: new Date().toISOString(),
    assets
  };
  download(`lillytech-backup-completo-${today()}.json`, JSON.stringify(backup, null, 2), "application/json");
  markBackup();
}

async function exportCsv() {
  if (!window.ExcelJS) {
    alert("No se pudo cargar el generador de Excel. Revise la conexion a internet y vuelva a intentar.");
    return;
  }

  const headers = [
    "Nombre",
    "Categoria",
    "Estado",
    "Cliente",
    "Propietario",
    "Proyecto relacionado",
    "Tecnologias",
    "Dependencias",
    "Costo mensual",
    "Costo anual",
    "Estado de pago",
    "URL publica",
    "GitHub Repository",
    "GitHub Pages",
    "Replit",
    "Supabase",
    "Apps Script",
    "Google Drive",
    "OneDrive",
    "Canva",
    "Make",
    "Twilio",
    "OpenAI",
    "Pendientes abiertos",
    "Ultima modificacion"
  ];
  const rows = assets.map((asset) => [
    asset.name,
    asset.category,
    asset.status,
    asset.clientName,
    asset.owner,
    asset.relatedProject,
    (asset.technologies || []).join(", "),
    (asset.dependencies || []).join(", "),
    Number(asset.costs?.monthly || 0),
    Number(asset.costs?.annual || 0),
    asset.costs?.paymentStatus,
    asset.urls?.publicUrl,
    asset.urls?.githubRepoUrl,
    asset.urls?.githubPagesUrl,
    asset.urls?.replitUrl,
    asset.urls?.supabaseUrl,
    asset.urls?.appsScriptUrl,
    asset.urls?.googleDriveUrl,
    asset.urls?.oneDriveUrl,
    asset.urls?.canvaUrl,
    asset.urls?.makeUrl,
    asset.urls?.twilioUrl,
    asset.urls?.openAiUrl,
    (asset.tasks || []).filter((task) => !task.completed).map((task) => task.text).join(" | "),
    asset.updatedAt ? new Date(asset.updatedAt) : ""
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LillyTech Asset Manager";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  const summary = workbook.addWorksheet("Resumen", {
    views: [{ state: "frozen", ySplit: 4 }]
  });
  const inventory = workbook.addWorksheet("Inventario", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  const statusCounts = assets.reduce((acc, asset) => {
    const key = asset.status || "Sin estado";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const totalMonthly = assets.reduce((sum, asset) => sum + Number(asset.costs?.monthly || 0), 0);
  const totalAnnual = assets.reduce((sum, asset) => sum + Number(asset.costs?.annual || 0), 0);
  const openTasks = assets.reduce(
    (sum, asset) => sum + (asset.tasks || []).filter((task) => !task.completed).length,
    0
  );

  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "Inventario LillyTech";
  summary.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF101828" } };
  summary.getCell("A1").alignment = { vertical: "middle" };
  summary.getRow(1).height = 30;
  summary.addRow([]);
  summary.addRow(["Fecha de exportacion", today(), "Total activos", assets.length]);
  summary.addRow(["Costo mensual total", totalMonthly, "Costo anual total", totalAnnual]);
  summary.addRow(["Pendientes abiertos", openTasks, "Fuente", "LillyTech Asset Manager"]);
  summary.addRow([]);
  summary.addRow(["Estado", "Cantidad"]);
  Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([status, count]) => summary.addRow([status, count]));

  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 18;
  summary.getColumn(3).width = 20;
  summary.getColumn(4).width = 22;
  summary.getRow(7).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
  ["B4", "D4"].forEach((cell) => {
    summary.getCell(cell).numFmt = '"$"#,##0.00';
  });

  inventory.addRow(headers);
  rows.forEach((row) => inventory.addRow(row));
  inventory.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    for (let col = 12; col <= 23; col += 1) {
      const cell = row.getCell(col);
      const value = String(cell.value || "").trim();
      if (value.startsWith("http://") || value.startsWith("https://")) {
        cell.value = { text: value, hyperlink: value };
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }
    }
  });
  inventory.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  };

  const headerRow = inventory.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
  });

  inventory.columns = headers.map((header, index) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[index] || "").length)
    );
    return {
      key: header,
      width: Math.min(Math.max(maxLength + 2, index >= 11 && index <= 22 ? 22 : 14), 42)
    };
  });

  inventory.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.alignment = {
        vertical: "top",
        wrapText: colNumber >= 7
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } }
      };
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });
  });

  ["I", "J"].forEach((column) => {
    inventory.getColumn(column).numFmt = '"$"#,##0.00';
  });
  inventory.getColumn("Y").numFmt = "yyyy-mm-dd";

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    `lillytech-assets-${today()}.xlsx`,
    buffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  markBackup();
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      const importedAssets = Array.isArray(imported) ? imported : imported.assets;
      if (!Array.isArray(importedAssets)) throw new Error("Formato invalido");
      assets = importedAssets.map(normalizeAsset);
      DataStore.save(assets);
      render();
      alert("Respaldo importado correctamente.");
    } catch {
      alert("No se pudo importar el archivo. Verifica que sea un respaldo JSON valido.");
    }
  };
  reader.readAsText(file);
}

function loadSampleData() {
  if (assets.length && !confirm("Esto agregara un ejemplo al inventario actual. ¿Continuar?")) return;
  upsertAsset({
    id: uid(),
    name: "Profesor Ingles",
    category: "IA educativa",
    description: "Aplicacion para practicar ingles con apoyo de IA, seguimiento de progreso y ejercicios personalizados.",
    createdAt: today(),
    status: "Pruebas",
    urls: {
      demoUrl: "https://demo.lillytech.local/profesor-ingles",
      githubRepoUrl: "https://github.com/lillytech/profesor-ingles",
      replitUrl: "https://replit.com/@lillytech/profesor-ingles",
      supabaseUrl: "https://supabase.com/dashboard/project/demo"
    },
    access: {
      username: "admin",
      email: "admin@lillytech.local",
      password: "",
      apiKeys: "",
      mfaEnabled: "No registrado",
      mfaMethod: "",
      mfaLocation: "",
      accessNotes: "Completar accesos en tercera fase."
    },
    technologies: ["OpenAI", "Supabase", "Replit", "HTML/CSS/JS"],
    dependencies: ["OpenAI API", "Replit", "Supabase"],
    dependencyNotes: "Si falla la conversacion, revisar primero OpenAI API y variables en Replit.",
    costs: {
      monthly: 15,
      annual: 180,
      paymentStatus: "De pago",
      notes: "Costo estimado por uso de OpenAI API."
    },
    uses: ["Uso interno", "Producto propio"],
    clientName: "Uso Personal",
    owner: "Lilliana Retana",
    relatedProject: "LillyTech Academy",
    tasks: [
      { id: uid(), text: "Completar documentacion de recuperacion", type: "Mejora", completed: false },
      { id: uid(), text: "Definir version comercializable", type: "Proxima version", completed: false }
    ],
    docs: {
      howItWorks: "La app usa prompts de IA para generar practica personalizada.",
      howToUpdate: "Actualizar prompts, revisar variables y probar flujo completo.",
      knownIssues: "Pendiente validar limites de consumo de API.",
      futureImprovements: "Agregar historiales por estudiante.",
      hosting: "Replit con posible migracion a GitHub Pages + Supabase.",
      recovery: "Restaurar repositorio y variables de entorno.",
      publishing: "Publicar desde Replit o generar version estatica."
    },
    createdRecordAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function bindEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-item").forEach((item) => item.classList.remove("active"));
      $$(".panel").forEach((panel) => panel.classList.remove("active-section"));
      button.classList.add("active");
      $(`[data-panel="${button.dataset.section}"]`).classList.add("active-section");
    });
  });

  $("#newAssetBtn").addEventListener("click", () => openDialog());
  $("#closeDialogBtn").addEventListener("click", () => elements.dialog.close());
  $("#cancelDialogBtn").addEventListener("click", () => elements.dialog.close());
  $("#sampleDataBtn").addEventListener("click", loadSampleData);
  $("#exportJsonBtn").addEventListener("click", exportJson);
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#fullBackupBtn").addEventListener("click", exportFullBackup);
  $("#importFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importJson(file);
    event.target.value = "";
  });
  elements.search.addEventListener("input", render);
  elements.statusFilter.addEventListener("change", render);

  document.addEventListener("click", (event) => {
    const editId = event.target.dataset.edit;
    const secretKey = event.target.dataset.secret;
    const removeTaskId = event.target.dataset.removeTask;

    if (editId) openDialog(assets.find((asset) => asset.id === editId));
    if (secretKey) {
      visibleSecrets.has(secretKey) ? visibleSecrets.delete(secretKey) : visibleSecrets.add(secretKey);
      render();
    }
    if (removeTaskId) {
      currentTasks = currentTasks.filter((task) => task.id !== removeTaskId);
      renderFormTasks();
    }
  });

  document.addEventListener("change", (event) => {
    const taskToggle = event.target.dataset.taskToggle;
    const formTask = event.target.dataset.formTask;
    if (taskToggle) {
      const [assetId, taskId] = taskToggle.split(":");
      const asset = assets.find((item) => item.id === assetId);
      const task = asset?.tasks?.find((item) => item.id === taskId);
      if (task) {
        task.completed = event.target.checked;
        asset.updatedAt = new Date().toISOString();
        DataStore.save(assets);
        render();
      }
    }
    if (formTask) {
      const task = currentTasks.find((item) => item.id === formTask);
      if (task) task.completed = event.target.checked;
      renderFormTasks();
    }
  });

  $("#addTaskBtn").addEventListener("click", () => {
    const text = $("#taskText").value.trim();
    if (!text) return;
    currentTasks.push({ id: uid(), text, type: $("#taskType").value, completed: false });
    $("#taskText").value = "";
    renderFormTasks();
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!$("#name").value.trim()) return;
    upsertAsset(collectAsset());
    elements.dialog.close();
  });

  $("#deleteAssetBtn").addEventListener("click", () => {
    const id = $("#assetId").value;
    if (id && confirm("¿Eliminar esta aplicacion del inventario?")) {
      deleteAsset(id);
      elements.dialog.close();
    }
  });
}

/* ===================== AUTENTICACION ===================== */

async function refreshAfterAuth(user) {
  currentUser = user;
  if (user) {
    document.getElementById("loginOverlay")?.classList.add("hidden");
    const emailLabel = document.getElementById("loggedUser");
    if (emailLabel) emailLabel.textContent = user.email || "";
    syncStatus("Conectando...", "saving");
    assets = await DataStore.load();
    render();
    syncStatus("Sincronizado", "ok");
  } else {
    assets = [];
    document.getElementById("loginOverlay")?.classList.remove("hidden");
  }
}

async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;
  const msg = document.getElementById("loginMsg");
  if (!email || !pass) { msg.textContent = "Escribe correo y contrasena."; return; }
  msg.textContent = "Ingresando...";
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { msg.textContent = "Error: " + error.message; return; }
  msg.textContent = "";
  await refreshAfterAuth(data.user);
}

async function doSignup() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;
  const msg = document.getElementById("loginMsg");
  if (!email || pass.length < 6) { msg.textContent = "Contrasena de al menos 6 caracteres."; return; }
  msg.textContent = "Creando cuenta...";
  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error) { msg.textContent = "Error: " + error.message; return; }
  if (data.session) {
    msg.textContent = "";
    await refreshAfterAuth(data.user);
  } else {
    msg.textContent = "Cuenta creada. Revisa tu correo para confirmar y luego inicia sesion.";
  }
}

async function doLogout() {
  await sb.auth.signOut();
  await refreshAfterAuth(null);
}

function bindAuthEvents() {
  document.getElementById("loginBtn")?.addEventListener("click", doLogin);
  document.getElementById("signupBtn")?.addEventListener("click", doSignup);
  document.getElementById("logoutBtn")?.addEventListener("click", doLogout);
  document.getElementById("loginPassword")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
}

/* ===================== ARRANQUE ===================== */

renderCheckboxes("techCheckboxes", TECH_OPTIONS, []);
renderCheckboxes("dependencyCheckboxes", DEPENDENCY_OPTIONS, []);
renderCheckboxes("useCheckboxes", USE_OPTIONS, []);
bindEvents();
bindAuthEvents();

(async () => {
  const { data } = await sb.auth.getSession();
  await refreshAfterAuth(data.session?.user || null);
})();

/* SBM Safety Academy - Generador de la matriz OP-MAT-10.
 *
 * Llena la plantilla oficial "OP-MAT-10 Matriz de capacitaciones" con los videos
 * completados en la academia, para UN proyecto y UN anio.
 *
 * Regla principal: la plantilla NO se reconstruye ni se reescribe con una libreria
 * de Excel. Se abre el .xlsx como zip y solo se tocan, en el XML de la hoja
 * "Matriz Cumplimiento", las celdas que hay que llenar (nombres en la fila 6,
 * "Cumple" y fecha en la grilla, y Ano / Proyecto / Cantidad trabajadores).
 * Todo lo demas (formulas, dashboards, validaciones, formato condicional, imagenes,
 * hojas ocultas) queda byte por byte igual.
 */
(function (root) {
  "use strict";

  const SHEET_NAME = "Matriz Cumplimiento";
  const FIRST_COL = 8;          // H
  const LAST_COL = 109;         // DE  (102 trabajadores como maximo)
  const MAX_WORKERS = LAST_COL - FIRST_COL + 1;
  const FIRST_GRID_ROW = 7;
  const LAST_GRID_ROW = 232;
  const NAME_ROW = 6;
  const DATE_STYLE = "46";      // mismo estilo de la celda, pero con formato de fecha

  // ---------------------------------------------------------------------------
  // Tabla de equivalencias: codigo en la academia -> No. de capacitacion en la matriz
  // (fila de estado = 7 + (No - 1) * 2 ; fila de fecha = la siguiente)
  // mode "all": se marcan todas las filas.  mode "quarter": se marca la fila del
  // trimestre en que se completo (o la mas cercana anterior, avisando).
  // ---------------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, "0");
  const MAP = {};
  MAP["Q1-06"] = { mode: "all", rows: [{ no: 6 }] };
  for (let i = 1; i <= 24; i++) MAP[`OP-P-${pad(i)}`] = { mode: "all", rows: [{ no: 26 + i }] };
  MAP["OP-P-16"] = { mode: "all", rows: [{ no: 42 }, { no: 55 }] }; // + "Limpieza patogenos sanguineos"
  for (let i = 1; i <= 14; i++) MAP[`Q3-${pad(i)}`] = { mode: "all", rows: [{ no: 56 + i }] };
  for (let i = 1; i <= 13; i++) MAP[`Q4-${pad(i)}`] = { mode: "all", rows: [{ no: 70 + i }] };
  MAP["EHS-I-18"] = { mode: "all", rows: [{ no: 11 }] };                                  // Signs and Barricades
  MAP["EHS-I-23"] = { mode: "all", rows: [{ no: 24 }] };                                  // Transporting Loads
  MAP["EHS-I-20"] = { mode: "quarter", rows: [{ no: 16, q: 1 }, { no: 25, q: 2 }] };      // Safe Trashing
  MAP["EHS-I-24"] = { mode: "quarter", rows: [{ no: 14, q: 1 }, { no: 61, q: 3 }] };      // Chemical Dilution Process

  // Controles para no llenar una version distinta de la plantilla.
  const ANCHORS = [
    [1, "Inducción SBM"],
    [6, "Good Catch"],
    [27, "OP-P-01"],
    [57, "Heat Illness Prevention"],
    [71, "Associate Safety Orientation"],
    [87, "Matriz EPP"]
  ];

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  function colToNum(col) {
    let n = 0;
    for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  }
  function numToCol(n) {
    let s = "";
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function escXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function statusRow(no) { return FIRST_GRID_ROW + (no - 1) * 2; }

  // Fecha en hora de Costa Rica -> { y, m, d, serial, quarter }
  function crDateParts(iso) {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" });
    const [y, m, dd] = fmt.format(d).split("-").map(Number);
    const serial = Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 86400000);
    return { y, m, d: dd, serial, quarter: Math.ceil(m / 3) };
  }

  function parseSharedStrings(xml) {
    const out = [];
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = re.exec(xml))) {
      let text = "";
      const tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let t;
      while ((t = tre.exec(m[1]))) text += t[1];
      out.push(text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"));
    }
    return out;
  }

  function cellText(sheetXml, ref, sst) {
    const m = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`).exec(sheetXml);
    if (!m || m[2] == null) return "";
    const v = /<v>([\s\S]*?)<\/v>/.exec(m[2]);
    if (!v) return "";
    return /t="s"/.test(m[1]) ? (sst[Number(v[1])] || "") : v[1];
  }

  // ---------------------------------------------------------------------------
  // Nucleo
  // ---------------------------------------------------------------------------
  /**
   * @param {ArrayBuffer|Uint8Array} templateBuf  plantilla original .xlsx
   * @param {Array} rows   filas de ehs_video_views (con ehs_employees y ehs_training_videos)
   * @param {{project:string, year:number, JSZip?:any}} opts
   */
  async function buildMatrix(templateBuf, rows, opts) {
    const JSZipLib = opts.JSZip || (typeof JSZip !== "undefined" ? JSZip : require("jszip"));
    const project = opts.project;
    const year = Number(opts.year);
    const zip = await JSZipLib.loadAsync(templateBuf, { createFolders: false });

    // --- ubicar la hoja "Matriz Cumplimiento"
    const wbFile = zip.file("xl/workbook.xml");
    const relsFile = zip.file("xl/_rels/workbook.xml.rels");
    if (!wbFile || !relsFile) throw new Error("El archivo no parece un Excel valido.");
    let wbXml = await wbFile.async("string");
    const relsXml = await relsFile.async("string");
    const sheetTag = new RegExp(`<sheet [^>]*name="${SHEET_NAME}"[^>]*r:id="([^"]+)"`).exec(wbXml);
    if (!sheetTag) throw new Error(`No encontre la hoja "${SHEET_NAME}". Suba la plantilla original OP-MAT-10.`);
    const relTag = new RegExp(`<Relationship [^>]*Id="${sheetTag[1]}"[^>]*>`).exec(relsXml);
    const target = relTag && /Target="([^"]+)"/.exec(relTag[0]);
    if (!target) throw new Error("No pude ubicar la hoja dentro del archivo.");
    const sheetPath = "xl/" + target[1].replace(/^\/?(xl\/)?/, "");
    let sheetXml = await zip.file(sheetPath).async("string");
    const sst = parseSharedStrings(await zip.file("xl/sharedStrings.xml").async("string"));
    const stylesXml = await zip.file("xl/styles.xml").async("string");

    // --- controles de version de la plantilla
    if (!/OP-MAT-10/.test(cellText(sheetXml, "B2", sst))) throw new Error("Esta no es la plantilla OP-MAT-10.");
    for (const [no, expected] of ANCHORS) {
      const got = cellText(sheetXml, "C" + statusRow(no), sst);
      if (!norm(got).startsWith(norm(expected))) {
        throw new Error(`La plantilla es distinta a la esperada: en la capacitacion No. ${no} esperaba "${expected}" y encontre "${got}". Hay que actualizar la tabla de equivalencias.`);
      }
    }
    const cellXfs = /<cellXfs[\s\S]*?<\/cellXfs>/.exec(stylesXml)[0].match(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
    if (!cellXfs || !/numFmtId="14"/.test(cellXfs[Number(DATE_STYLE)] || "")) {
      throw new Error("La plantilla cambio de estilos; no encuentro el formato de fecha esperado.");
    }
    const cumpleIdx = sst.findIndex((t) => t === "Cumple");
    if (cumpleIdx < 0) throw new Error('La plantilla no tiene el texto "Cumple".');

    // --- seleccionar registros
    const projKey = norm(project);
    const report = { project, year, personas: 0, marcas: 0, completadosTotal: 0, sinFila: {}, atraso: [], fueraDeRango: [], omitidos: [], advertencias: [] };
    const people = new Map();
    for (const row of rows) {
      const emp = row.ehs_employees || {};
      if (!row.completed || norm(emp.project_site) !== projKey) continue;
      const when = row.completed_at || row.updated_at;
      if (!when) continue;
      const parts = crDateParts(when);
      if (parts.y !== year) continue;
      const key = emp.cedula || emp.full_name;
      if (!people.has(key)) people.set(key, { name: String(emp.full_name || "").trim(), items: [] });
      people.get(key).items.push({ video: row.ehs_training_videos || {}, parts });
      report.completadosTotal++;
    }
    const ordered = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (!ordered.length) throw new Error(`No hay videos completados en ${year} para el proyecto "${project}".`);
    const workers = ordered.slice(0, MAX_WORKERS);
    ordered.slice(MAX_WORKERS).forEach((p) => report.omitidos.push(p.name));
    if (report.omitidos.length) report.advertencias.push(`La matriz solo admite ${MAX_WORKERS} trabajadores; quedaron fuera ${report.omitidos.length}.`);
    report.personas = workers.length;

    // --- armar las celdas a escribir
    const edits = new Map(); // ref -> {kind, value}
    const cumpleMark = new Set();
    workers.forEach((w, i) => {
      const col = numToCol(FIRST_COL + i);
      edits.set(`${col}${NAME_ROW}`, { kind: "istr", value: w.name });
      for (const it of w.items) {
        const code = String(it.video.video_code || "").trim();
        const title = it.video.title || code;
        const map = MAP[code];
        if (!map) { report.sinFila[`${code} - ${title}`] = (report.sinFila[`${code} - ${title}`] || 0) + 1; continue; }
        let targets = map.rows;
        if (map.mode === "quarter") {
          const ok = map.rows.filter((r) => r.q <= it.parts.quarter);
          if (!ok.length) {
            report.fueraDeRango.push(`${w.name}: ${code} - ${title} (Q${it.parts.quarter})`);
            continue;
          }
          const best = ok.reduce((a, b) => (b.q > a.q ? b : a));
          targets = [best];
          if (best.q !== it.parts.quarter) {
            report.atraso.push(`${w.name}: ${code} - ${title} se completo en Q${it.parts.quarter} y se marco la fila Q${best.q}`);
          }
        }
        for (const t of targets) {
          const r = statusRow(t.no);
          const sRef = `${col}${r}`;
          const dRef = `${col}${r + 1}`;
          // si ya habia una marca (dos videos a la misma fila), queda la fecha mas reciente
          const prev = edits.get(dRef);
          if (!prev || prev.value < it.parts.serial) edits.set(dRef, { kind: "date", value: it.parts.serial });
          edits.set(sRef, { kind: "cumple" });
          if (!cumpleMark.has(sRef)) { cumpleMark.add(sRef); report.marcas++; }
        }
      }
    });
    edits.set("C4", { kind: "num", value: year });
    edits.set("C5", { kind: "istr", value: project });
    edits.set("F5", { kind: "num", value: workers.length });

    // --- aplicar al XML: se limpian los datos de ejemplo de la grilla y se escriben las marcas
    const rowRe = /<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g;
    const cellRe = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    const done = new Set();
    sheetXml = sheetXml.replace(rowRe, (rowXml, rn) => {
      const rowNum = Number(rn);
      if (rowNum < 4 || rowNum > LAST_GRID_ROW) return rowXml;
      return rowXml.replace(cellRe, (cell, col, r2, attrs, inner) => {
        const ref = col + r2;
        const style = (/ s="(\d+)"/.exec(attrs) || [])[1];
        const sAttr = style ? ` s="${style}"` : "";
        const e = edits.get(ref);
        if (e) {
          done.add(ref);
          switch (e.kind) {
            case "cumple": return `<c r="${ref}"${sAttr} t="s"><v>${cumpleIdx}</v></c>`;
            case "date": return `<c r="${ref}" s="${DATE_STYLE}"><v>${e.value}</v></c>`;
            case "num": return `<c r="${ref}"${sAttr}><v>${e.value}</v></c>`;
            case "istr": return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escXml(e.value)}</t></is></c>`;
          }
        }
        const c = colToNum(col);
        const inGrid = rowNum >= NAME_ROW && rowNum <= LAST_GRID_ROW && c >= FIRST_COL && c <= LAST_COL;
        if (inGrid && inner != null && !/<f[ >\/]/.test(inner) && /<v>|<is>/.test(inner)) {
          return `<c r="${ref}"${sAttr}/>`; // borra el dato de ejemplo, conserva el formato
        }
        return cell;
      });
    });
    for (const ref of edits.keys()) {
      if (!done.has(ref)) throw new Error(`La celda ${ref} no existe en la plantilla; no se genero el archivo.`);
    }

    // --- que Excel recalcule dashboards y porcentajes al abrir
    wbXml = wbXml.replace(/<calcPr ([^>]*?)\/>/, (m, a) => (/fullCalcOnLoad/.test(a) ? m : `<calcPr ${a} fullCalcOnLoad="1"/>`));

    zip.file(sheetPath, sheetXml, { createFolders: false });
    zip.file("xl/workbook.xml", wbXml, { createFolders: false });
    const type = typeof Blob !== "undefined" ? "blob" : "nodebuffer";
    const out = await zip.generateAsync({ type, compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    return { file: out, report };
  }

  // ---------------------------------------------------------------------------
  // Interfaz (panel de administrador)
  // ---------------------------------------------------------------------------
  function initUI() {
    const box = document.getElementById("matrizBox");
    if (!box) return;
    const fileIn = document.getElementById("matrizTemplate");
    const projSel = document.getElementById("matrizProject");
    const yearIn = document.getElementById("matrizYear");
    const btn = document.getElementById("matrizBtn");
    const out = document.getElementById("matrizReport");
    yearIn.value = new Date().getFullYear();

    const adminRows = () => (typeof state !== "undefined" && state.adminRows) || [];

    function refreshProjects() {
      const counts = new Map();
      adminRows().forEach((r) => {
        const p = (r.ehs_employees || {}).project_site;
        if (r.completed && p) counts.set(p, (counts.get(p) || 0) + 1);
      });
      const current = projSel.value;
      projSel.innerHTML = '<option value="">Elija el proyecto</option>';
      [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")).forEach(([p, n]) => {
        const o = document.createElement("option");
        o.value = p;
        o.textContent = `${p} (${n} completados)`;
        projSel.appendChild(o);
      });
      projSel.value = current;
      if (!current && counts.size === 1) projSel.value = [...counts.keys()][0]; // un solo proyecto: queda elegido
    }
    window.SBMMatriz = { refresh: refreshProjects };
    projSel.addEventListener("focus", refreshProjects);
    projSel.addEventListener("mousedown", refreshProjects);

    function renderReport(rep, fileName) {
      const li = (arr) => arr.map((t) => `<li>${escXml(t)}</li>`).join("");
      const sin = Object.entries(rep.sinFila).map(([k, n]) => `${k}: ${n} persona(s)`);
      out.innerHTML = `
        <p><strong>Listo.</strong> ${escXml(fileName)}</p>
        <ul>
          <li>${rep.personas} trabajador(es) en la matriz, ${rep.marcas} casillas marcadas "Cumple" con su fecha.</li>
          ${rep.advertencias.length ? li(rep.advertencias) : ""}
        </ul>
        ${sin.length ? `<p><strong>Completados que no tienen fila en la matriz (no se escribieron):</strong></p><ul>${li(sin)}</ul>` : ""}
        ${rep.atraso.length ? `<p><strong>Marcados en el trimestre anterior (completados despues de su trimestre):</strong></p><ul>${li(rep.atraso.slice(0, 40))}${rep.atraso.length > 40 ? `<li>... y ${rep.atraso.length - 40} mas</li>` : ""}</ul>` : ""}
        ${rep.fueraDeRango.length ? `<p><strong>Revisar (fecha anterior a todas las filas):</strong></p><ul>${li(rep.fueraDeRango)}</ul>` : ""}
        <p class="field-hint">Al abrir el Excel se recalculan solos los porcentajes y dashboards.</p>`;
    }

    btn.addEventListener("click", async () => {
      out.textContent = "";
      try {
        if (!window.JSZip) throw new Error("No se pudo cargar JSZip. Revise la conexion a internet.");
        const file = fileIn.files[0];
        if (!file) throw new Error("Suba primero la plantilla original OP-MAT-10 (.xlsx).");
        if (!projSel.value) throw new Error("Elija el proyecto.");
        if (!adminRows().length) throw new Error('Abra primero "Registros" para cargar los datos de la academia.');
        btn.disabled = true;
        const { file: blob, report } = await buildMatrix(await file.arrayBuffer(), adminRows(), { project: projSel.value, year: yearIn.value });
        const safe = projSel.value.replace(/[^\w\-]+/g, "_");
        const name = `OP-MAT-10_Matriz_de_capacitaciones_${safe}_${yearIn.value}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        renderReport(report, name);
      } catch (err) {
        out.innerHTML = `<p style="color:#b91c1c"><strong>No se genero la matriz:</strong> ${escXml(err.message)}</p>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUI);
    else initUI();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { buildMatrix, MAP, statusRow, parseSharedStrings };
})(typeof window !== "undefined" ? window : globalThis);

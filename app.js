const CSV_URLS = {
  selector: "/api/sheet?tab=Selector_Referencias",
  componentes: "/api/sheet?tab=Componentes_Criticos",
  explosion: "/api/sheet?tab=Explosion_Necesidades"
};

const state = {
  selector: [],
  componentes: [],
  explosion: []
};

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupEvents();
  loadAllData();
});

function setupEvents() {
  document.getElementById("refreshBtn").addEventListener("click", loadAllData);

  document.getElementById("selectorSearch").addEventListener("input", renderSelector);
  document.getElementById("estadoFilter").addEventListener("change", renderSelector);
  document.getElementById("decisionFilter").addEventListener("change", renderSelector);
  document.getElementById("semanaFilter").addEventListener("change", renderSelector);

  document.getElementById("componentSearch").addEventListener("input", renderComponentes);
  document.getElementById("prioridadFilter").addEventListener("change", renderComponentes);
  document.getElementById("accionFilter").addEventListener("change", renderComponentes);

  document.getElementById("itemDetailSelect").addEventListener("change", renderDetalleProducto);
  document.getElementById("detailEstadoFilter").addEventListener("change", renderDetalleProducto);
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });
}

async function loadAllData() {
  showLoading(true);
  showError("");

  try {
    const [selector, componentes, explosion] = await Promise.all([
      loadCsv(CSV_URLS.selector, "Selector_Referencias"),
      loadCsv(CSV_URLS.componentes, "Componentes_Criticos"),
      loadCsv(CSV_URLS.explosion, "Explosion_Necesidades")
    ]);

    state.selector = selector;
    state.componentes = componentes;
    state.explosion = explosion;

    console.log("Selector length:", selector.length);
    console.log("Selector first row:", selector[0]);

    console.log("Componentes length:", componentes.length);
    console.log("Componentes first row:", componentes[0]);

    console.log("Explosion length:", explosion.length);
    console.log("Explosion first row:", explosion[0]);

    populateFilters();
    renderAll();
  } catch (error) {
    console.error(error);
    showError(error.message || "Error cargando datos.");
  } finally {
    showLoading(false);
  }
}

async function loadCsv(url, name = "CSV") {
  if (!url || url.includes("PEGA_AQUI")) {
    throw new Error(`Falta configurar la URL CSV de ${name}.`);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${name}: error HTTP ${response.status}`);
  }

  const text = await response.text();

  if (text.includes("<html") || text.includes("<!DOCTYPE")) {
    throw new Error(`${name}: la URL devuelve HTML, no CSV.`);
  }

  return csvToObjects(text, name);
}

function csvToObjects(csvText, name = "CSV") {
  const rowsComma = parseCsv(csvText, ",");
  const rowsSemicolon = parseCsv(csvText, ";");

  const rows =
    countUsefulCells(rowsSemicolon) > countUsefulCells(rowsComma)
      ? rowsSemicolon
      : rowsComma;

  if (!rows.length) return [];

  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => normalize(cell));

    const hasSelectorHeader =
      normalized.includes("item madre") &&
      normalized.includes("semana") &&
      normalized.includes("cantidad plan");

    const hasComponentHeader =
      normalized.includes("componente") &&
      normalized.includes("productos afectados");

    const hasExplosionHeader =
      normalized.includes("item madre") &&
      normalized.includes("semana") &&
      normalized.includes("cantidad plan") &&
      normalized.includes("componente");

    return hasSelectorHeader || hasComponentHeader || hasExplosionHeader;
  });

  if (headerRowIndex === -1) {
    console.warn(`${name}: no se encontró fila de cabecera válida`, rows.slice(0, 10));
    return [];
  }

  const headers = rows[headerRowIndex].map(cleanHeader);

  console.log(`${name} headers detectados:`, headers);

  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index] ?? "";
      });

      return obj;
    });
}

function countUsefulCells(rows) {
  return rows
    .slice(0, 10)
    .reduce((total, row) => total + row.length, 0);
}

function parseCsv(text, delimiter = ",") {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentValue += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;

      currentRow.push(currentValue);
      rows.push(currentRow);

      currentRow = [];
      currentValue = "";
    } else {
      currentValue += char;
    }
  }

  if (currentValue !== "" || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function cleanHeader(header) {
  return String(header || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getValue(row, possibleKeys) {
  const keys = Object.keys(row || {});

  for (const wanted of possibleKeys) {
    const wantedNorm = normalize(wanted);
    const foundKey = keys.find((key) => normalize(key) === wantedNorm);
    if (foundKey) return row[foundKey];
  }

  return "";
}

function toNumber(value) {
  if (typeof value === "number") return value;

  const text = String(value || "")
    .replace("%", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  const number = toNumber(value);
  return new Intl.NumberFormat("es-ES").format(number);
}

function formatPercent(value) {
  const number = toNumber(value);

  if (number <= 1) {
    return `${Math.round(number * 100)}%`;
  }

  return `${Math.round(number)}%`;
}

function renderAll() {
  renderSummary();
  renderSelector();
  renderComponentes();
  renderSinBom();
  renderItemSelect();
  renderDetalleProducto();
}

function populateFilters() {
  fillSelect(
    "estadoFilter",
    uniqueValuesByGetter(state.selector, (row) => getValue(row, ["Estado"])),
    "Todos los estados"
  );

  fillSelect(
    "decisionFilter",
    uniqueValuesByGetter(state.selector, (row) => getValue(row, ["Decisión sugerida", "Decision sugerida"])),
    "Todas las decisiones"
  );

  fillSelect(
    "semanaFilter",
    uniqueValuesByGetter(state.selector, (row) => getValue(row, ["Semana"]), true),
    "Todas las semanas"
  );

  fillSelect(
    "prioridadFilter",
    uniqueValuesByGetter(state.componentes, (row) => getValue(row, ["Prioridad"])),
    "Todas las prioridades"
  );

  fillSelect(
    "accionFilter",
    uniqueValuesByGetter(state.componentes, (row) => getValue(row, ["Acción sugerida", "Accion sugerida"])),
    "Todas las acciones"
  );
}

function uniqueValuesByGetter(data, getter, numeric = false) {
  const values = [
    ...new Set(
      data
        .map(getter)
        .filter((value) => String(value || "").trim() !== "")
    )
  ];

  if (numeric) {
    return values.sort((a, b) => toNumber(a) - toNumber(b));
  }

  return values.sort((a, b) => String(a).localeCompare(String(b), "es"));
}

function fillSelect(selectId, values, defaultText) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;

  select.innerHTML = `<option value="">${defaultText}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (values.includes(currentValue)) {
    select.value = currentValue;
  }
}

function renderSummary() {
  const selector = state.selector;
  const componentes = state.componentes;
  const explosion = state.explosion;

  setText("totalRefs", selector.length);

  setText(
    "fabricables",
    selector.filter((r) => getValue(r, ["Estado"]) === "FABRICABLE").length
  );

  setText(
    "atacarYa",
    selector.filter((r) => getValue(r, ["Decisión sugerida", "Decision sugerida"]) === "Atacar ya").length
  );

  setText(
    "componentesDeficit",
    componentes.filter((r) => toNumber(getValue(r, ["Déficit total", "Deficit total"])) > 0).length
  );

  setText(
    "componentesCriticos",
    componentes.filter((r) => getValue(r, ["Prioridad"]) === "CRITICA").length
  );

  setText(
    "sinBom",
    explosion.filter((r) => getValue(r, ["Estado"]) === "SIN BOM").length
  );
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderSelector() {
  const search = normalize(document.getElementById("selectorSearch").value);
  const estado = document.getElementById("estadoFilter").value;
  const decision = document.getElementById("decisionFilter").value;
  const semana = document.getElementById("semanaFilter").value;

  let rows = [...state.selector];

  rows = rows.filter((row) => {
    const item = getValue(row, ["Item madre", "Item"]);
    const rowEstado = getValue(row, ["Estado"]);
    const rowDecision = getValue(row, ["Decisión sugerida", "Decision sugerida"]);
    const rowSemana = getValue(row, ["Semana"]);

    const matchesSearch = !search || normalize(item).includes(search);
    const matchesEstado = !estado || rowEstado === estado;
    const matchesDecision = !decision || rowDecision === decision;
    const matchesSemana = !semana || String(rowSemana) === String(semana);

    return matchesSearch && matchesEstado && matchesDecision && matchesSemana;
  });

  rows.sort((a, b) => {
    return toNumber(getValue(b, ["Score prioridad", "Score"])) -
      toNumber(getValue(a, ["Score prioridad", "Score"]));
  });

  const displayRows = rows.map((row) => ({
    "Item madre": getValue(row, ["Item madre", "Item"]),
    "Semana": getValue(row, ["Semana"]),
    "Cantidad plan": getValue(row, ["Cantidad plan", "Cantidad"]),
    "Componentes faltantes": getValue(row, ["Componentes faltantes", "Faltantes"]),
    "% cubierto": getValue(row, ["% cubierto", "Cubierto"]),
    "Unidades posibles": getValue(row, ["Unidades posibles"]),
    "Estado": getValue(row, ["Estado"]),
    "Score prioridad": getValue(row, ["Score prioridad", "Score"]),
    "Decisión sugerida": getValue(row, ["Decisión sugerida", "Decision sugerida"])
  }));

  const columns = [
    "Item madre",
    "Semana",
    "Cantidad plan",
    "Componentes faltantes",
    "% cubierto",
    "Unidades posibles",
    "Estado",
    "Score prioridad",
    "Decisión sugerida"
  ];

  renderTable("selectorTable", displayRows, columns, {
    "Item madre": (value) => `<span class="clickable" onclick="openDetail('${escapeAttr(value)}')">${escapeHtml(value)}</span>`,
    "% cubierto": formatPercent,
    "Cantidad plan": formatNumber,
    "Unidades posibles": formatNumber,
    "Estado": renderEstadoBadge,
    "Decisión sugerida": renderDecisionBadge
  });
}

function renderComponentes() {
  const search = normalize(document.getElementById("componentSearch").value);
  const prioridad = document.getElementById("prioridadFilter").value;
  const accion = document.getElementById("accionFilter").value;

  let rows = [...state.componentes];

  rows = rows.filter((row) => {
    const componente = getValue(row, ["Componente"]);
    const rowPrioridad = getValue(row, ["Prioridad"]);
    const rowAccion = getValue(row, ["Acción sugerida", "Accion sugerida"]);

    const matchesSearch = !search || normalize(componente).includes(search);
    const matchesPrioridad = !prioridad || rowPrioridad === prioridad;
    const matchesAccion = !accion || rowAccion === accion;

    return matchesSearch && matchesPrioridad && matchesAccion;
  });

  rows.sort((a, b) => {
    const semanaA = toNumber(getValue(a, ["Primera semana afectada", "Primera semana"])) || 999;
    const semanaB = toNumber(getValue(b, ["Primera semana afectada", "Primera semana"])) || 999;

    if (semanaA !== semanaB) return semanaA - semanaB;

    return toNumber(getValue(b, ["Déficit total", "Deficit total"])) -
      toNumber(getValue(a, ["Déficit total", "Deficit total"]));
  });

  const displayRows = rows.map((row) => ({
    "Componente": getValue(row, ["Componente"]),
    "Productos afectados": getValue(row, ["Productos afectados"]),
    "Items afectados": getValue(row, ["Items afectados"]),
    "Semanas afectadas": getValue(row, ["Semanas afectadas"]),
    "Primera semana afectada": getValue(row, ["Primera semana afectada", "Primera semana"]),
    "Nº líneas afectadas": getValue(row, ["Nº líneas afectadas", "No lineas afectadas", "N líneas afectadas"]),
    "Necesidad total": getValue(row, ["Necesidad total"]),
    "Stock actual": getValue(row, ["Stock actual", "Stock"]),
    "Déficit total": getValue(row, ["Déficit total", "Deficit total"]),
    "Déficit acumulado hasta primera semana": getValue(row, ["Déficit acumulado hasta primera semana", "Deficit acumulado hasta primera semana"]),
    "Peor plazo": getValue(row, ["Peor plazo"]),
    "Prioridad": getValue(row, ["Prioridad"]),
    "Acción sugerida": getValue(row, ["Acción sugerida", "Accion sugerida"])
  }));

  const columns = [
    "Componente",
    "Productos afectados",
    "Items afectados",
    "Semanas afectadas",
    "Primera semana afectada",
    "Nº líneas afectadas",
    "Necesidad total",
    "Stock actual",
    "Déficit total",
    "Déficit acumulado hasta primera semana",
    "Peor plazo",
    "Prioridad",
    "Acción sugerida"
  ];

  renderTable("componentesTable", displayRows, columns, {
    "Necesidad total": formatNumber,
    "Stock actual": formatNumber,
    "Déficit total": formatNumber,
    "Déficit acumulado hasta primera semana": formatNumber,
    "Prioridad": renderPrioridadBadge
  });
}

function renderSinBom() {
  const rows = state.explosion
    .filter((row) => getValue(row, ["Estado"]) === "SIN BOM")
    .sort((a, b) => {
      return toNumber(getValue(a, ["Semana"])) - toNumber(getValue(b, ["Semana"]));
    });

  const displayRows = rows.map((row) => ({
    "Item madre": getValue(row, ["Item madre", "Item"]),
    "Semana": getValue(row, ["Semana"]),
    "Cantidad plan": getValue(row, ["Cantidad plan", "Cantidad"]),
    "Producto madre completo": getValue(row, ["Producto madre completo", "Producto madre"]),
    "Estado": getValue(row, ["Estado"])
  }));

  const columns = [
    "Item madre",
    "Semana",
    "Cantidad plan",
    "Producto madre completo",
    "Estado"
  ];

  renderTable("sinBomTable", displayRows, columns, {
    "Cantidad plan": formatNumber,
    "Estado": renderEstadoBadge
  });
}

function renderItemSelect() {
  const select = document.getElementById("itemDetailSelect");

  const items = [
    ...new Set(
      state.explosion
        .map((row) => getValue(row, ["Item madre", "Item"]))
        .filter((value) => String(value || "").trim() !== "")
    )
  ].sort((a, b) => String(a).localeCompare(String(b), "es"));

  select.innerHTML = `<option value="">Selecciona un item...</option>`;

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}

function openDetail(item) {
  const decoded = decodeURIComponent(item);

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === "detalle");
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.toggle("active", content.id === "detalle");
  });

  document.getElementById("itemDetailSelect").value = decoded;
  renderDetalleProducto();
}

function renderDetalleProducto() {
  const item = document.getElementById("itemDetailSelect").value;
  const estadoFilter = document.getElementById("detailEstadoFilter").value;

  if (!item) {
    document.getElementById("detailSummary").innerHTML = "";
    renderTable("detalleTable", [], [
      "Item madre",
      "Semana",
      "Componente",
      "Cantidad escandallo",
      "Necesidad componente",
      "Stock actual",
      "Plazo entrega",
      "Estado"
    ]);
    return;
  }

  let rows = state.explosion.filter((row) => {
    return getValue(row, ["Item madre", "Item"]) === item;
  });

  if (estadoFilter) {
    rows = rows.filter((row) => {
      return getValue(row, ["Estado"]) === estadoFilter;
    });
  }

  const total = rows.length;
  const faltan = rows.filter((row) => getValue(row, ["Estado"]) === "FALTA").length;
  const ok = rows.filter((row) => getValue(row, ["Estado"]) === "OK").length;

  document.getElementById("detailSummary").innerHTML = `
    <div class="detail-pill"><strong>${escapeHtml(item)}</strong></div>
    <div class="detail-pill">Componentes: <strong>${total}</strong></div>
    <div class="detail-pill">OK: <strong>${ok}</strong></div>
    <div class="detail-pill">Faltan: <strong>${faltan}</strong></div>
  `;

  const displayRows = rows.map((row) => ({
    "Item madre": getValue(row, ["Item madre", "Item"]),
    "Semana": getValue(row, ["Semana"]),
    "Cantidad plan": getValue(row, ["Cantidad plan", "Cantidad"]),
    "Componente": getValue(row, ["Componente"]),
    "Cantidad escandallo": getValue(row, ["Cantidad escandallo"]),
    "Necesidad componente": getValue(row, ["Necesidad componente", "Necesidad"]),
    "Stock actual": getValue(row, ["Stock actual", "Stock"]),
    "Plazo entrega": getValue(row, ["Plazo entrega", "Plazo de entrega"]),
    "Estado": getValue(row, ["Estado"])
  }));

  const columns = [
    "Item madre",
    "Semana",
    "Cantidad plan",
    "Componente",
    "Cantidad escandallo",
    "Necesidad componente",
    "Stock actual",
    "Plazo entrega",
    "Estado"
  ];

  renderTable("detalleTable", displayRows, columns, {
    "Cantidad plan": formatNumber,
    "Cantidad escandallo": formatNumber,
    "Necesidad componente": formatNumber,
    "Stock actual": formatNumber,
    "Estado": renderEstadoBadge
  });
}

function renderTable(tableId, rows, columns, formatters = {}) {
  const table = document.getElementById(tableId);

  if (!rows.length) {
    table.innerHTML = `
      <thead>
        <tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        <tr><td colspan="${columns.length}">Sin datos</td></tr>
      </tbody>
    `;
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        ${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          ${columns.map((col) => {
            const rawValue = row[col] ?? "";
            const formatter = formatters[col];
            const value = formatter ? formatter(rawValue, row) : escapeHtml(rawValue);

            return `<td>${value}</td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderEstadoBadge(value) {
  const text = String(value || "");

  if (text === "FABRICABLE" || text === "OK") {
    return `<span class="badge green">${escapeHtml(text)}</span>`;
  }

  if (text === "CASI FABRICABLE") {
    return `<span class="badge yellow">${escapeHtml(text)}</span>`;
  }

  if (text === "ATACABLE" || text === "FALTA") {
    return `<span class="badge orange">${escapeHtml(text)}</span>`;
  }

  if (text === "BLOQUEADO" || text === "SIN BOM") {
    return `<span class="badge red">${escapeHtml(text)}</span>`;
  }

  return `<span class="badge gray">${escapeHtml(text)}</span>`;
}

function renderPrioridadBadge(value) {
  const text = String(value || "");

  if (text === "CRITICA") {
    return `<span class="badge red">${escapeHtml(text)}</span>`;
  }

  if (text === "ALTA") {
    return `<span class="badge orange">${escapeHtml(text)}</span>`;
  }

  if (text === "MEDIA") {
    return `<span class="badge yellow">${escapeHtml(text)}</span>`;
  }

  if (text === "OK") {
    return `<span class="badge green">${escapeHtml(text)}</span>`;
  }

  return `<span class="badge gray">${escapeHtml(text)}</span>`;
}

function renderDecisionBadge(value) {
  const text = String(value || "");

  if (text === "Fabricar") {
    return `<span class="badge green">${escapeHtml(text)}</span>`;
  }

  if (text === "Atacar ya") {
    return `<span class="badge red">${escapeHtml(text)}</span>`;
  }

  if (text === "Revisar faltantes" || text === "Fabricación parcial posible") {
    return `<span class="badge orange">${escapeHtml(text)}</span>`;
  }

  if (text === "Aparcar") {
    return `<span class="badge gray">${escapeHtml(text)}</span>`;
  }

  return `<span class="badge yellow">${escapeHtml(text)}</span>`;
}

function showLoading(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

function showError(message) {
  const box = document.getElementById("errorBox");

  if (!message) {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }

  box.textContent = message;
  box.classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return encodeURIComponent(String(value ?? ""));
}

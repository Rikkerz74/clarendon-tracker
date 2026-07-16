const REPORTS_KEY = "reports";
const DOCUMENTS_KEY = "documents";

const SUMMARY_TITLE = "Clarendon Accounts Review (2022-2024)";
const SUMMARY_DRAFT = `Executive summary
Clarendon does not appear to have a demand problem. Revenue has scaled strongly, and the opportunity now is to support the owners' premium, high-end vision while ensuring growth remains well controlled operationally. The core theme is premium positioning and outstanding service first, with sensible cost visibility in the background so additional revenue converts into sustainable performance.

Data note
This review is based on 2024 financial data, so it should be treated as directional context rather than a live operating view.

What the numbers are saying
- Revenue grew from GBP1.378m (2022) to GBP2.095m (2024), around 52% growth in two years.
- Profit before tax fell from GBP367k (2022) to GBP196k (2024), around 46% decline.
- Net profit reduced from GBP301k (2022) to GBP146k (2024).
- Gross profit percentage softened (47.5% to 41.8%), but the larger issue is overhead escalation, not core clinical demand.

Where margin has been lost
- Administrative expenses rose from GBP271k (2022) to GBP605k (2024), more than doubling.
- New management charges of GBP84k appeared in 2024.
- Advertising increased from GBP14.9k (2022) to GBP45.6k (2024), so return on marketing spend must be proven.
- Property repairs and rent increased materially, suggesting either investment transition costs or structural cost drift.
- Borrowing and interest costs rose sharply, consistent with expansion, but requiring stronger productivity from the invested capital.

Operational interpretation
Daily performance highlights the issue clearly: revenue per day has risen strongly, but profit kept per day has fallen. The practice is producing more clinical activity, yet too much additional turnover is being absorbed by overhead and financing drag.

Strategic implication for Clarendon
The right message is not simply "raise fees." It is: premium fee architecture plus premium experience, backed by productivity and overhead control. If fees increase without delivery consistency and cost control, margin gains will leak. If both are managed together, profitability can recover quickly.

Illustrative upside
At current turnover, a 5% to 10% fee uplift is potentially material. If most fixed costs hold and around 70% of incremental revenue drops through, a 10% uplift could add approximately GBP145k to GBP150k annual profit, materially improving current performance.

Priority questions for leadership
- Which overhead lines are strategic investments versus unmanaged drift?
- What measurable return came from increased advertising spend?
- Which clinicians and services are strongest by production and profitability?
- Are enquiry-to-consultation and consultation-to-treatment conversions tracked reliably, including orthodontic pathways?
- Where is unused capacity and where are bottlenecks limiting margin?

Recommended 90-day focus
1) Keep building the premium patient journey and service consistency that underpin the long-term strategy.
2) Introduce a light-touch KPI rhythm (production, conversion, utilisation, treatment value, source ROI) to support decision-making without distracting the team.
3) Review key overhead lines monthly (admin, management charges, repairs, rent, marketing) to maintain cost awareness while growth continues.
4) Continue premium pricing and value communication in a measured, clinician-consistent way aligned to patient experience.

Conclusion
Clarendon has already demonstrated strong growth potential. The next phase is about delivering the owners' premium vision with exceptional service standards, while maintaining calm and consistent oversight of costs. As newer data becomes available, this view should be refreshed so decisions stay aligned with current performance.`;

let registry = {};
let reports = [];
let documents = [];
let selectedReportId = null;

const elements = {
  list: document.getElementById("reportList"),
  title: document.getElementById("reportTitle"),
  body: document.getElementById("reportBody"),
  upload: document.getElementById("reportFileInput"),
  documentUpload: document.getElementById("documentFileInput"),
  documentDescription: document.getElementById("documentDescription"),
  documentAudience: document.getElementById("documentAudience"),
  uploadName: document.getElementById("uploadName"),
  documentUploadName: document.getElementById("documentUploadName"),
  saveBtn: document.getElementById("saveReportBtn"),
  uploadDocumentBtn: document.getElementById("uploadDocumentBtn"),
  deleteBtn: document.getElementById("deleteReportBtn"),
  newBtn: document.getElementById("newReportBtn"),
  loadDraftBtn: document.getElementById("loadDraftBtn"),
  documentList: document.getElementById("documentList"),
  signOutBtn: document.getElementById("signOutBtn")
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `report-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatDate(value) {
  if (!value) {
    return "Unsaved";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unsaved";
  }
}

function normalizeReport(entry) {
  return {
    id: entry.id || makeId(),
    title: String(entry.title || "Untitled report"),
    body: String(entry.body || ""),
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString()
  };
}

function normalizeReports(rawReports) {
  if (!Array.isArray(rawReports)) {
    return [];
  }

  return rawReports.map((entry) => normalizeReport(entry));
}

function normalizeDocuments(rawDocuments) {
  if (!Array.isArray(rawDocuments)) {
    return [];
  }

  return rawDocuments
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: String(entry.id || makeId()),
      title: String(entry.title || entry.originalName || "Uploaded document"),
      originalName: String(entry.originalName || "document"),
      mimeType: String(entry.mimeType || "application/octet-stream"),
      size: Number(entry.size || 0),
      uploadedAt: entry.uploadedAt || new Date().toISOString(),
      description: String(entry.description || ""),
      audience: String(entry.audience || "")
    }));
}

function sortReports() {
  reports.sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
    return rightTime - leftTime;
  });
}

function sortDocuments() {
  documents.sort((left, right) => {
    const leftTime = Date.parse(left.uploadedAt || 0) || 0;
    const rightTime = Date.parse(right.uploadedAt || 0) || 0;
    return rightTime - leftTime;
  });
}

function formatSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const kb = size / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function renderDocumentList() {
  elements.documentList.innerHTML = "";

  if (!documents.length) {
    const empty = document.createElement("p");
    empty.className = "helper";
    empty.textContent = "No shared documents yet.";
    elements.documentList.appendChild(empty);
    return;
  }

  documents.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "document-item";
    article.innerHTML = `<strong>${entry.title}</strong><span>${formatSize(entry.size)} • Uploaded ${formatDate(entry.uploadedAt)}</span>`;

    if (entry.description || entry.audience) {
      const meta = document.createElement("div");
      meta.className = "document-meta";
      if (entry.description) {
        const description = document.createElement("span");
        description.innerHTML = `<span class="meta-label">Note:</span> ${entry.description}`;
        meta.appendChild(description);
      }
      if (entry.audience) {
        const audience = document.createElement("span");
        audience.innerHTML = `<span class="meta-label">For:</span> ${entry.audience}`;
        meta.appendChild(audience);
      }
      article.appendChild(meta);
    }

    const actions = document.createElement("div");
    actions.className = "document-actions";

    const openLink = document.createElement("a");
    openLink.href = `/api/documents/${encodeURIComponent(entry.id)}`;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.className = "doc-link";
    openLink.textContent = "Open";
    actions.appendChild(openLink);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "doc-delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteDocument(entry.id).catch((error) => {
        console.error(error);
        alert(error.message || "Could not delete document.");
      });
    });
    actions.appendChild(deleteButton);

    article.appendChild(actions);
    elements.documentList.appendChild(article);
  });
}

function renderReportList() {
  elements.list.innerHTML = "";

  if (!reports.length) {
    const empty = document.createElement("p");
    empty.className = "helper";
    empty.textContent = "No reports saved yet.";
    elements.list.appendChild(empty);
    return;
  }

  reports.forEach((report) => {
    const article = document.createElement("article");
    article.className = "report-item";
    if (report.id === selectedReportId) {
      article.classList.add("active");
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "report-open";
    openButton.innerHTML = `<strong>${report.title}</strong><span>Updated ${formatDate(report.updatedAt)}</span>`;
    openButton.addEventListener("click", () => {
      loadReport(report.id);
    });

    const actions = document.createElement("div");
    actions.className = "report-item-actions";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "doc-delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      deleteReportById(report.id).catch((error) => {
        console.error(error);
        alert(error.message || "Could not delete report.");
      });
    });

    actions.appendChild(deleteButton);
    article.appendChild(openButton);
    article.appendChild(actions);

    elements.list.appendChild(article);
  });
}

function loadReport(reportId) {
  const report = reports.find((entry) => entry.id === reportId);
  if (!report) {
    return;
  }

  selectedReportId = report.id;
  elements.title.value = report.title;
  elements.body.value = report.body;
  renderReportList();
}

function clearEditor() {
  selectedReportId = null;
  elements.title.value = "";
  elements.body.value = "";
  renderReportList();
}

async function persistRegistry() {
  registry = {
    ...(registry && typeof registry === "object" ? registry : {}),
    [REPORTS_KEY]: reports,
    updatedAt: new Date().toISOString()
  };

  const response = await fetch("/api/state", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registry })
  });

  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!response.ok) {
    throw new Error("Unable to save reports.");
  }
}

async function saveCurrentReport() {
  const title = elements.title.value.trim() || "Untitled report";
  const body = elements.body.value.trim();

  if (!body) {
    alert("Please add report content before saving.");
    return;
  }

  const now = new Date().toISOString();

  if (selectedReportId) {
    const existing = reports.find((entry) => entry.id === selectedReportId);
    if (!existing) {
      return;
    }

    existing.title = title;
    existing.body = body;
    existing.updatedAt = now;
  } else {
    const newReport = {
      id: makeId(),
      title,
      body,
      createdAt: now,
      updatedAt: now
    };
    reports.push(newReport);
    selectedReportId = newReport.id;
  }

  sortReports();
  await persistRegistry();
  renderReportList();
}

async function deleteCurrentReport() {
  if (!selectedReportId) {
    return;
  }

  const report = reports.find((entry) => entry.id === selectedReportId);
  if (!report) {
    return;
  }

  const confirmed = window.confirm(`Delete report "${report.title}"?`);
  if (!confirmed) {
    return;
  }

  reports = reports.filter((entry) => entry.id !== selectedReportId);
  clearEditor();
  await persistRegistry();
  renderReportList();
}

async function deleteReportById(reportId) {
  const report = reports.find((entry) => entry.id === reportId);
  if (!report) {
    return;
  }

  const confirmed = window.confirm(`Delete note "${report.title}"?`);
  if (!confirmed) {
    return;
  }

  reports = reports.filter((entry) => entry.id !== reportId);
  if (selectedReportId === reportId) {
    clearEditor();
  }
  await persistRegistry();
  renderReportList();
}

function loadDraftIntoEditor() {
  const hasContent = elements.title.value.trim() || elements.body.value.trim();
  if (hasContent) {
    const confirmed = window.confirm("Replace current editor content with the summary draft?");
    if (!confirmed) {
      return;
    }
  }

  selectedReportId = null;
  elements.title.value = SUMMARY_TITLE;
  elements.body.value = SUMMARY_DRAFT;
  renderReportList();
}

function handleFileUpload(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  elements.uploadName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = () => {
    const content = String(reader.result || "");
    const title = file.name.replace(/\.[^.]+$/, "");

    selectedReportId = null;
    elements.title.value = title || "Uploaded report";
    elements.body.value = content;
    renderReportList();
  };

  reader.readAsText(file);
}

function handleDocumentSelection(event) {
  const [file] = event.target.files || [];
  elements.documentUploadName.textContent = file ? file.name : "No document selected";
}

async function uploadDocument() {
  const [file] = elements.documentUpload.files || [];
  if (!file) {
    alert("Choose a file first, then click 'Add to shared documents'.");
    return;
  }

  const formData = new FormData();
  formData.append("document", file);
  formData.append("title", file.name.replace(/\.[^.]+$/, "") || file.name);
  formData.append("description", String(elements.documentDescription.value || "").trim());
  formData.append("audience", String(elements.documentAudience.value || "").trim());

  const response = await fetch("/api/documents", {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload && payload.error ? payload.error : "Could not upload document.";
    throw new Error(message);
  }

  const payload = await response.json();
  documents = normalizeDocuments(payload.documents);
  sortDocuments();
  renderDocumentList();
  elements.documentUpload.value = "";
  elements.documentUploadName.textContent = "No document selected";
  elements.documentDescription.value = "";
  elements.documentAudience.value = "";
}

async function deleteDocument(documentId) {
  const entry = documents.find((item) => item.id === documentId);
  if (!entry) {
    return;
  }

  const confirmed = window.confirm(`Delete shared document "${entry.title}"?`);
  if (!confirmed) {
    return;
  }

  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload && payload.error ? payload.error : "Could not delete document.";
    throw new Error(message);
  }

  const payload = await response.json();
  documents = normalizeDocuments(payload.documents);
  sortDocuments();
  renderDocumentList();
}

async function hydrateDocuments() {
  const response = await fetch("/api/documents", { credentials: "include" });

  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!response.ok) {
    throw new Error("Unable to load documents.");
  }

  const payload = await response.json();
  documents = normalizeDocuments(payload[DOCUMENTS_KEY] || payload.documents);
  sortDocuments();
  renderDocumentList();
}

async function hydrateReports() {
  const response = await fetch("/api/state", { credentials: "include" });

  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!response.ok) {
    throw new Error("Unable to load reports.");
  }

  registry = await response.json();
  reports = normalizeReports(registry[REPORTS_KEY]);
  documents = normalizeDocuments(registry[DOCUMENTS_KEY]);
  sortReports();
  sortDocuments();
  renderReportList();
  renderDocumentList();

  if (reports.length) {
    loadReport(reports[0].id);
  }

  await hydrateDocuments();
}

function bindEvents() {
  elements.saveBtn.addEventListener("click", () => {
    saveCurrentReport().catch((error) => {
      console.error(error);
      alert("Could not save report. Please try again.");
    });
  });

  elements.deleteBtn.addEventListener("click", () => {
    deleteCurrentReport().catch((error) => {
      console.error(error);
      alert("Could not delete report. Please try again.");
    });
  });

  elements.newBtn.addEventListener("click", clearEditor);
  elements.loadDraftBtn.addEventListener("click", loadDraftIntoEditor);
  elements.upload.addEventListener("change", handleFileUpload);
  elements.documentUpload.addEventListener("change", handleDocumentSelection);
  elements.uploadDocumentBtn.addEventListener("click", () => {
    uploadDocument().catch((error) => {
      console.error(error);
      alert(error.message || "Could not upload document. Please try again.");
    });
  });

  elements.signOutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login.html";
  });
}

bindEvents();
hydrateReports().catch((error) => {
  console.error(error);
  loadDraftIntoEditor();
});

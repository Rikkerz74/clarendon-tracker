const STORAGE_KEY = "clarendon-practice-diagnostic-v2";
const PHASE1_CHECKLIST_SUMMARY_KEY = "clarendon-phase1-checklist-summary-v1";

const template = {
  practiceName: "Clarendon Dental, Southsea",
  diagnosticWindow: "Phase 1 - 30 Day Business Diagnostic",
  sections: [
    {
      id: "financial",
      title: "Financial Review and Analysis",
      tagline: "Understand revenue, profitability, pricing and cash",
      prompts: [
        "Revenue by clinician, speciality, surgery and treatment type",
        "Profit by clinician and speciality",
        "Overheads, staff costs, associate costs and marketing ROI",
        "Cash flow forecast, loan commitments and capital plans"
      ]
    },
    {
      id: "patients",
      title: "Patients",
      tagline: "Track flow, conversion, mix and behaviour",
      prompts: [
        "New enquiries, consultations, starts, reviews and waiting lists",
        "Phone, website, consultation and referral conversion",
        "Patient mix and treatment behaviour",
        "Cancellation, FTA, acceptance and average spend"
      ]
    },
    {
      id: "marketing",
      title: "Marketing",
      tagline: "Measure budget, ROI and source conversion",
      prompts: [
        "Budget, cost per lead, cost per patient and cost per start",
        "Website, rankings, Google reviews and social channels",
        "Referral sources and internal marketing",
        "Campaign performance and enquiry tracking"
      ]
    },
    {
      id: "team",
      title: "Team",
      tagline: "Clarify roles, accountability and performance",
      prompts: [
        "Organisation chart, roles and responsibilities",
        "KPIs, productivity, absence and turnover",
        "Recruitment, training and appraisals",
        "Key people, bottlenecks and missing skills"
      ]
    },
    {
      id: "operations",
      title: "Operations",
      tagline: "Review the patient journey and daily execution",
      prompts: [
        "Telephone answering, reception and treatment coordination",
        "Diary management, recalls and automation",
        "Surgery utilisation and administration",
        "Where time is wasted and where delays occur"
      ]
    },
    {
      id: "capacity",
      title: "Capacity",
      tagline: "Measure utilisation and spare capacity",
      prompts: [
        "Surgery occupancy, chair utilisation and clinician utilisation",
        "Hygiene utilisation and cancellation capacity",
        "Daily production and spare capacity",
        "Where demand exceeds capacity"
      ]
    }
  ]
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `practice-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function emptySectionState() {
  return {
    status: "Not started",
    priority: "Medium",
    score: "3",
    scoreOverride: false,
    owner: "",
    notes: "",
    evidence: "",
    actions: "",
    questions: ""
  };
}

function createPracticeState(overrides = {}) {
  const sectionOverrides = overrides.sections || {};

  return {
    practiceId: overrides.practiceId || makeId(),
    practiceName: overrides.practiceName || template.practiceName,
    diagnosticWindow: overrides.diagnosticWindow || template.diagnosticWindow,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || null,
    sections: Object.fromEntries(
      template.sections.map((section) => [
        section.id,
        {
          ...emptySectionState(),
          ...(sectionOverrides[section.id] || {})
        }
      ])
    )
  };
}

function defaultRegistry() {
  const practice = createPracticeState();

  return {
    version: 2,
    activePracticeId: practice.practiceId,
    practices: {
      [practice.practiceId]: practice
    },
    updatedAt: null
  };
}

function normalizeRegistry(raw) {
  if (!raw || typeof raw !== "object") {
    return defaultRegistry();
  }

  const { version: _version, activePracticeId: _activePracticeId, practices: _practices, updatedAt: _updatedAt, ...extraKeys } = raw;

  if (raw.practices && typeof raw.practices === "object") {
    const practices = {};

    for (const [id, practice] of Object.entries(raw.practices)) {
      practices[id] = createPracticeState({
        ...practice,
        practiceId: practice.practiceId || id
      });
    }

    const activePracticeId = raw.activePracticeId && practices[raw.activePracticeId]
      ? raw.activePracticeId
      : Object.keys(practices)[0] || defaultRegistry().activePracticeId;

    return {
      version: 2,
      activePracticeId,
      practices,
      updatedAt: raw.updatedAt || null,
      ...extraKeys
    };
  }

  const legacyPractice = createPracticeState(raw);

  return {
    version: 2,
    activePracticeId: legacyPractice.practiceId,
    practices: {
      [legacyPractice.practiceId]: legacyPractice
    },
    updatedAt: raw.updatedAt || null,
    ...extraKeys
  };
}

let state = defaultRegistry();
let saveTimer = null;

const elements = {
  practiceName: document.getElementById("practiceName"),
  diagnosticWindow: document.getElementById("diagnosticWindow"),
  sectionNav: document.getElementById("sectionNav"),
  sections: document.getElementById("sections"),
  sectionProgress: document.getElementById("sectionProgress"),
  actionProgress: document.getElementById("actionProgress"),
  progressFill: document.getElementById("progressFill"),
  lastSaved: document.getElementById("lastSaved"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
  readinessScore: document.getElementById("readinessScore"),
  readinessLabel: document.getElementById("readinessLabel"),
  weakestSection: document.getElementById("weakestSection"),
  weakestNote: document.getElementById("weakestNote"),
  highPriorityCount: document.getElementById("highPriorityCount"),
  reportInsights: document.getElementById("reportInsights")
};

function activePractice() {
  return state.practices[state.activePracticeId] || Object.values(state.practices)[0] || createPracticeState();
}

function readChecklistSummary(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getPhase1ChecklistSuggestions() {
  const summary = readChecklistSummary(PHASE1_CHECKLIST_SUMMARY_KEY);
  return summary.sections && typeof summary.sections === "object" ? summary.sections : {};
}

function applyPhase1ChecklistScores() {
  const suggestions = getPhase1ChecklistSuggestions();
  const practice = activePractice();
  let changed = false;

  template.sections.forEach((section) => {
    const current = practice.sections[section.id] || emptySectionState();
    const suggestion = suggestions[section.id];

    if (!suggestion || current.scoreOverride) {
      return;
    }

    const suggestedScore = String(suggestion.suggestedScore || 1);
    if (current.score !== suggestedScore) {
      current.score = suggestedScore;
      practice.sections[section.id] = current;
      changed = true;
    }
  });

  return changed;
}

function persistState() {
  const practice = activePractice();
  const timestamp = new Date().toISOString();
  practice.updatedAt = timestamp;
  state.updatedAt = timestamp;
  fetch('/api/state', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registry: state })
  }).then((response) => {
    if (response.status === 401) {
      window.location.href = '/login.html';
    }
  }).catch((error) => {
    console.error('Failed to save tracker state', error);
  });
}

function saveRegistry() {
  persistState();
}

function scheduleRegistrySave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    persistState();
  }, 300);
}

async function hydrateState() {
  const response = await fetch('/api/state', { credentials: 'include' });

  if (response.status === 401) {
    window.location.href = '/login.html';
    return;
  }

  if (!response.ok) {
    throw new Error('Failed to load tracker state');
  }

  state = normalizeRegistry(await response.json());
  const changed = bootstrap();
  if (changed) {
    persistState();
  }
}

function connectLiveUpdates() {
  if (!window.EventSource) {
    return;
  }

  const events = new EventSource('/api/events');

  events.onmessage = (event) => {
    if (!event.data) {
      return;
    }

    const activeElement = document.activeElement;
    const isEditingField = activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName);

    if (isEditingField) {
      return;
    }

    try {
      const incomingState = normalizeRegistry(JSON.parse(event.data));
      if (JSON.stringify(incomingState) === JSON.stringify(state)) {
        return;
      }

      state = incomingState;
      refreshAllViews();
    } catch (error) {
      console.error('Failed to process live tracker update', error);
    }
  };

  events.onerror = () => {
    // The browser will retry automatically.
  };
}

function splitLines(value) {
  return String(value || "").split(/\n+/).filter(Boolean);
}

function sectionMetrics() {
  const practice = activePractice();

  return template.sections.map((section) => {
    const current = practice.sections[section.id] || emptySectionState();
    const score = Number.parseInt(current.score, 10) || 0;

    return {
      id: section.id,
      title: section.title,
      score,
      status: current.status,
      priority: current.priority,
      actionCount: splitLines(current.actions).length,
      noteCount: splitLines(current.notes).length,
      owner: current.owner
    };
  });
}

function renderHeaderStats() {
  const metrics = sectionMetrics();
  const completedSections = metrics.filter((section) => section.status === "Complete").length;
  const actionCount = metrics.reduce((total, section) => total + section.actionCount, 0);
  const progressPercent = Math.round((completedSections / template.sections.length) * 100);
  const practice = activePractice();

  elements.sectionProgress.textContent = `${completedSections}/${template.sections.length}`;
  elements.actionProgress.textContent = String(actionCount);
  elements.progressFill.style.width = `${progressPercent}%`;
  elements.lastSaved.textContent = practice.updatedAt ? new Date(practice.updatedAt).toLocaleString() : "Unsaved";
}

function computeReport() {
  const metrics = sectionMetrics();
  const scores = metrics.map((section) => section.score).filter((score) => score > 0);
  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  const weakest = [...metrics].sort((left, right) => left.score - right.score)[0];
  const highPriorityCount = metrics.filter((section) => section.priority === "High").length;
  const actionCount = metrics.reduce((total, section) => total + section.actionCount, 0);

  const insights = [];

  if (weakest && weakest.score > 0) {
    insights.push({
      title: "Weakest section",
      detail: `${weakest.title} is currently the lowest scored area at ${weakest.score}/5.`
    });
  }

  if (highPriorityCount > 0) {
    insights.push({
      title: "High priority focus",
      detail: `${highPriorityCount} section(s) are marked high priority and should drive the next action plan.`
    });
  }

  if (actionCount > 0) {
    insights.push({
      title: "Actions captured",
      detail: `${actionCount} action line(s) have already been logged across the diagnostic.`
    });
  }

  if (scores.length === 0) {
    insights.push({
      title: "Next step",
      detail: "Start scoring the sections to generate the practice report and risk snapshot."
    });
  } else if (averageScore >= 4) {
    insights.push({
      title: "Overall position",
      detail: "The current scoring suggests a relatively stable practice with targeted opportunities to refine."
    });
  } else {
    insights.push({
      title: "Overall position",
      detail: "The audit is surfacing a mixed picture. Focus the next 30 days on the weakest-scored areas first."
    });
  }

  return {
    readiness: Math.round((averageScore / 5) * 100),
    readinessLabel: scores.length ? `${averageScore.toFixed(1)}/5 average section score` : "No scores entered yet",
    weakestTitle: weakest && weakest.score > 0 ? weakest.title : "—",
    weakestNote: weakest && weakest.score > 0
      ? `${weakest.score}/5 with ${weakest.priority.toLowerCase()} priority and ${weakest.actionCount} action(s).`
      : "Add scores to surface the weakest section.",
    highPriorityCount,
    insights
  };
}

function renderReport() {
  const report = computeReport();

  elements.readinessScore.textContent = `${report.readiness}%`;
  elements.readinessLabel.textContent = report.readinessLabel;
  elements.weakestSection.textContent = report.weakestTitle;
  elements.weakestNote.textContent = report.weakestNote;
  elements.highPriorityCount.textContent = String(report.highPriorityCount);

  elements.reportInsights.innerHTML = "";
  report.insights.forEach((insight) => {
    const item = document.createElement("article");
    item.innerHTML = `<strong>${insight.title}</strong><span>${insight.detail}</span>`;
    elements.reportInsights.appendChild(item);
  });
}

function createSectionNav() {
  const metrics = sectionMetrics();
  elements.sectionNav.innerHTML = "";

  template.sections.forEach((section, index) => {
    const current = metrics.find((entry) => entry.id === section.id) || {
      status: "Not started",
      priority: "Medium",
      score: 0
    };

    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong>${index + 1}. ${section.title}</strong><br><small>${current.status} • ${current.priority} • ${current.score || "-"}/5</small>`;
    button.addEventListener("click", () => {
      document.getElementById(`section-${section.id}`).scrollIntoView({ behavior: "smooth", block: "start" });
    });

    elements.sectionNav.appendChild(button);
  });
}

function updateActiveNav() {
  const sections = template.sections
    .map((section) => document.getElementById(`section-${section.id}`))
    .filter(Boolean);
  const buttons = Array.from(elements.sectionNav.querySelectorAll("button"));

  const activeIndex = sections.findIndex((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= 180 && rect.bottom >= 180;
  });

  buttons.forEach((button, index) => {
    button.classList.toggle("active", index === activeIndex);
  });
}

function syncTopFields() {
  const practice = activePractice();
  if (elements.practiceName) {
    elements.practiceName.value = practice.practiceName;
  }

  if (elements.diagnosticWindow) {
    elements.diagnosticWindow.value = practice.diagnosticWindow;
  }
}

function refreshSummaryViews() {
  applyPhase1ChecklistScores();
  renderHeaderStats();
  renderReport();
  createSectionNav();
  updateActiveNav();
}

function refreshAllViews() {
  applyPhase1ChecklistScores();
  syncTopFields();
  renderHeaderStats();
  renderReport();
  createSectionNav();
  renderSections();
  updateActiveNav();
}

function bindField(id, sectionId, field) {
  const element = document.getElementById(id);
  const current = activePractice().sections[sectionId][field];
  element.value = current;

  const handleUpdate = (event) => {
    activePractice().sections[sectionId][field] = event.target.value;

    if (field === "score") {
      activePractice().sections[sectionId].scoreOverride = true;
    }

    if (element.tagName === "SELECT") {
      saveRegistry();
      refreshSummaryViews();
      return;
    }

    if (event.type === "change") {
      saveRegistry();
      refreshSummaryViews();
      return;
    }

    scheduleRegistrySave();
  };

  element.addEventListener("input", handleUpdate);
  element.addEventListener("change", handleUpdate);
}

function renderSections() {
  const practice = activePractice();
  const checklistSuggestions = getPhase1ChecklistSuggestions();
  elements.sections.innerHTML = "";

  template.sections.forEach((section, index) => {
    const current = practice.sections[section.id] || emptySectionState();
    const sectionCard = document.createElement("article");
    sectionCard.className = "section-card";
    sectionCard.id = `section-${section.id}`;

    sectionCard.innerHTML = `
      <div class="section-head">
        <div>
          <p class="eyebrow">Section ${index + 1}</p>
          <h3>${section.title}</h3>
          <p class="helper">${section.tagline}</p>
        </div>
        <div class="section-meta">
          <span class="pill">${current.status}</span>
          <span class="pill">Priority: ${current.priority}</span>
          <span class="pill">Score: ${current.score}/5</span>
        </div>
      </div>

      <div class="section-prompts">
        <h4>Core prompts</h4>
        <ul>
          ${section.prompts.map((prompt) => `<li>${prompt}</li>`).join("")}
        </ul>
      </div>

      <div class="section-grid">
        <label>
          Status
          <select id="status-${section.id}">
            <option>Not started</option>
            <option>In progress</option>
            <option>Complete</option>
          </select>
        </label>
        <label>
          Priority
          <select id="priority-${section.id}">
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label>
          Score (1-5)
          <select id="score-${section.id}">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          <small class="score-helper" id="score-help-${section.id}"></small>
        </label>
        <label>
          Owner
          <input id="owner-${section.id}" type="text" placeholder="Who owns this area?" />
        </label>
        <label>
          Evidence / source data
          <input id="evidence-${section.id}" type="text" placeholder="Reports, systems, evidence held" />
        </label>
        <label class="full">
          Key findings
          <textarea id="notes-${section.id}" placeholder="What do we know so far?"></textarea>
        </label>
        <label class="full">
          Actions and next steps
          <textarea id="actions-${section.id}" placeholder="List priorities and owners"></textarea>
        </label>
        <label class="full">
          Open questions
          <textarea id="questions-${section.id}" placeholder="What still needs to be answered?"></textarea>
        </label>
      </div>
    `;

    elements.sections.appendChild(sectionCard);

    bindField(`status-${section.id}`, section.id, "status");
    bindField(`priority-${section.id}`, section.id, "priority");
    bindField(`score-${section.id}`, section.id, "score");
    bindField(`owner-${section.id}`, section.id, "owner");
    bindField(`evidence-${section.id}`, section.id, "evidence");
    bindField(`notes-${section.id}`, section.id, "notes");
    bindField(`actions-${section.id}`, section.id, "actions");
    bindField(`questions-${section.id}`, section.id, "questions");

    document.getElementById(`status-${section.id}`).value = current.status;
    document.getElementById(`priority-${section.id}`).value = current.priority;
    document.getElementById(`score-${section.id}`).value = current.score;
    const scoreHelp = document.getElementById(`score-help-${section.id}`);
    const suggestion = checklistSuggestions[section.id];
    if (scoreHelp && suggestion) {
      scoreHelp.textContent = current.scoreOverride
        ? `Workflow record suggests ${suggestion.suggestedScore}/5 from ${suggestion.checked}/${suggestion.total} items. Manual override active.`
        : `Workflow record score applied: ${suggestion.suggestedScore}/5 from ${suggestion.checked}/${suggestion.total} items.`;
    }
    document.getElementById(`owner-${section.id}`).value = current.owner;
    document.getElementById(`evidence-${section.id}`).value = current.evidence;
    document.getElementById(`notes-${section.id}`).value = current.notes;
    document.getElementById(`actions-${section.id}`).value = current.actions;
    document.getElementById(`questions-${section.id}`).value = current.questions;
  });
}

function bootstrapSectionViews() {
  renderSections();
  createSectionNav();
  renderHeaderStats();
  renderReport();
  updateActiveNav();
}

function bootstrap() {
  const changed = applyPhase1ChecklistScores();
  syncTopFields();
  bootstrapSectionViews();
  return changed;
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${activePractice().practiceName || "clarendon-practice-diagnostic"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importState(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeRegistry(JSON.parse(String(reader.result)));
      saveRegistry();
      bootstrap();
    } catch {
      alert("That file could not be imported. Please choose a valid diagnostic export.");
    }
  };
  reader.readAsText(file);
}

function resetTracker() {
  if (!confirm("Reset the saved diagnostic to the template? This clears browser storage for this tracker.")) {
    return;
  }

  state = defaultRegistry();
  saveRegistry();
  bootstrap();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => {
      // Hosting can still work without offline support.
    });
  }
}

function bindLogoutButton() {
  const button = document.getElementById("signOutBtn");
  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login.html";
  });
}

function saveRegistryAndRefreshPracticeHeader() {
  saveRegistry();
  renderHeaderStats();
  renderReport();
}

if (elements.practiceName) {
  elements.practiceName.addEventListener("input", (event) => {
    activePractice().practiceName = event.target.value;
    saveRegistryAndRefreshPracticeHeader();
  });
}

if (elements.diagnosticWindow) {
  elements.diagnosticWindow.addEventListener("input", (event) => {
    activePractice().diagnosticWindow = event.target.value;
    saveRegistryAndRefreshPracticeHeader();
  });
}

if (elements.exportBtn) {
  elements.exportBtn.addEventListener("click", exportState);
}

if (elements.importInput) {
  elements.importInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) {
      importState(file);
    }
    event.target.value = "";
  });
}

if (elements.resetBtn) {
  elements.resetBtn.addEventListener("click", resetTracker);
}

window.addEventListener("scroll", updateActiveNav, { passive: true });
window.addEventListener("resize", updateActiveNav);

hydrateState().catch((error) => {
  console.error(error);
  bootstrap();
});
connectLiveUpdates();
registerServiceWorker();
bindLogoutButton();

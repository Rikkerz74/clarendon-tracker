const sectionOrder = [
  { id: "financial", title: "Financial Review and Analysis", phase2Focus: "Commercial performance" },
  { id: "patients", title: "Patients", phase2Focus: "Premium patient experience" },
  { id: "marketing", title: "Marketing", phase2Focus: "Premium brand & marketing" },
  { id: "team", title: "Team", phase2Focus: "Team foundations" },
  { id: "operations", title: "Operations", phase2Focus: "Operational excellence" },
  { id: "capacity", title: "Capacity", phase2Focus: "Operational excellence" }
];

const DAY_MS = 24 * 60 * 60 * 1000;

function defaultSectionState() {
  return {
    status: "Not started",
    priority: "Medium",
    score: "3",
    owner: "",
    notes: "",
    evidence: "",
    actions: "",
    questions: ""
  };
}

function createDefaultPractice() {
  return {
    practiceName: "Clarendon Dental, Southsea",
    diagnosticWindow: "Phase 1 - 30 Day Business Diagnostic",
    startDate: null,
    updatedAt: null,
    sections: Object.fromEntries(sectionOrder.map((section) => [section.id, defaultSectionState()]))
  };
}

function normalizeRegistry(raw) {
  if (!raw || typeof raw !== "object") {
    return { activePractice: createDefaultPractice(), practicesCount: 1 };
  }

  if (raw.practices && typeof raw.practices === "object") {
    const practiceIds = Object.keys(raw.practices);
    const activePracticeId = raw.activePracticeId && raw.practices[raw.activePracticeId]
      ? raw.activePracticeId
      : practiceIds[0];
    const practice = raw.practices[activePracticeId] || createDefaultPractice();

    return {
      activePractice: {
        ...createDefaultPractice(),
        ...practice,
        sections: {
          ...createDefaultPractice().sections,
          ...(practice.sections || {})
        }
      },
      practicesCount: practiceIds.length
    };
  }

  return {
    activePractice: {
      ...createDefaultPractice(),
      ...raw,
      sections: {
        ...createDefaultPractice().sections,
        ...(raw.sections || {})
      }
    },
    practicesCount: 1
  };
}

function splitLines(value) {
  return String(value || "").split(/\n+/).filter(Boolean);
}

function parseLocalDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function computePhaseTiming(startDateValue) {
  const startDate = parseLocalDate(startDateValue);
  if (!startDate) {
    return {
      label: "Not started",
      detail: "Set the partnership start date to activate phase tracking.",
      stagePercent: 0,
      stageRag: scoreToRag(0)
    };
  }

  const today = toLocalDateOnly(new Date());
  const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / DAY_MS);

  if (daysElapsed < 0) {
    return {
      label: "Pre-start",
      detail: `Partnership starts on ${startDate.toLocaleDateString()}.`,
      stagePercent: 0,
      stageRag: scoreToRag(0)
    };
  }

  if (daysElapsed <= 29) {
    const dayNumber = daysElapsed + 1;
    const stagePercent = Math.min(100, Math.round((dayNumber / 30) * 100));
    return {
      label: "Phase 1 - Foundation",
      detail: `Day ${dayNumber} of 30 in Phase 1.`,
      stagePercent,
      stageRag: scoreToRag(stagePercent)
    };
  }

  if (daysElapsed <= 119) {
    const dayInPhase = daysElapsed - 29;
    const stagePercent = Math.min(100, Math.round((dayInPhase / 90) * 100));
    return {
      label: "Phase 2 - Implementation",
      detail: `Day ${dayInPhase} of 90 in Phase 2.`,
      stagePercent,
      stageRag: scoreToRag(stagePercent)
    };
  }

  const dayInPhase3 = daysElapsed - 119;
  const phase3Window = 245;
  const stagePercent = Math.min(100, Math.round((dayInPhase3 / phase3Window) * 100));
  return {
    label: "Phase 3 - Continuous Development",
    detail: `Currently in Phase 3 (day ${dayInPhase3} since entering Phase 3).`,
    stagePercent,
    stageRag: scoreToRag(stagePercent)
  };
}

function sectionMetrics(practice) {
  return sectionOrder.map((section) => {
    const current = practice.sections[section.id] || defaultSectionState();
    const score = Number.parseInt(current.score, 10) || 0;

    return {
      ...section,
      status: current.status,
      priority: current.priority,
      score,
      owner: current.owner,
      notesCount: splitLines(current.notes).length,
      actionsCount: splitLines(current.actions).length
    };
  });
}

function scoreToRag(percent) {
  if (percent >= 75) {
    return { label: "Green", className: "rag-green" };
  }

  if (percent >= 45) {
    return { label: "Amber", className: "rag-amber" };
  }

  return { label: "Red", className: "rag-red" };
}

function setRag(el, rag) {
  el.textContent = `RAG: ${rag.label}`;
  el.classList.remove("rag-green", "rag-amber", "rag-red");
  el.classList.add(rag.className);
}

function computeRoadmap(practice) {
  const metrics = sectionMetrics(practice);
  const hasMeaningfulData = Boolean(practice.updatedAt) || metrics.some((section) =>
    section.status !== "Not started" ||
    section.priority !== "Medium" ||
    section.score !== 3 ||
    section.owner ||
    section.notesCount > 0 ||
    section.actionsCount > 0 ||
    section.evidence
  );

  if (!hasMeaningfulData) {
    return {
      metrics,
      completedCount: 0,
      inProgressCount: 0,
      totalActions: 0,
      readiness: 0,
      averageScore: 0,
      lowest: null,
      highPriority: [],
      focusAreas: [],
      phase2Focus: [],
      phase1Rag: scoreToRag(0),
      phase2Rag: scoreToRag(0),
      phase3Rag: scoreToRag(0),
      hasMeaningfulData: false
    };
  }

  const completedCount = metrics.filter((section) => section.status === "Complete").length;
  const inProgressCount = metrics.filter((section) => section.status === "In progress").length;
  const totalActions = metrics.reduce((total, section) => total + section.actionsCount, 0);
  const scores = metrics.map((section) => section.score).filter((score) => score > 0);
  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  const readiness = Math.round((averageScore / 5) * 100);
  const lowest = [...metrics].sort((left, right) => left.score - right.score)[0] || metrics[0];
  const highPriority = metrics.filter((section) => section.priority === "High");
  const outstanding = metrics.filter((section) => section.status !== "Complete" && section.score < 4);
  const focusAreas = outstanding.length ? outstanding.slice(0, 3) : metrics.slice(0, 3);
  const phase2Focus = [...new Set(focusAreas.map((section) => section.phase2Focus))].slice(0, 3);

  return {
    metrics,
    completedCount,
    inProgressCount,
    totalActions,
    readiness,
    averageScore,
    lowest,
    highPriority,
    focusAreas,
    phase2Focus,
    phase1Rag: scoreToRag(readiness),
    phase2Rag: scoreToRag(Math.min(100, readiness + Math.max(0, 15 - highPriority.length * 4) + Math.min(totalActions, 6) * 3)),
    phase3Rag: scoreToRag(Math.min(100, readiness + Math.max(0, completedCount * 4) + Math.max(0, 3 - highPriority.length) * 4)),
    hasMeaningfulData: true
  };
}

function renderPhaseHighlights(listElement, items) {
  listElement.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

async function renderRoadmap() {
  const response = await fetch('/api/state', { credentials: 'include' });

  if (response.status === 401) {
    window.location.href = '/login.html';
    return;
  }

  if (!response.ok) {
    throw new Error('Failed to load roadmap state');
  }

  const raw = await response.json();
  const { activePractice, practicesCount } = normalizeRegistry(raw);
  const roadmap = computeRoadmap(activePractice);
  const phaseTiming = computePhaseTiming(activePractice.startDate);

  const stageProgressLabel = document.getElementById("stageProgressLabel");
  const stageProgressFill = document.getElementById("stageProgressFill");
  const stageProgressDetail = document.getElementById("stageProgressDetail");
  if (stageProgressLabel) {
    stageProgressLabel.textContent = `${phaseTiming.stagePercent}%`;
  }
  if (stageProgressFill) {
    stageProgressFill.style.width = `${phaseTiming.stagePercent}%`;
    stageProgressFill.classList.remove("stage-progress-green", "stage-progress-amber", "stage-progress-red");
    if (phaseTiming.stageRag.className === "rag-green") {
      stageProgressFill.classList.add("stage-progress-green");
    } else if (phaseTiming.stageRag.className === "rag-amber") {
      stageProgressFill.classList.add("stage-progress-amber");
    } else {
      stageProgressFill.classList.add("stage-progress-red");
    }
  }
  if (stageProgressDetail) {
    const activityText = activePractice.updatedAt
      ? `Last updated ${new Date(activePractice.updatedAt).toLocaleString()}.`
      : practicesCount > 1
        ? `${practicesCount} practices saved, no updates yet for the active one.`
        : "No saved activity yet.";
    stageProgressDetail.textContent = `${phaseTiming.label}. ${activityText}`;
  }

  document.getElementById("roadmapReadiness").textContent = phaseTiming.label;
  document.getElementById("roadmapReadinessLabel").textContent = phaseTiming.detail;
  document.getElementById("phaseTrackingHint").textContent = activePractice.startDate
    ? `Start date set to ${parseLocalDate(activePractice.startDate).toLocaleDateString()}.`
    : "Start date is managed centrally and will be added by your consultant.";

  document.getElementById("roadmapTopFocus").textContent = roadmap.lowest
    ? roadmap.lowest.title
    : "Add tracker data";
  document.getElementById("roadmapTopFocusNote").textContent = roadmap.lowest
    ? `${roadmap.lowest.title} is the lowest-scored area at ${roadmap.lowest.score}/5.`
    : "Your highest priority items will appear here";

  setRag(document.getElementById("phase1Rag"), roadmap.phase1Rag);
  setRag(document.getElementById("phase2Rag"), roadmap.phase2Rag);
  setRag(document.getElementById("phase3Rag"), roadmap.phase3Rag);

  document.getElementById("phase1Summary").textContent = roadmap.completedCount
    ? `${roadmap.completedCount} of 7 sections are complete and ${roadmap.inProgressCount} are in progress. The weakest area is ${roadmap.lowest.title} at ${roadmap.lowest.score}/5.`
    : "Enter section data in the tracker to populate this phase summary.";

  renderPhaseHighlights(document.getElementById("phase1Highlights"), roadmap.hasMeaningfulData ? [
    `${roadmap.totalActions} action line(s) captured in the tracker`,
    `${roadmap.highPriority.length} high-priority area(s) flagged`,
    `Readiness score: ${roadmap.readiness}%`
  ] : [
    "No live tracker data captured yet",
    "The roadmap will populate once section notes and scores are entered",
    "Use the tracker to start building the diagnostic summary"
  ]);

  document.getElementById("phase2Summary").textContent = roadmap.phase2Focus.length
    ? `Months 2-4 should concentrate on ${roadmap.phase2Focus.join(", ")} based on the phase one evidence.`
    : "The partnership portal will translate your phase one findings into Months 2-4 priorities.";

  renderPhaseHighlights(document.getElementById("phase2Highlights"), roadmap.hasMeaningfulData ? [
    `Highest-priority tracker areas: ${roadmap.highPriority.length ? roadmap.highPriority.map((section) => section.title).join(", ") : "None yet"}`,
    `Target the weakest area first: ${roadmap.lowest ? roadmap.lowest.title : "No tracked weakness yet"}`,
    `Use the Month 4 review to decide what to accelerate, pause, or refine`
  ] : [
    "No phase one findings yet to convert into Months 2-4 priorities",
    "Once the audit is underway, this section will show the strongest improvement targets",
    "The Month 4 review will be built from the tracker entries"
  ]);

  document.getElementById("phase3Summary").textContent = roadmap.readiness >= 70
    ? "The long-term programme can now focus on embedding improvements and moving into strategic growth cycles."
    : roadmap.hasMeaningfulData
      ? "Once the foundations are in place, the year one plan should focus on embedding improvements before scaling further."
      : "The year one cycle will be refined once phase one data has been captured.";

  renderPhaseHighlights(document.getElementById("phase3Highlights"), [
    "Cycle one: embedding excellence",
    "Cycle two: sustainable growth",
    "Cycle three: future planning"
  ]);
}

function connectLiveUpdates() {
  if (!window.EventSource) {
    return;
  }

  const events = new EventSource('/api/events');
  events.onmessage = () => {
    renderRoadmap().catch((error) => console.error('Failed to refresh roadmap', error));
  };
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

window.addEventListener("DOMContentLoaded", () => {
  renderRoadmap().catch((error) => console.error('Failed to render roadmap', error));
  connectLiveUpdates();
  bindLogoutButton();
});
const PHASE_CONFIG = {
  phase2: {
    title: "Phase 2",
    stateKey: "phase2Scoring",
    checklistSummaryKey: "clarendon-phase2-checklist-summary-v1",
    sections: [
      {
        id: "premium-experience",
        title: "Premium Patient Experience",
        tagline: "Elevate journey standards and service consistency",
        prompts: [
          "Patient journey redesign and first impressions",
          "Reception and telephone service standards",
          "Communication touchpoints before and after appointments",
          "Patient feedback trends and refinement priorities"
        ]
      },
      {
        id: "team-foundations",
        title: "Team Foundations",
        tagline: "Build accountability, coaching and ownership",
        prompts: [
          "Leadership coaching progress and KPI ownership",
          "Reception confidence and conversion behavior",
          "Service expectations and brand behaviors",
          "Internal communication and ownership culture"
        ]
      },
      {
        id: "brand-marketing",
        title: "Premium Brand & Marketing",
        tagline: "Align brand presentation and growth campaigns",
        prompts: [
          "Brand consistency across patient touchpoints",
          "Marketing calendar and campaign effectiveness",
          "Website, SEO and review strategy performance",
          "Referral and community engagement momentum"
        ]
      },
      {
        id: "operational-excellence",
        title: "Operational Excellence",
        tagline: "Improve workflow reliability and delivery capacity",
        prompts: [
          "Diary optimisation and recall reliability",
          "Cancellation management and workflow bottlenecks",
          "KPI dashboard adoption and monthly reporting",
          "Cross-team communication and execution quality"
        ]
      },
      {
        id: "commercial-performance",
        title: "Commercial Performance",
        tagline: "Strengthen profitability and planning discipline",
        prompts: [
          "Fee strategy, treatment mix and forecasting",
          "Capacity and cash flow monitoring",
          "Marketing ROI evaluation",
          "Business planning progress and risks"
        ]
      }
    ]
  },
  phase3: {
    title: "Phase 3",
    stateKey: "phase3Scoring",
    checklistSummaryKey: "clarendon-phase3-checklist-summary-v1",
    sections: [
      {
        id: "cycle-one",
        title: "Cycle One (Months 5-7)",
        tagline: "Embedding Excellence",
        prompts: [
          "Workshop delivery quality and team adoption",
          "Patient communication and environment upgrades",
          "KPI and fee review outcomes",
          "Strategic review findings and refinements"
        ]
      },
      {
        id: "cycle-two",
        title: "Cycle Two (Months 8-10)",
        tagline: "Sustainable Growth",
        prompts: [
          "Management development and coordinator capability",
          "Referral development and campaign impact",
          "Utilisation and business development progress",
          "Strategic review priorities, stops and new opportunities"
        ]
      },
      {
        id: "cycle-three",
        title: "Cycle Three (Months 11-12)",
        tagline: "Future Planning",
        prompts: [
          "Leadership and succession planning readiness",
          "Annual business plan and budget completion",
          "Next 12-month marketing and team development plans",
          "End-of-year strategic review and growth roadmap"
        ]
      },
      {
        id: "lab-3d-croi",
        title: "3D Lab Build & CROI",
        tagline: "Plan in-practice production and validate commercial return",
        prompts: [
          "3D lab scope, service model and implementation timeline",
          "Initial setup cost assumptions and supplier options",
          "Projected annual uplift from in-house production",
          "CROI payback assumptions, risk factors and review cadence"
        ]
      }
    ]
  }
};

const phaseName = document.body.dataset.phase;
const config = PHASE_CONFIG[phaseName];

if (!config) {
  throw new Error("Unknown phase scoring configuration.");
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
    questions: "",
    croiInvestment: "",
    croiAnnualBenefit: "",
    croiYears: "3"
  };
}

function createDefaultState() {
  return {
    updatedAt: null,
    sections: Object.fromEntries(
      config.sections.map((section) => [section.id, emptySectionState()])
    )
  };
}

function normalizePhaseState(raw) {
  const base = createDefaultState();
  if (!raw || typeof raw !== "object") {
    return base;
  }

  return {
    updatedAt: raw.updatedAt || null,
    sections: Object.fromEntries(
      config.sections.map((section) => [
        section.id,
        {
          ...emptySectionState(),
          ...((raw.sections && raw.sections[section.id]) || {})
        }
      ])
    )
  };
}

let registry = {};
let state = createDefaultState();
let saveTimer = null;

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

function getChecklistSuggestions() {
  const summary = readChecklistSummary(config.checklistSummaryKey);
  return summary.sections && typeof summary.sections === "object" ? summary.sections : {};
}

function applyChecklistSuggestedScores() {
  const suggestions = getChecklistSuggestions();
  let changed = false;

  config.sections.forEach((section) => {
    const current = state.sections[section.id] || emptySectionState();
    const suggestion = suggestions[section.id];

    if (!suggestion || current.scoreOverride) {
      return;
    }

    const suggestedScore = String(suggestion.suggestedScore || 1);
    if (current.score !== suggestedScore) {
      current.score = suggestedScore;
      state.sections[section.id] = current;
      changed = true;
    }
  });

  return changed;
}

const elements = {
  sectionNav: document.getElementById("sectionNav"),
  sections: document.getElementById("sections"),
  sectionProgress: document.getElementById("sectionProgress"),
  actionProgress: document.getElementById("actionProgress"),
  progressFill: document.getElementById("progressFill"),
  lastSaved: document.getElementById("lastSaved"),
  readinessScore: document.getElementById("readinessScore"),
  readinessLabel: document.getElementById("readinessLabel"),
  weakestSection: document.getElementById("weakestSection"),
  weakestNote: document.getElementById("weakestNote"),
  highPriorityCount: document.getElementById("highPriorityCount"),
  reportInsights: document.getElementById("reportInsights")
};

function splitLines(value) {
  return String(value || "").split(/\n+/).filter(Boolean);
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}

function calculateCroi(section) {
  const investment = toNumber(section.croiInvestment);
  const annualBenefit = toNumber(section.croiAnnualBenefit);
  const years = Math.max(1, Math.round(toNumber(section.croiYears) || 3));

  if (investment <= 0 || annualBenefit <= 0) {
    return null;
  }

  const totalBenefit = annualBenefit * years;
  const netReturn = totalBenefit - investment;
  const croiPercent = (netReturn / investment) * 100;
  const paybackMonths = (investment / annualBenefit) * 12;

  return {
    investment,
    annualBenefit,
    years,
    totalBenefit,
    netReturn,
    croiPercent,
    paybackMonths
  };
}

function updateCroiOutput(sectionId) {
  const output = document.getElementById(`croi-output-${sectionId}`);
  const payback = document.getElementById(`payback-output-${sectionId}`);
  if (!output || !payback) {
    return;
  }

  const current = state.sections[sectionId] || emptySectionState();
  const result = calculateCroi(current);

  if (!result) {
    output.textContent = "Enter investment and annual benefit to calculate CROI.";
    payback.textContent = "Payback period: awaiting inputs";
    return;
  }

  output.textContent = `Net return ${formatCurrency(result.netReturn)} over ${result.years} year(s); CROI ${result.croiPercent.toFixed(1)}%.`;
  payback.textContent = `Payback period: ${result.paybackMonths.toFixed(1)} months (total benefit ${formatCurrency(result.totalBenefit)}).`;
}

function sectionMetrics() {
  return config.sections.map((section) => {
    const current = state.sections[section.id] || emptySectionState();
    const score = Number.parseInt(current.score, 10) || 0;

    return {
      id: section.id,
      title: section.title,
      score,
      status: current.status,
      priority: current.priority,
      actionCount: splitLines(current.actions).length,
      noteCount: splitLines(current.notes).length
    };
  });
}

function persistState() {
  const timestamp = new Date().toISOString();
  state.updatedAt = timestamp;
  registry = {
    ...(registry && typeof registry === "object" ? registry : {}),
    [config.stateKey]: state,
    updatedAt: timestamp
  };

  fetch("/api/state", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registry })
  }).then((response) => {
    if (response.status === 401) {
      window.location.href = "/login.html";
    }
  }).catch((error) => {
    console.error(`Failed to save ${config.title} scoring state`, error);
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

function renderHeaderStats() {
  const metrics = sectionMetrics();
  const completedSections = metrics.filter((section) => section.status === "Complete").length;
  const actionCount = metrics.reduce((total, section) => total + section.actionCount, 0);
  const progressPercent = Math.round((completedSections / config.sections.length) * 100);

  elements.sectionProgress.textContent = `${completedSections}/${config.sections.length}`;
  elements.actionProgress.textContent = String(actionCount);
  elements.progressFill.style.width = `${progressPercent}%`;
  elements.lastSaved.textContent = state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "Unsaved";
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
      detail: `${actionCount} action line(s) have already been logged across the phase.`
    });
  }

  if (phaseName === "phase3") {
    const labSection = state.sections["lab-3d-croi"];
    const croi = labSection ? calculateCroi(labSection) : null;
    if (croi) {
      insights.push({
        title: "3D lab business case",
        detail: `Current model indicates ${croi.croiPercent.toFixed(1)}% CROI and ${croi.paybackMonths.toFixed(1)} months payback.`
      });
    }
  }

  if (scores.length === 0) {
    insights.push({
      title: "Next step",
      detail: "Start scoring the sections to generate the phase report and risk snapshot."
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

  config.sections.forEach((section, index) => {
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
  const sections = config.sections
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

function refreshSummaryViews() {
  applyChecklistSuggestedScores();
  renderHeaderStats();
  renderReport();
  createSectionNav();
  updateActiveNav();
}

function refreshAllViews() {
  applyChecklistSuggestedScores();
  renderHeaderStats();
  renderReport();
  createSectionNav();
  renderSections();
  updateActiveNav();
}

function bindField(id, sectionId, field) {
  const element = document.getElementById(id);
  const current = state.sections[sectionId][field];
  element.value = current;

  const handleUpdate = (event) => {
    state.sections[sectionId][field] = event.target.value;

    if (["croiInvestment", "croiAnnualBenefit", "croiYears"].includes(field)) {
      updateCroiOutput(sectionId);
    }

    if (field === "score") {
      state.sections[sectionId].scoreOverride = true;
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
  const checklistSuggestions = getChecklistSuggestions();
  elements.sections.innerHTML = "";

  config.sections.forEach((section, index) => {
    const current = state.sections[section.id] || emptySectionState();
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
        ${section.id === "lab-3d-croi" ? `
        <div class="section-prompts full">
          <h4>CROI calculations</h4>
          <div class="section-grid">
            <label>
              Initial investment (GBP)
              <input id="croi-investment-${section.id}" type="text" placeholder="e.g. 120000" />
            </label>
            <label>
              Annual financial benefit (GBP)
              <input id="croi-annual-benefit-${section.id}" type="text" placeholder="e.g. 65000" />
            </label>
            <label>
              Review period (years)
              <input id="croi-years-${section.id}" type="text" placeholder="e.g. 3" />
            </label>
          </div>
          <p class="helper" id="croi-output-${section.id}">Enter investment and annual benefit to calculate CROI.</p>
          <p class="helper" id="payback-output-${section.id}">Payback period: awaiting inputs</p>
        </div>
        ` : ""}
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
    if (section.id === "lab-3d-croi") {
      bindField(`croi-investment-${section.id}`, section.id, "croiInvestment");
      bindField(`croi-annual-benefit-${section.id}`, section.id, "croiAnnualBenefit");
      bindField(`croi-years-${section.id}`, section.id, "croiYears");
    }
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
    if (section.id === "lab-3d-croi") {
      document.getElementById(`croi-investment-${section.id}`).value = current.croiInvestment;
      document.getElementById(`croi-annual-benefit-${section.id}`).value = current.croiAnnualBenefit;
      document.getElementById(`croi-years-${section.id}`).value = current.croiYears;
      updateCroiOutput(section.id);
    }
    document.getElementById(`notes-${section.id}`).value = current.notes;
    document.getElementById(`actions-${section.id}`).value = current.actions;
    document.getElementById(`questions-${section.id}`).value = current.questions;
  });
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

async function hydrateState() {
  const response = await fetch("/api/state", { credentials: "include" });

  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${config.title} scoring state`);
  }

  registry = await response.json();
  state = normalizePhaseState(registry[config.stateKey]);
  const changed = applyChecklistSuggestedScores();
  refreshAllViews();
  if (changed) {
    persistState();
  }
}

function connectLiveUpdates() {
  if (!window.EventSource) {
    return;
  }

  const events = new EventSource("/api/events");

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
      const incomingRegistry = JSON.parse(event.data);
      const incomingState = normalizePhaseState(incomingRegistry[config.stateKey]);
      if (JSON.stringify(incomingState) === JSON.stringify(state)) {
        return;
      }

      registry = incomingRegistry;
      state = incomingState;
      refreshAllViews();
    } catch (error) {
      console.error(`Failed to process live ${config.title} update`, error);
    }
  };
}

window.addEventListener("scroll", updateActiveNav, { passive: true });
window.addEventListener("resize", updateActiveNav);

hydrateState().catch((error) => {
  console.error(error);
  refreshAllViews();
});
connectLiveUpdates();
bindLogoutButton();

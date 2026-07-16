const CHECKLIST_STORAGE_KEY = "clarendon-phase3-checklist-v1";
const CHECKLIST_SUMMARY_STORAGE_KEY = "clarendon-phase3-checklist-summary-v1";

function readChecklistState() {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeChecklistState(state) {
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
}

function calculateSuggestedScore(checked, total) {
  if (!total) {
    return 1;
  }

  return Math.min(5, Math.max(1, Math.ceil((checked / total) * 5)));
}

function writeChecklistSummary() {
  const sections = Array.from(document.querySelectorAll(".phase-detail-card[data-score-section]"));
  const summary = {
    updatedAt: new Date().toISOString(),
    sections: Object.fromEntries(sections.map((section) => {
      const sectionId = section.dataset.scoreSection;
      const items = Array.from(section.querySelectorAll('.phase-list li input[type="checkbox"]'));
      const checked = items.filter((input) => input.checked).length;
      const total = items.length;

      return [sectionId, {
        checked,
        total,
        suggestedScore: calculateSuggestedScore(checked, total)
      }];
    }))
  };

  localStorage.setItem(CHECKLIST_SUMMARY_STORAGE_KEY, JSON.stringify(summary));
}

function updateChecklistProgress(total, checked) {
  const label = document.getElementById("checklistProgressLabel");
  const fill = document.getElementById("checklistProgressFill");
  const totalEl = document.getElementById("checklistTotal");
  const completeEl = document.getElementById("checklistComplete");
  const remainingEl = document.getElementById("checklistRemaining");

  if (!label || !fill) {
    return;
  }

  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
  label.textContent = `${checked}/${total} complete (${percent}%)`;
  fill.style.width = `${percent}%`;

  if (totalEl) {
    totalEl.textContent = String(total);
  }

  if (completeEl) {
    completeEl.textContent = String(checked);
  }

  if (remainingEl) {
    remainingEl.textContent = String(Math.max(0, total - checked));
  }
}

function setupChecklist() {
  const items = Array.from(document.querySelectorAll(".phase-detail-card .phase-list li"));
  const state = readChecklistState();

  items.forEach((item, index) => {
    const text = item.textContent.trim();
    const key = `item-${index}`;

    item.classList.add("checklist-item");
    item.textContent = "";

    const label = document.createElement("label");
    label.className = "checklist-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(state[key]);

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    checkbox.addEventListener("change", () => {
      state[key] = checkbox.checked;
      writeChecklistState(state);
      writeChecklistSummary();
      const checkedCount = items.filter((entry) => {
        const input = entry.querySelector('input[type="checkbox"]');
        return input && input.checked;
      }).length;
      updateChecklistProgress(items.length, checkedCount);
    });

    label.appendChild(checkbox);
    label.appendChild(textSpan);
    item.appendChild(label);
  });

  const checkedCount = items.filter((entry) => {
    const input = entry.querySelector('input[type="checkbox"]');
    return input && input.checked;
  }).length;

  updateChecklistProgress(items.length, checkedCount);
  writeChecklistSummary();

  const resetButton = document.getElementById("resetChecklistBtn");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      localStorage.removeItem(CHECKLIST_STORAGE_KEY);
      localStorage.removeItem(CHECKLIST_SUMMARY_STORAGE_KEY);
      items.forEach((entry) => {
        const input = entry.querySelector('input[type="checkbox"]');
        if (input) {
          input.checked = false;
        }
      });
      updateChecklistProgress(items.length, 0);
      writeChecklistSummary();
    });
  }
}

function setupPrintButton() {
  const printButton = document.getElementById("printChecklistBtn");
  if (!printButton) {
    return;
  }

  printButton.addEventListener("click", () => {
    window.print();
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

setupChecklist();
setupPrintButton();
bindLogoutButton();

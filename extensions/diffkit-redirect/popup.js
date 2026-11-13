(async function initPopup() {
  const shared = globalThis.DiffKitRedirect;
  const extensionApi = globalThis.chrome ?? globalThis.browser;
  const toggle = document.getElementById("enabled-toggle");
  const masterState = document.getElementById("master-state");
  const ruleList = document.getElementById("rule-list");
  const editRules = document.getElementById("edit-rules");
  const status = document.getElementById("status");

  function getRuleLabel(rule) {
    if (rule.label) {
      return rule.label;
    }

    if (rule.description) {
      return rule.description;
    }

    return rule.id
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function showError(message) {
    status.textContent = message;
    status.dataset.tone = "error";
  }

  function clearError() {
    status.textContent = "";
    delete status.dataset.tone;
  }

  function renderMaster(enabled) {
    toggle.checked = enabled;
    masterState.textContent = enabled ? "On" : "Paused";
    document.body.toggleAttribute("data-paused", !enabled);
  }

  function renderRules(rules) {
    ruleList.textContent = "";

    if (rules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No rules yet";
      ruleList.append(empty);
      return;
    }

    for (const rule of rules) {
      const row = document.createElement("label");
      row.className = "rule";

      const name = document.createElement("span");
      name.className = "rule-name";
      name.textContent = getRuleLabel(rule);

      const input = document.createElement("input");
      input.className = "switch";
      input.type = "checkbox";
      input.setAttribute("role", "switch");
      input.checked = rule.enabled;
      input.dataset.ruleId = rule.id;

      row.append(name, input);
      ruleList.append(row);
    }
  }

  async function render() {
    const config = await shared.getConfig();
    renderMaster(config.enabled);
    renderRules(config.rules);
  }

  // Saves run one at a time: a rule change reads the stored rules and writes
  // them back, so two at once would lose one. `confirm` puts the control in the
  // state that was stored. On failure the popup is drawn again from storage, so
  // a switch never shows a state that was not kept.
  let lastSave = Promise.resolve();
  function save(write, confirm) {
    lastSave = lastSave.then(async () => {
      try {
        const result = await write();
        if (result && !result.ok) {
          showError(result.errors.join(" "));
          await render();
          return;
        }
        clearError();
        confirm();
      } catch {
        showError("Could not save");
        await render().catch(() => undefined);
      }
    });
  }

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    renderMaster(enabled);
    save(
      () => shared.saveEnabled(enabled),
      () => renderMaster(enabled)
    );
  });

  ruleList.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement && input.dataset.ruleId)) {
      return;
    }

    const { ruleId } = input.dataset;
    const enabled = input.checked;
    save(
      async () => {
        const config = await shared.getConfig();
        return shared.saveConfig({
          enabled: config.enabled,
          rules: config.rules.map((rule) =>
            rule.id === ruleId ? { ...rule, enabled } : rule
          ),
        });
      },
      () => {
        for (const row of ruleList.querySelectorAll("input")) {
          if (row.dataset.ruleId === ruleId) {
            row.checked = enabled;
          }
        }
      }
    );
  });

  editRules.addEventListener("click", () => {
    extensionApi.runtime.openOptionsPage();
  });

  try {
    await render();
  } catch {
    showError("Could not load rules");
  }
})();

(async function initOptions() {
  const shared = globalThis.DiffKitRedirect;
  const enabledToggle = document.getElementById("enabled-toggle");
  const masterState = document.getElementById("master-state");
  const rulesEditor = document.getElementById("rules-editor");
  const saveButton = document.getElementById("save-button");
  const resetButton = document.getElementById("reset-button");
  const saveStatus = document.getElementById("save-status");

  function setStatus(message, tone) {
    saveStatus.textContent = message;
    saveStatus.dataset.tone = tone || "";
  }

  function renderMaster(enabled) {
    enabledToggle.checked = enabled;
    masterState.textContent = enabled ? "On" : "Paused";
  }

  async function loadConfig() {
    const config = await shared.getConfig();
    renderMaster(config.enabled);
    rulesEditor.value = JSON.stringify(config.rules, null, 2);

    if (config.validationErrors.length > 0) {
      setStatus(config.validationErrors.join(" "), "error");
      return;
    }

    setStatus("", "");
  }

  async function saveConfig() {
    let parsedRules;
    try {
      parsedRules = JSON.parse(rulesEditor.value);
    } catch {
      setStatus("Rules must be valid JSON.", "error");
      return;
    }

    const result = await shared.saveConfig({
      enabled: enabledToggle.checked,
      rules: parsedRules,
    });

    if (!result.ok) {
      setStatus(result.errors.join(" "), "error");
      return;
    }

    await loadConfig();
    setStatus("Saved", "");
  }

  // The switch applies at once, on top of the stored rules, so pausing never
  // depends on the editor holding valid JSON.
  async function saveEnabled() {
    const enabled = enabledToggle.checked;
    renderMaster(enabled);
    const config = await shared.getConfig();
    const result = await shared.saveConfig({ enabled, rules: config.rules });
    if (!result.ok) {
      setStatus(result.errors.join(" "), "error");
      renderMaster(config.enabled);
    }
  }

  enabledToggle.addEventListener("change", saveEnabled);

  saveButton.addEventListener("click", saveConfig);

  resetButton.addEventListener("click", () => {
    rulesEditor.value = JSON.stringify(shared.getDefaultRules(), null, 2);
    setStatus("Defaults restored. Save to apply.", "");
  });

  await loadConfig();
})();

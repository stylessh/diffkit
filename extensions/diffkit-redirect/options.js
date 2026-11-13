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

  // The switch applies at once and writes only itself, so pausing never depends
  // on the editor holding valid JSON and never touches the stored rules. Writes
  // run one at a time, and a failed one puts the switch back to what storage
  // holds, so quick changes cannot leave it showing a value that was not kept.
  const SWITCH_NOT_SAVED = "Could not save";
  let lastMasterSave = Promise.resolve();
  function saveEnabled() {
    const enabled = enabledToggle.checked;
    renderMaster(enabled);
    lastMasterSave = lastMasterSave.then(async () => {
      try {
        await shared.saveEnabled(enabled);
        renderMaster(enabled);
        if (saveStatus.textContent === SWITCH_NOT_SAVED) {
          setStatus("", "");
        }
      } catch {
        setStatus(SWITCH_NOT_SAVED, "error");
        const stored = await shared.getConfig().catch(() => null);
        if (stored) {
          renderMaster(stored.enabled);
        }
      }
    });
  }

  enabledToggle.addEventListener("change", saveEnabled);

  saveButton.addEventListener("click", saveConfig);

  resetButton.addEventListener("click", () => {
    rulesEditor.value = JSON.stringify(shared.getDefaultRules(), null, 2);
    setStatus("Defaults restored. Save to apply.", "");
  });

  await loadConfig();
})();

(function initDiffKitRedirectShared(global) {
  const extensionApi = global.chrome ?? global.browser;

  const STORAGE_KEYS = {
    enabled: "enabled",
    rules: "rules",
  };

  const DEFAULT_RULES = [
    {
      id: "github-overview",
      label: "Overview page",
      description: "Redirect the GitHub overview page to DiffKit.",
      enabled: true,
      match: {
        urlRegex: "^https://github\\.com/?(?:[?#].*)?$",
      },
      redirect: {
        url: "https://diff-kit.com/",
      },
    },
    {
      id: "github-pulls",
      label: "Pulls list",
      description: "Redirect the GitHub pulls page to DiffKit pulls.",
      enabled: true,
      match: {
        urlRegex: "^https://github\\.com/pulls(?:/.*)?(?:[?#].*)?$",
      },
      redirect: {
        url: "https://diff-kit.com/pulls",
      },
    },
    {
      id: "github-global-issues",
      label: "Issues list",
      description: "Redirect GitHub global issues pages to DiffKit issues.",
      enabled: true,
      match: {
        urlRegex: "^https://github\\.com/issues(?:/.*)?(?:[?#].*)?$",
      },
      redirect: {
        url: "https://diff-kit.com/issues",
      },
    },
    {
      id: "github-repo-overview",
      label: "Repository overview",
      description:
        "Redirect GitHub repository home (two-segment path) to DiffKit repo overview.",
      enabled: true,
      match: {
        urlRegex: "^https://github\\.com/([^/?#]+)/([^/?#]+)/?(?:[?#].*)?$",
        excludeUrlRegexes: [
          "^https://github\\.com/(?:orgs|new|settings|organizations|account)(?:/|$|[?#])",
        ],
      },
      redirect: {
        replacement: "https://diff-kit.com/$1/$2",
      },
    },
    {
      id: "github-pull-details",
      label: "Pull request details",
      description: "Redirect GitHub pull request detail pages to DiffKit.",
      enabled: true,
      match: {
        urlRegex: "^https://github\\.com/([^/?#]+)/([^/?#]+)/pull/(\\d+)/?$",
      },
      redirect: {
        replacement: "https://diff-kit.com/$1/$2/pull/$3",
      },
    },
    {
      id: "github-review-details",
      label: "Code review page",
      description: "Redirect GitHub PR changes pages to DiffKit review pages.",
      enabled: true,
      match: {
        urlRegex:
          "^https://github\\.com/([^/?#]+)/([^/?#]+)/pull/(\\d+)/changes/?$",
      },
      redirect: {
        replacement: "https://diff-kit.com/$1/$2/review/$3",
      },
    },
    {
      id: "github-issue-details",
      label: "Issue details",
      description: "Redirect GitHub issue detail pages to DiffKit.",
      enabled: true,
      match: {
        urlRegex: "^https://github\\.com/([^/?#]+)/([^/?#]+)/issues/(\\d+)/?$",
      },
      redirect: {
        replacement: "https://diff-kit.com/$1/$2/issues/$3",
      },
    },
    {
      id: "github-user-profile",
      label: "User profile",
      description:
        "Redirect GitHub user/org profile home (single-segment path) to DiffKit profile.",
      enabled: true,
      match: {
        urlRegex: "^https://github\\.com/([^/?#]+)/?(?:[?#].*)?$",
        excludeUrlRegexes: [
          "^https://github\\.com/(?:pulls|issues|notifications|explore|marketplace|settings|login|join|sponsors?|topics|collections|codespaces|features|enterprise|team|pricing|resources|readme|security|opensource|copilot|education|orgs|organizations|new|account|watching|dashboard|sessions)(?:/|$|[?#])",
        ],
      },
      redirect: {
        replacement: "https://diff-kit.com/$1",
      },
    },
  ];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function callApi(method, ...args) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const callback = (result) => {
        if (settled) {
          return;
        }

        settled = true;
        const runtimeError = extensionApi.runtime?.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(result);
      };

      try {
        const maybePromise = method(...args, callback);
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(
            (result) => {
              if (settled) {
                return;
              }
              settled = true;
              resolve(result);
            },
            (error) => {
              if (settled) {
                return;
              }
              settled = true;
              reject(error);
            }
          );
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function storageGet(keys) {
    return callApi(
      extensionApi.storage.sync.get.bind(extensionApi.storage.sync),
      keys
    );
  }

  function storageSet(values) {
    return callApi(
      extensionApi.storage.sync.set.bind(extensionApi.storage.sync),
      values
    );
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(isNonEmptyString);
  }

  function normalizeRule(rawRule, index) {
    const fallbackId = `rule-${index + 1}`;
    const rule = {
      id: isNonEmptyString(rawRule?.id) ? rawRule.id.trim() : fallbackId,
      label: isNonEmptyString(rawRule?.label) ? rawRule.label.trim() : "",
      description: isNonEmptyString(rawRule?.description)
        ? rawRule.description.trim()
        : "",
      enabled: rawRule?.enabled !== false,
      match: {
        exactUrl: isNonEmptyString(rawRule?.match?.exactUrl)
          ? rawRule.match.exactUrl.trim()
          : "",
        urlRegex: isNonEmptyString(rawRule?.match?.urlRegex)
          ? rawRule.match.urlRegex.trim()
          : "",
        excludeUrlRegexes: normalizeStringArray(
          rawRule?.match?.excludeUrlRegexes
        ).map((entry) => entry.trim()),
      },
      redirect: {
        url: isNonEmptyString(rawRule?.redirect?.url)
          ? rawRule.redirect.url.trim()
          : "",
        replacement: isNonEmptyString(rawRule?.redirect?.replacement)
          ? rawRule.redirect.replacement.trim()
          : "",
      },
    };

    return rule;
  }

  function isValidUrl(value) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  function isValidRegex(value) {
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }

  function validateMatch(rule) {
    const errors = [];

    if (!(rule.match.exactUrl || rule.match.urlRegex)) {
      errors.push(
        `Rule "${rule.id}" needs either match.exactUrl or match.urlRegex.`
      );
    }

    if (rule.match.exactUrl && !isValidUrl(rule.match.exactUrl)) {
      errors.push(`Rule "${rule.id}" has an invalid match.exactUrl.`);
    }

    if (rule.match.urlRegex && !isValidRegex(rule.match.urlRegex)) {
      errors.push(`Rule "${rule.id}" has an invalid match.urlRegex.`);
    }

    for (const excludePattern of rule.match.excludeUrlRegexes) {
      if (!isValidRegex(excludePattern)) {
        errors.push(
          `Rule "${rule.id}" has an invalid exclude regex "${excludePattern}".`
        );
      }
    }

    return errors;
  }

  function validateRedirect(rule) {
    const errors = [];

    if (!(rule.redirect.url || rule.redirect.replacement)) {
      errors.push(
        `Rule "${rule.id}" needs either redirect.url or redirect.replacement.`
      );
    }

    if (rule.redirect.url && !isValidUrl(rule.redirect.url)) {
      errors.push(`Rule "${rule.id}" has an invalid redirect.url.`);
    }

    return errors;
  }

  function validateRule(rule, seenIds) {
    const errors = [];

    if (seenIds.has(rule.id)) {
      errors.push(`Duplicate rule id "${rule.id}".`);
    }
    seenIds.add(rule.id);

    return errors.concat(validateMatch(rule), validateRedirect(rule));
  }

  function validateRules(candidateRules) {
    if (!Array.isArray(candidateRules)) {
      return {
        ok: false,
        errors: ["Rules must be a JSON array."],
        rules: [],
      };
    }

    const rules = candidateRules.map(normalizeRule);
    const seenIds = new Set();
    const errors = rules.flatMap((rule) => validateRule(rule, seenIds));

    return {
      ok: errors.length === 0,
      errors,
      rules,
    };
  }

  function getDefaultRules() {
    return deepClone(DEFAULT_RULES);
  }

  async function getConfig() {
    const stored = await storageGet({
      [STORAGE_KEYS.enabled]: true,
      [STORAGE_KEYS.rules]: getDefaultRules(),
    });

    const validation = validateRules(stored[STORAGE_KEYS.rules]);
    return {
      enabled: stored[STORAGE_KEYS.enabled] !== false,
      rules: validation.ok ? validation.rules : getDefaultRules(),
      validationErrors: validation.ok ? [] : validation.errors,
    };
  }

  async function saveConfig(config) {
    const validation = validateRules(config.rules);
    if (!validation.ok) {
      return {
        ok: false,
        errors: validation.errors,
      };
    }

    await storageSet({
      [STORAGE_KEYS.enabled]: config.enabled !== false,
      [STORAGE_KEYS.rules]: validation.rules,
    });

    return {
      ok: true,
      errors: [],
    };
  }

  // Writes the master switch alone, so it can never put back rules that another
  // save is replacing at the same moment.
  async function saveEnabled(enabled) {
    await storageSet({ [STORAGE_KEYS.enabled]: enabled !== false });
  }

  function expandReplacement(template, match) {
    return template.replace(
      /\$(\d+)/g,
      (_, index) => match[Number(index)] ?? ""
    );
  }

  function isRuleExcluded(urlString, rule) {
    return rule.match.excludeUrlRegexes.some((excludePattern) =>
      new RegExp(excludePattern).test(urlString)
    );
  }

  function buildRedirectResult(rule, targetUrl, urlString) {
    if (!targetUrl || targetUrl === urlString) {
      return null;
    }

    return {
      rule,
      targetUrl,
    };
  }

  function matchExactRedirect(urlString, rule) {
    if (!(rule.match.exactUrl && urlString === rule.match.exactUrl)) {
      return null;
    }

    return buildRedirectResult(rule, rule.redirect.url, urlString);
  }

  function matchRegexRedirect(urlString, rule) {
    if (!rule.match.urlRegex) {
      return null;
    }

    const regex = new RegExp(rule.match.urlRegex);
    const match = urlString.match(regex);
    if (!match) {
      return null;
    }

    const targetUrl =
      rule.redirect.url || expandReplacement(rule.redirect.replacement, match);
    return buildRedirectResult(rule, targetUrl, urlString);
  }

  function findRedirectForRule(urlString, rawRule) {
    const rule = normalizeRule(rawRule, 0);
    if (!rule.enabled || isRuleExcluded(urlString, rule)) {
      return null;
    }

    return (
      matchExactRedirect(urlString, rule) || matchRegexRedirect(urlString, rule)
    );
  }

  function findRedirect(urlString, rules) {
    for (const rawRule of rules) {
      const redirect = findRedirectForRule(urlString, rawRule);
      if (redirect) {
        return redirect;
      }
    }

    return null;
  }

  global.DiffKitRedirect = {
    STORAGE_KEYS,
    getConfig,
    getDefaultRules,
    saveConfig,
    saveEnabled,
    validateRules,
    findRedirect,
  };
})(globalThis);

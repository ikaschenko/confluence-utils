const REQUIRED_STRING_FIELDS = ["baseUrl", "parentPageId", "apiToken", "email"];

function loadLocalConfig() {
  try {
    return {
      config: require("./config.local"),
      localFileFound: true
    };
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND" && error.message.includes("config.local")) {
      return {
        config: require("./config.example"),
        localFileFound: false
      };
    }

    throw error;
  }
}

function getConfigValidationErrors(config) {
  const errors = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return ["CONFIG must export an object."];
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof config[field] !== "string" || config[field].trim() === "") {
      errors.push(`CONFIG.${field} must be a non-empty string.`);
    }
  }

  if (!Number.isInteger(config.normLen) || config.normLen <= 0) {
    errors.push("CONFIG.normLen must be a positive integer.");
  }

  if (!Array.isArray(config.extractRules) || config.extractRules.length === 0) {
    errors.push("CONFIG.extractRules must contain at least one rule.");
    return errors;
  }

  config.extractRules.forEach((rule, index) => {
    const prefix = `CONFIG.extractRules[${index}]`;

    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }

    ["name", "start", "end"].forEach(field => {
      if (typeof rule[field] !== "string" || rule[field].trim() === "") {
        errors.push(`${prefix}.${field} must be a non-empty string.`);
      }
    });

    if (rule.cutOffHeader !== undefined && typeof rule.cutOffHeader !== "string") {
      errors.push(`${prefix}.cutOffHeader must be a string when provided.`);
    }

    if (!Number.isInteger(rule.normLen) || rule.normLen <= 0) {
      errors.push(`${prefix}.normLen must be a positive integer.`);
    }
  });

  return errors;
}

function formatConfigErrorMessage(validationErrors, localFileFound) {
  const lines = ["Configuration error."];

  if (!localFileFound) {
    lines.push("Missing local settings file: src/config.local.js.");
  }

  if (validationErrors.length > 0) {
    lines.push(...validationErrors.map(error => `- ${error}`));
  }

  lines.push("To resume: copy src/config.example.js to src/config.local.js and fill in the required values.");

  return lines.join("\n");
}

function loadConfig() {
  const { config, localFileFound } = loadLocalConfig();
  const validationErrors = getConfigValidationErrors(config);

  if (!localFileFound || validationErrors.length > 0) {
    throw new Error(formatConfigErrorMessage(validationErrors, localFileFound));
  }

  return config;
}

module.exports = {
  loadConfig
};
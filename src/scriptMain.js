const axios = require("axios");
const cheerio = require("cheerio");
const { loadConfig } = require("./config");

let CONFIG;
let headers;

function initializeConfig() {
  CONFIG = loadConfig();
  headers = {
    Authorization: `Bearer ${CONFIG.apiToken}`,
    Accept: "application/json"
  };
}

async function getChildPages(parentId) {
  let results = [];
  let start = 0;
  const limit = 50;

  while (true) {

    const res = await axios.get(
      `${CONFIG.baseUrl}/rest/api/content/${parentId}/child/page`,
      {
        headers,
        params: { start, limit }
      }
    );

    const pages = res.data.results;

    results = results.concat(pages);

    if (pages.length < limit) break;
    start += limit;
  }

  return results;
}

async function getPageContent(pageId) {
  const res = await axios.get(
    `${CONFIG.baseUrl}/rest/api/content/${pageId}`,
    {
      headers,
      params: { expand: "body.storage" }
    }
  );

  return res.data.body.storage.value;
}

async function getPageTitle(pageId) {
  try {
    const res = await axios.get(
      `${CONFIG.baseUrl}/rest/api/content/${pageId}`,
      { headers, params: { expand: "" } }
    );
    return res.data.title || "";
  } catch (err) {
    return "";
  }
}

function extractValues(html) {

  const $ = cheerio.load(html);
  const text = $.text();

  let result = {};

  for (const rule of CONFIG.extractRules) {

    result[rule.name] = extractBetween(
      text,
      rule.start,
      rule.end,
      rule.cutOffHeader
    );

  }

  return result;
}

function extractBetween(text, startMarker, endMarker, cutOffHeader) {
  
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return "";

  const fromStart = startIndex + startMarker.length;

  const endIndex = text.indexOf(endMarker, startIndex);
  if (endIndex === -1) return "";

  const tmpValue = text.substring(fromStart, endIndex).trim();
  if (cutOffHeader && tmpValue.startsWith(cutOffHeader)) {
    return tmpValue.substring(cutOffHeader.length).trim();
  }
  return tmpValue;
}

async function crawl(parentId, rows = []) {
  const children = await getChildPages(parentId);

  for (const page of children) {
    console.log("Checking sub-page: ", page.title);
    const html = await getPageContent(page.id);

    const extracted = extractValues(html);

    rows.push({
      title: page.title,
      ...extracted
    });

    await crawl(page.id, rows);
  }

  return rows;
}

function printTable(rows) {

  const headers = [formatTextForLength("Page Title", CONFIG.normLen), ...CONFIG.extractRules.map(r => r.name)];

  console.log("");
  console.log(headers.join(" | "));
  console.log("-".repeat(60));

  rows.forEach(r => {

    const values = [
      formatTextForLength(r.title, CONFIG.normLen),
      ...CONFIG.extractRules.map(rule => formatTextForLength(r[rule.name], rule.normLen))
    ];

    console.log(values.join(" | "));

  });
}

function formatTextForLength(text, length) {

  if (typeof text !== "string") {
    text = String(text ?? "");
  }

  if (text.length === length) {
    return text;
  }

  if (text.length < length) {
    return text + " ".repeat(length - text.length);
  }

  if (length <= 3) {
    return ".".repeat(length);
  }

  return text.substring(0, length - 3) + "...";
}

(async () => {
  try {
    initializeConfig();

    console.log("Launching at: " + new Date().toISOString());
    const rootTitle = await getPageTitle(CONFIG.parentPageId);
    if (rootTitle) {
      console.log("Root page: " + rootTitle);
    } else {
      console.log("Root page ID: " + CONFIG.parentPageId);
    }

    const rows = await crawl(CONFIG.parentPageId);
    printTable(rows);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
})();


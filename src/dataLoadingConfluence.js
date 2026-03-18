const axios = require("axios");
const cheerio = require("cheerio");

const dataFromConfluence = [];

let config;
let headers;

function initialize(configFromCaller) {
  config = configFromCaller;
  headers = {
    Authorization: `Bearer ${config.apiToken}`,
    Accept: "application/json"
  };
}

async function getChildPages(parentId) {
  let results = [];
  let start = 0;
  const limit = 50;

  while (true) {
    const response = await axios.get(
      `${config.baseUrl}/rest/api/content/${parentId}/child/page`,
      {
        headers,
        params: { start, limit }
      }
    );

    const pages = response.data.results;
    results = results.concat(pages);

    if (pages.length < limit) {
      break;
    }

    start += limit;
  }

  return results;
}

async function getPageContent(pageId) {
  const response = await axios.get(
    `${config.baseUrl}/rest/api/content/${pageId}`,
    {
      headers,
      params: { expand: "body.storage" }
    }
  );

  return response.data.body.storage.value;
}

function extractBetween(text, startMarker, endMarker, cutOffHeader) {
  const startIndex = text.indexOf(startMarker);

  if (startIndex === -1) {
    return "";
  }

  const fromStart = startIndex + startMarker.length;
  const endIndex = text.indexOf(endMarker, startIndex);

  if (endIndex === -1) {
    return "";
  }

  const value = text.substring(fromStart, endIndex).trim();

  if (cutOffHeader && value.startsWith(cutOffHeader)) {
    return value.substring(cutOffHeader.length).trim();
  }

  return value;
}

function extractAdoLinks(html) {
  const $ = cheerio.load(html);
  const adoLinks = [];

  $("table tr, table th, table td").each(function () {
    const cellText = $(this).text();

    if (!/azure\s*link/i.test(cellText)) {
      return;
    }

    $(this).find("a[href]").each(function () {
      const href = $(this).attr("href") || "";

      if (/visualstudio\.com\/.*\/_workitems\/edit\/\d+/.test(href) ||
          /dev\.azure\.com\/.*\/_workitems\/edit\/\d+/.test(href)) {
        adoLinks.push(href);
      }
    });
  });

  return [...new Set(adoLinks)];
}

function extractValues(html) {
  const $ = cheerio.load(html);
  const text = $.text();
  const extractedValues = {};

  for (const rule of config.extractRules) {
    extractedValues[rule.name] = extractBetween(
      text,
      rule.start,
      rule.end,
      rule.cutOffHeader
    );
  }

  return extractedValues;
}

function addNormalizedAliases(extractedValues) {
  const normalizedValues = { ...extractedValues };

  if (normalizedValues["FRD ID"] !== undefined && normalizedValues.FrdId === undefined) {
    normalizedValues.FrdId = normalizedValues["FRD ID"];
  }

  return normalizedValues;
}

async function crawl(parentId) {
  const children = await getChildPages(parentId);

  for (const page of children) {
    console.log("Checking sub-page:", page.title);

    const html = await getPageContent(page.id);
    const extractedValues = addNormalizedAliases(extractValues(html));
    const adoLinks = extractAdoLinks(html);

    dataFromConfluence.push({
      title: page.title,
      ...extractedValues,
      adoLinks
    });

    await crawl(page.id);
  }
}

async function loadDataFromConfluence(configFromCaller) {
  initialize(configFromCaller);
  dataFromConfluence.length = 0;

  await crawl(config.parentPageId);

  return dataFromConfluence;
}

module.exports = {
  dataFromConfluence,
  loadDataFromConfluence
};
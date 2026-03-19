const cheerio = require("cheerio");
const { createClient } = require("./confluenceClient");

const dataFromConfluence = [];

let config;
let client;

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
  const children = await client.getChildPages(parentId);

  for (const page of children) {
    console.log("Checking sub-page:", page.title);

    const html = await client.getPageContent(page.id);
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
  config = configFromCaller;
  client = createClient(config);
  dataFromConfluence.length = 0;

  await crawl(config.confluencePageId);

  return dataFromConfluence;
}

module.exports = {
  dataFromConfluence,
  loadDataFromConfluence
};
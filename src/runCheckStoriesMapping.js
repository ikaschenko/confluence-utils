const fs = require("fs");
const { loadConfig } = require("../config/config");
const { dataFromConfluence, loadDataFromConfluence } = require("../dataload/dataLoadingConfluence");
const { dataFromExcel, loadDataFromExcel } = require("../dataload/dataLoadingExcel");
const { createAdoClient } = require("../dataload/dataLoadingADO");

function ensureExcelFileIsReadable(excelFilePath) {
  try {
    fs.accessSync(excelFilePath, fs.constants.F_OK | fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Excel file is not available: ${excelFilePath}`);
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isExcelStoryCode(value) {
  const story = normalizeText(value);

  return story !== "" && !/^\d+$/.test(story);
}

function getConfluenceFrdId(item) {
  return normalizeText(item.frdId ?? item["FRD ID"]);
}

function buildExcelStoryEntries(excelItems) {
  const storyEntries = [];
  let currentEpic = "";

  for (const item of excelItems) {
    const epic = normalizeText(item.epic);
    const story = normalizeText(item.story);

    if (epic !== "") {
      currentEpic = epic;
    }

    if (!isExcelStoryCode(story) || currentEpic === "") {
      continue;
    }

    storyEntries.push({
      rowNumber: item.rowNumber,
      epic: currentEpic,
      story
    });
  }

  return storyEntries;
}

function groupExcelStoriesByEpic(excelStoryEntries) {
  const storiesByEpic = new Map();

  for (const entry of excelStoryEntries) {
    if (!storiesByEpic.has(entry.epic)) {
      storiesByEpic.set(entry.epic, []);
    }

    storiesByEpic.get(entry.epic).push(entry);
  }

  for (const entries of storiesByEpic.values()) {
    entries.sort((left, right) => right.story.length - left.story.length);
  }

  return storiesByEpic;
}

async function enrichAdoLinks(confluenceItems, config) {
  const allLinks = confluenceItems.flatMap(item =>
    Array.isArray(item.adoLinks) ? item.adoLinks : []
  );
  const uniqueLinks = [...new Set(allLinks)];

  if (uniqueLinks.length === 0) {
    return;
  }

  if (!config.adoPat) {
    console.log("ADO PAT not configured — skipping ADO state enrichment.");
    return;
  }

  console.log(`Fetching ADO states for ${uniqueLinks.length} work item(s)...`);
  const adoClient = createAdoClient(config);
  const stateByLink = new Map();

  for (const link of uniqueLinks) {
    try {
      const item = await adoClient.getWorkItemByUrl(link);
      stateByLink.set(link, item.state);
    } catch (error) {
      const msg = error.response
        ? `HTTP ${error.response.status}`
        : error.message;
      console.warn(`  Warning: could not fetch state for ${link}: ${msg}`);
      stateByLink.set(link, "");
    }
  }

  for (const item of confluenceItems) {
    if (!Array.isArray(item.adoLinks)) {
      continue;
    }
    item.adoLinks = item.adoLinks.map(link => ({
      link,
      status: stateByLink.get(link) || ""
    }));
  }
}

function compareConfluenceAndExcel(confluenceItems, excelItems) {
  const excelStoryEntries = buildExcelStoryEntries(excelItems);
  const excelStoriesByEpic = groupExcelStoriesByEpic(excelStoryEntries);
  const alreadyAddedInExcel = [];
  const newInConfluence = [];

  for (const item of confluenceItems) {
    const title = normalizeText(item.title);
    const frdId = getConfluenceFrdId(item);

    if (frdId === "") {
      continue;
    }

    const epicStories =
      excelStoriesByEpic.get(frdId) ??
      [...excelStoriesByEpic.entries()].find(([epicKey]) => frdId.includes(epicKey))?.[1] ??
      [];
    const matchedStory = epicStories.find(storyEntry => title.startsWith(storyEntry.story));

    if (matchedStory) {
      alreadyAddedInExcel.push({
        title,
        frdId: frdId,
        adoLinks: item.adoLinks || [],
        excelStory: matchedStory.story,
        excelRowNumber: matchedStory.rowNumber
      });

      continue;
    }

    let reason = "Epic found in Excel, but no matching story prefix.";

    if (epicStories.length === 0) {
      reason = "Epic not found in Excel.";
    }

    newInConfluence.push({
      title,
      frdId: frdId,
      adoLinks: item.adoLinks || [],
      reason
    });
  }

  return {
    alreadyAddedInExcel,
    newInConfluence
  };
}

function extractStoryPrefix(title) {
  const match = normalizeText(title).match(/^([A-Za-z]+(?:\([A-Za-z]\))?-[\d.]+)/);
  return match ? match[1] : "";
}

function hasNoKeyData(item) {
  const storyId = extractStoryPrefix(item.title);
  const frdId = getConfluenceFrdId(item);
  const hasAdoLinks = Array.isArray(item.adoLinks) && item.adoLinks.length > 0;
  return storyId === "" && frdId === "" && !hasAdoLinks;
}

function escapeCsvValue(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function printConfluenceDataAsCsv(confluenceItems) {
  if (confluenceItems.length === 0) {
    return;
  }

  // Derive columns from the first item's keys.
  // "title" becomes "User Story id"; "frdId" becomes "FRD ID" — both are placed first explicitly.
  const skipKeys = new Set(["title", "frdId"]);
  const firstItem = confluenceItems[0];
  const columnKeys = Object.keys(firstItem).filter(k => !skipKeys.has(k));
  const headers = ["User Story id", "FRD ID", ...columnKeys.map(k => (k === "adoLinks" ? "ADO Links" : k))];

  console.log("");
  console.log("Confluence data (CSV):");
  console.log(headers.map(escapeCsvValue).join(","));

  for (const item of confluenceItems) {
    const storyId = extractStoryPrefix(item.title);
    const frdId = item.frdId ?? "";
    const rowValues = columnKeys.map(k => {
      const val = item[k];
      if (Array.isArray(val)) {
        return val.map(entry => {
          if (typeof entry === "object" && entry !== null) {
            return entry.status ? `${entry.link} [${entry.status}]` : (entry.link ?? "");
          }
          return String(entry);
        }).join("; ");
      }
      return val ?? "";
    });
    console.log([storyId, frdId, ...rowValues].map(escapeCsvValue).join(","));
  }
}

function printDataStructure(title, data) {
  console.log("");
  console.log(title);
  console.dir(data, { depth: null });
}

function printComparisonResults(comparisonResults) {
  printDataStructure(
    `Already added in Excel (${comparisonResults.alreadyAddedInExcel.length})`,
    comparisonResults.alreadyAddedInExcel
  );

  printDataStructure(
    `New in Confluence, not yet mentioned in Excel (${comparisonResults.newInConfluence.length})`,
    comparisonResults.newInConfluence
  );
}

(async () => {
  try {
    const config = loadConfig();

    console.log("Launching at: " + new Date().toISOString());

    ensureExcelFileIsReadable(config.excelFilePath);

    await loadDataFromConfluence(config);
    dataFromConfluence.splice(0, dataFromConfluence.length, ...dataFromConfluence.filter(item => !hasNoKeyData(item)));
    await enrichAdoLinks(dataFromConfluence, config);
    loadDataFromExcel(config);

    printDataStructure("dataFromConfluence", dataFromConfluence);
    printConfluenceDataAsCsv(dataFromConfluence);
    printDataStructure("dataFromExcel", dataFromExcel);

    printComparisonResults(compareConfluenceAndExcel(dataFromConfluence, dataFromExcel));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
})();


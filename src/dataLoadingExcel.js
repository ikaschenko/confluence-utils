const fs = require("node:fs");
const path = require("node:path");
const xlsx = require("xlsx");

const dataFromExcel = [];

function resolveExcelPath(excelFilePath) {
  return path.isAbsolute(excelFilePath)
    ? excelFilePath
    : path.resolve(__dirname, excelFilePath);
}

function normalizeHeaderValue(value) {
  return String(value ?? "").trim();
}

function normalizeCellValue(value) {
  return String(value ?? "").trim();
}

function columnLetterToIndex(columnLetter) {
  const normalizedLetter = normalizeHeaderValue(columnLetter).toUpperCase();

  if (!/^[A-Z]+$/.test(normalizedLetter)) {
    return -1;
  }

  let index = 0;

  for (const character of normalizedLetter) {
    index = (index * 26) + (character.charCodeAt(0) - 64);
  }

  return index - 1;
}

function findColumnIndex(headerRow, configuredColumnName) {
  const normalizedName = normalizeHeaderValue(configuredColumnName);
  const columnIndexFromLetter = columnLetterToIndex(normalizedName);

  if (columnIndexFromLetter !== -1) {
    return columnIndexFromLetter;
  }

  return headerRow.findIndex(header => normalizeHeaderValue(header) === normalizedName);
}

function readWorksheetRows(worksheet) {
  return xlsx.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false
  });
}

function loadDataFromExcel(config) {
  const excelPath = resolveExcelPath(config.excelFilePath);

  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }

  const workbook = xlsx.readFile(excelPath);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("The Excel file does not contain any worksheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = readWorksheetRows(worksheet);

  if (rows.length === 0) {
    throw new Error("The first worksheet is empty.");
  }

  const headerRow = rows[0];
  const epicColumnIndex = findColumnIndex(headerRow, config.columnEpic);
  const storyColumnIndex = findColumnIndex(headerRow, config.columnStory);

  if (epicColumnIndex === -1) {
    throw new Error(`Column not found in worksheet: ${config.columnEpic}`);
  }

  if (storyColumnIndex === -1) {
    throw new Error(`Column not found in worksheet: ${config.columnStory}`);
  }

  dataFromExcel.length = 0;

  rows.slice(1).forEach((row, index) => {
    const epic = normalizeCellValue(row[epicColumnIndex]);
    const story = normalizeCellValue(row[storyColumnIndex]);

    if (epic === "" && story === "") {
      return;
    }

    dataFromExcel.push({
      rowNumber: index + 2,
      epic,
      story
    });
  });

  return dataFromExcel;
}

module.exports = {
  dataFromExcel,
  loadDataFromExcel
};
module.exports = {
  baseUrl: "",
  confluencePageId: "",
  confluencePagesToIgnore: "", // optional: comma-separated page IDs to skip (page and all its children)
  apiToken: "",
  email: "",
  excelFilePath: "",
  columnEpic: "",
  columnStory: "",
  outDir: "",
  adoOrg: "",
  adoPat: "", // Azure DevOps personal access token
  normLen: 50,
  printDataFromExcel: false,        // optional: print raw Excel data
  printDataFromConfluence: false,    // optional: print raw Confluence data
  printConfluenceDataAsCsv: true,    // optional: print Confluence data as CSV
  printAlreadyInExcel: false,        // optional: print items already matched in Excel
  extractRules: [
    {
      name: "",
      start: "",
      end: "",
      cutOffHeader: "",
      normLen: 30
    }
  ]
};
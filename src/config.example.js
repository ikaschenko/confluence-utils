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
  normLen: 50,
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
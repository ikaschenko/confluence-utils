const { loadConfig } = require("../config/config");
const { createAdoClient } = require("../dataload/dataLoadingADO");

// Sample ADO work-item URLs to test with (replace with real links).
const TEST_ADO_LINKS = [
  "https://dev.azure.com/DevOpsAD/40fc911e-43e1-4746-bf4c-af2ba93b4046/_workitems/edit/584486",
  "https://devopsad.visualstudio.com/OneTalent/_workitems/edit/584457",
  "https://devopsad.visualstudio.com/OneTalent/_workitems/edit/543043"
];

(async () => {
  try {
    const config = loadConfig({ requireExcel: false, requireAdo: true });
    const adoClient = createAdoClient(config);

    console.log("Launching ADO boards test at: " + new Date().toISOString());
    console.log(`Fetching ${TEST_ADO_LINKS.length} work item(s)...\n`);

    const results = await adoClient.getWorkItemsByUrls(TEST_ADO_LINKS);

    for (const item of results) {
      if (item.error) {
        console.error(`FAILED  ${item.url}`);
        console.error(`        ${item.error}\n`);
      } else {
        console.log(`#${item.id}  ${item.title}`);
        console.log(`  State:     ${item.state}`);
        console.log(`  Type:      ${item.workItemType}`);
        console.log(`  Assigned:  ${item.assignedTo}`);
        console.log(`  URL:       ${item.url}\n`);
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
})();

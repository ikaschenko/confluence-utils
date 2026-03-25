const fs = require("fs");
const path = require("path");
const TurndownService = require("turndown");
const { loadConfig } = require("../config/config");
const { createClient } = require("../dataload/confluenceClient");

function parseCliOverrides(argv) {
  const overrides = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "-pageId" && i + 1 < argv.length) {
      overrides.confluencePageId = argv[++i];
    } else if (argv[i] === "-outDir" && i + 1 < argv.length) {
      overrides.outDir = argv[++i];
    }
  }
  return overrides;
}

function sanitizeFileName(title) {
  let name = title.replace(/[\\\/:*?"<>|\x00-\x1f]/g, "_").trim();
  name = name.replace(/^\.+|\.+$/g, "");

  if (name.length > 200) {
    name = name.substring(0, 200);
  }

  return name || "_";
}

function resolveOutputDir(outDir) {
  return path.isAbsolute(outDir)
    ? outDir
    : path.resolve(process.cwd(), outDir);
}

function getUniqueFilePath(outputDir, baseName, usedNames) {
  let candidate = baseName;
  let counter = 1;

  while (usedNames.has(candidate.toLowerCase())) {
    counter++;
    candidate = `${baseName} (${counter})`;
  }

  usedNames.add(candidate.toLowerCase());

  return path.join(outputDir, `${candidate}.md`);
}

(async () => {
  try {
    const config = loadConfig({ requireExcel: false });
    const cliOverrides = parseCliOverrides(process.argv);
    if (cliOverrides.confluencePageId) config.confluencePageId = cliOverrides.confluencePageId;
    if (cliOverrides.outDir) config.outDir = cliOverrides.outDir;

    if (typeof config.outDir !== "string" || config.outDir.trim() === "") {
      throw new Error(
        "CONFIG.outDir must be a non-empty string.\n" +
        "Set it in src/config.local.js or pass -outDir via command line."
      );
    }

    const outputDir = resolveOutputDir(config.outDir);
    fs.mkdirSync(outputDir, { recursive: true });

    const client = createClient(config);
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced"
    });

    const usedNames = new Set();
    let exportedCount = 0;

    async function crawlAndSave(parentId) {
      const children = await client.getChildPages(parentId);

      for (const page of children) {
        console.log("Exporting:", page.title);

        const html = await client.getPageContent(page.id);
        const markdown = turndown.turndown(html);

        const baseName = sanitizeFileName(page.title);
        const filePath = getUniqueFilePath(outputDir, baseName, usedNames);

        fs.writeFileSync(filePath, markdown, "utf-8");
        exportedCount++;

        await crawlAndSave(page.id);
      }
    }

    console.log("Launching at: " + new Date().toISOString());
    console.log("Output directory: " + outputDir);

    // Export the root page itself
    const rootPage = await client.getPage(config.confluencePageId);
    console.log("Exporting (root):", rootPage.title);
    const rootMarkdown = turndown.turndown(rootPage.body);
    const rootBaseName = sanitizeFileName(rootPage.title);
    const rootFilePath = getUniqueFilePath(outputDir, rootBaseName, usedNames);
    fs.writeFileSync(rootFilePath, rootMarkdown, "utf-8");
    exportedCount++;

    await crawlAndSave(config.confluencePageId);

    console.log("");
    console.log(`Done. Exported ${exportedCount} page(s) to: ${outputDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
})();

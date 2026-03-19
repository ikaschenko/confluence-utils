To launch the current most usable script: 

> node ./src/runFull.js >./out/ec-20260315.txt

To export Confluence pages as Markdown:

> node ./src/runConfluenceExport2MD.js

Optional command-line overrides (take priority over config.local.js):

> node ./src/runConfluenceExport2MD.js -pageId 123456787 -outDir "c:/users/user123"

  -pageId <id>    Override confluencePageId from config
  -outDir <path>  Override outDir from config (absolute path)


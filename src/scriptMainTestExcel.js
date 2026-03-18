const { loadConfig } = require("./config");
const { dataFromExcel, loadDataFromExcel } = require("./dataLoadingExcel");

try {
	const config = loadConfig();
	loadDataFromExcel(config);
	console.dir(dataFromExcel, { depth: null });
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}

const { loadConfig } = require("./config/configValidation");
const { dataFromExcel, loadDataFromExcel } = require("./dataload/dataLoadingExcel");

try {
	const config = loadConfig();
	loadDataFromExcel(config);
	console.dir(dataFromExcel, { depth: null });
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}

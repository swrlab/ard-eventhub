/*

	ard-eventhub
	by SWR audio lab

	this helper does a best-effort at detecting the runtime environment
	it is optimized for local/ARD on-prem and GCP services

*/

const os = require('os');

module.exports = function () {
	if (process.env.FUNCTION_NAME || process.env.FUNCTION_TARGET) {
		return 'GCF';
	} else if (process.env.K_CONFIGURATION && process.env.K_SERVICE) {
		return 'GCR';
	} else if (process.env.KUBERNETES_SERVICE_HOST) {
		return 'GKE';
	} else if (os.hostname().indexOf('.local') !== -1) {
		return 'LOCAL';
	} else if (os.hostname().indexOf('s00') !== -1) {
		return 'ONPREM';
	} else {
		return 'NULL';
	}
};

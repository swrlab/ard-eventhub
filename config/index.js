/*

	ard-eventhub
	by SWR audio lab

*/

// import version from package.json
const { version } = require('../package.json');

// read env vars
const { STAGE } = process.env;

// set config
const serviceName = 'ard-eventhub';
const baseConfig = {
	userAgent: `${serviceName}/${version}`,
	pubsubPrefix: 'de.ard.eventhub',
	stage: STAGE,
	version,
};

// set config based on stages
const config = {
	dev: {
		...baseConfig,
		serviceName: `${serviceName}-dev`,
	},
	prod: {
		...baseConfig,
		serviceName,
	},
};

// check stage and config
if (!STAGE || !config[STAGE]) {
	console.error('stageConfig[STAGE] not found >', STAGE);
	process.exit(1);
}

// check existence of several process vars
if (!process.env.GCP_PROJECT_ID) {
	console.error('process.env.GCP_PROJECT_ID not found');
	process.exit(1);
} else if (!process.env.FIREBASE_API_KEY) {
	console.error('process.env.FIREBASE_API_KEY not found');
	process.exit(1);
}

module.exports = config[STAGE];

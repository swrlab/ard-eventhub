/*

	ard-eventhub
	by SWR audio lab

*/

// detect host environment
global.PORT = process.env.PORT || 8080;
global.STAGE = process.env.STAGE || 'DEV';
global.HOST_TYPE = require('./utils/getHostType')();
global.VERSION = require('../package.json').version;

// configure stage
const stageConfig = require('../config/stageConfig');
if (!stageConfig[global.STAGE]) {
	console.error('stageConfig[STAGE] not found >', global.STAGE);
	process.exit();
} else {
	global.STAGE_CONFIG = stageConfig[global.STAGE];
}

// enable datadog tracing
if (global.HOST_TYPE == 'GKE') {
	require('dd-trace').init({
		logInjection: true,
	});
}

// load node utils
const compression = require('compression');
const express = require('express');
const server = express();

// add debugging information to all headers
server.use(function (req, res, next) {
	// add service information
	res.set('x-service', global.STAGE_CONFIG.serviceName + '/' + global.VERSION);

	// continue with normal workflow
	next();
});

// import router
server.use('/', require('./ingest/router'));

// start express server
server.use(compression());
server.disable('x-powered-by');
server.listen(global.PORT);
console.log(
	'/// service is running >',
	global.PORT,
	'/ VERION >',
	global.VERSION,
	'/ STAGE >',
	global.STAGE,
	'/ HOST_TYPE >',
	global.HOST_TYPE
);

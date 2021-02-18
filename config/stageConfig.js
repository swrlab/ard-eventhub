/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = {
	DEV: {
		pubsubPrefix: 'dev-',
		serviceName: 'ard-eventhub-dev',
	},
	PROD: {
		pubsubPrefix: 'prod-',
		serviceName: 'ard-eventhub',
	},
};

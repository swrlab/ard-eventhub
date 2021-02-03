/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = {
	DEV: {
		pubsubPrefix: 'DEV-',
		serviceName: 'ard-eventhub-dev',
	},
	PROD: {
		pubsubPrefix: '',
		serviceName: 'ard-eventhub',
	},
};

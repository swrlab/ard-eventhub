/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const datastoreClient = require('./_client');

module.exports = async (kind, id) => {
	// set key
	let key = datastoreClient.key({
		namespace: global.STAGE,
		path: id ? [kind, id] : [kind],
	});

	await datastoreClient.delete(key)

	// return data
	return Promise.resolve(data);
};

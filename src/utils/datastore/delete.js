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

	let result = await datastoreClient.delete(key)

	// return result
	return Promise.resolve(result);
};

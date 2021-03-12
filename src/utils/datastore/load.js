/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const datastoreClient = require('./_client');
const config = require('../../../config');

module.exports = async (kind, id) => {
	// set key
	const key = datastoreClient.key({
		namespace: config.stage,
		path: id ? [kind, id] : [kind],
	});

	// save data
	const [data] = await datastoreClient.get(key);

	// insert key
	if (data && key.id) {
		data.id = parseFloat(key.id);
	} else if (data && key.name) {
		data.id = key.name;
	}

	// return data
	return Promise.resolve(data);
};

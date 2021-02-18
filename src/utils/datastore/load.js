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

	// save data
	let [data] = await datastoreClient.get(key);

	// insert key
	if (data && key.id) {
		data.id = parseInt(key.id);
	} else if (data && key.name) {
		data.id = key.name;
	}

	// return data
	return Promise.resolve(data);
};

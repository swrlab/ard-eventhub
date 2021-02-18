/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const datastoreClient = require('./_client');

module.exports = async (data, kind, id) => {
	// set key
	let key = datastoreClient.key({
		namespace: global.STAGE,
		path: id ? [kind, id] : [kind],
	});

	// save data
	let [saved] = await datastoreClient.save({
		key,
		data,
	});

	// insert key
	if (key.id) {
		data.id = parseInt(key.id);
	} else if (key.name) {
		data.id = key.name;
	}

	// return data
	return Promise.resolve(data);
};

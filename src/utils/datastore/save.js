/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
const datastoreClient = require('./_client')
const config = require('../../../config')

module.exports = async (data, kind, id) => {
	const thisData = data

	// set key
	const key = datastoreClient.key({
		namespace: config.stage,
		path: id ? [kind, id] : [kind],
	})

	// save data
	await datastoreClient.save({
		key,
		data,
		excludeFromIndexes: ['contributors'],
	})

	// insert key
	if (key.id) {
		thisData.id = Number.parseInt(key.id)
	} else if (key.name) {
		thisData.id = key.name
	}

	// return data
	return Promise.resolve(thisData)
}

/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
const datastoreClient = require('./_client')
const config = require('../../../config')

module.exports = async (kind, id) => {
	// set key
	const key = datastoreClient.key({
		namespace: config.stage,
		path: id ? [kind, id] : [kind],
	})

	const result = await datastoreClient.delete(key)

	// return result
	return Promise.resolve(result)
}

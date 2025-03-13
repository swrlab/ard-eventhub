/*

	ard-eventhub
	by SWR Audio Lab

*/
const feed = require('../../data')

module.exports = async (publisherId) => {
	const coreApi = require('../../data/ard-core-livestreams.json')

	const publisher = coreApi.items.find((entry) => {
		return publisherId === entry.publisher.id ? entry.publisher : null
	})

	return Promise.resolve(publisher)
}

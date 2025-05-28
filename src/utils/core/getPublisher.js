/*

	ard-eventhub
	by SWR Audio Lab

*/
// load api feed (needed to get the file initialized)
const _feed = require('../../data')

module.exports = async (publisherId) => {

	const ardFeed = require('../../data/ard-core-livestreams.json')

	const publisher = ardFeed.items.find((entry) => {
		return publisherId === entry.publisher.id ? entry.publisher : null
	})

	return Promise.resolve(publisher)
}

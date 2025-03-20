/*

	ard-eventhub
	by SWR Audio Lab

*/
const getArdFeed = require('../../data')

module.exports = async (publisherId) => {

	const ardFeed = await getArdFeed()
	const publisher = ardFeed.items.find((entry) => {
		return publisherId === entry.publisher.id ? entry.publisher : null
	})

	return Promise.resolve(publisher)
}

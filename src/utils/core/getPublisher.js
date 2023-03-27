/*

	ard-eventhub
	by SWR Audio Lab

*/

// TODO: check IDs in ARD Core-API instead of dump
const coreApi = require('../../data/coreApi.json')

module.exports = async (publisherId) => {
	const publisher = coreApi.find((entry) => {
		return publisherId === entry.id ? entry : null
	})

	return Promise.resolve(publisher)
}

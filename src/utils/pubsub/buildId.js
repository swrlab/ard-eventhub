/*

	ard-eventhub
	by SWR Audio Lab

	this file creates a PubSub-safe id,
	which is just a URL-encoded version

*/

// load util
const convertId = require('./convertId')

// load config
const { pubSubPrefix } = require('../../../config')

module.exports = (input) => {
	return `${pubSubPrefix}${convertId.encode(input)}`
}

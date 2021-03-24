/*

	ard-eventhub
	by SWR audio lab

	this file creates a PubSub-safe id,
	which is just a URL-encoded version

*/

// load util
const convertId = require('./convertId')

// load config
const config = require('../../../config')

module.exports = (input) => {
	return `${config.pubSubPrefix}${convertId.encode(input)}`
}

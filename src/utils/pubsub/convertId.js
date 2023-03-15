/*

	ard-eventhub
	by SWR Audio Lab

	this file creates a PubSub-safe id,
	which is just a URL-encoded version

*/

module.exports = {
	encode: (input) => {
		return encodeURIComponent(input)
	},
	decode: (input) => {
		return decodeURIComponent(input)
	},
}

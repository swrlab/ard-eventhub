/*

	ard-eventhub
	by SWR Audio Lab

	this file creates a PubSub-safe id,
	which is just a URL-encoded version

*/

export const convertId = {
	encode: (input: string) => {
		return encodeURIComponent(input)
	},
	decode: (input: string) => {
		return decodeURIComponent(input)
	},
}

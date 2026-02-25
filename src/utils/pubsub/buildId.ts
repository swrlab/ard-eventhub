/*

	ard-eventhub
	by SWR Audio Lab

	this file creates a PubSub-safe id,
	which is just a URL-encoded version

*/

// load config
import config from '#config'
// load util
import convertId from './convertId.ts'

export default (input: string) => {
	return `${config.pubSubPrefix}${convertId.encode(input)}`
}

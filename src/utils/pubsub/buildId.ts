/*

	ard-eventhub
	by SWR Audio Lab

	this file creates a PubSub-safe id,
	which is just a URL-encoded version

*/

// load util
import convertId from './convertId.ts'

// load config
import config from '../../../config'

export default (input: string) => {
	return `${config.pubSubPrefix}${convertId.encode(input)}`
}

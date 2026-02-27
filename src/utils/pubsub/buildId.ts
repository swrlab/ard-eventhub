/*

	ard-eventhub
	by SWR Audio Lab

	this file creates a PubSub-safe id,
	which is just a URL-encoded version

*/

import { pubSubPrefix } from '#config'
import convertId from './convertId.ts'

export default (input: string) => `${pubSubPrefix}${convertId.encode(input)}`

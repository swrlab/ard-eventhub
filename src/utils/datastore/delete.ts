/*

	ard-eventhub
	by SWR Audio Lab

*/

import config from '#config'
// load pubsub for internal queues
import datastoreClient from './_client.ts'

export default async (kind: string, id: string) => {
	// set key
	const key = datastoreClient.key({
		namespace: config.stage,
		path: id ? [kind, id] : [kind],
	})

	const result = await datastoreClient.delete(key)

	// return result
	return Promise.resolve(result)
}

/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import datastoreClient from './_client'
import config from '../../../config'

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

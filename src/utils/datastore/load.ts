/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import datastoreClient from './_client'
import config from '../../../config'

export default async (kind: string, id: any) => {
	// set key
	const key = datastoreClient.key({
		namespace: config.stage,
		path: id ? [kind, id] : [kind],
	})

	// save data
	const [data] = await datastoreClient.get(key)

	// insert key
	if (data && key.id) {
		data.id = Number.parseInt(key.id)
	} else if (data && key.name) {
		data.id = key.name
	}

	// return data
	return Promise.resolve(data)
}

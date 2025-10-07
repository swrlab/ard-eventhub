/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import datastoreClient from './_client'
import config from '../../../config'

export default async (data: any, kind: string, id: number | null) => {
	const thisData = data

	// set key
	const key = datastoreClient.key({
		namespace: config.stage,
		path: id ? [kind, id] : [kind],
	})

	// save data
	await datastoreClient.save({
		key,
		data,
		excludeFromIndexes: ['contributors'],
	})

	// insert key
	if (key.id) {
		thisData.id = Number.parseInt(key.id)
	} else if (key.name) {
		thisData.id = key.name
	}

	// return data
	return Promise.resolve(thisData)
}

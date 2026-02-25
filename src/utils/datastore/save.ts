import config from '#config'
import datastoreClient from './_client.ts'

export default async (data: Record<PropertyKey, string | number | object>, kind: string, id: number | null) => {
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
		thisData.id = Number.parseInt(key.id, 10)
	} else if (key.name) {
		thisData.id = key.name
	}

	// return data
	return Promise.resolve(thisData)
}

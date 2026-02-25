import config from '#config'
import datastoreClient from './_client.ts'

export default async (kind: string, id: string | number) => {
	// set key
	const key = datastoreClient.key({
		namespace: config.stage,
		path: id ? [kind, id] : [kind],
	})

	// save data
	const [data] = await datastoreClient.get(key)

	// insert key
	if (data && key.id) {
		data.id = Number.parseInt(key.id, 10)
	} else if (data && key.name) {
		data.id = key.name
	}

	// return data
	return Promise.resolve(data)
}

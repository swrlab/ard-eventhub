import { stage } from '#env'
import datastoreClient from './_client.ts'

export default async (kind: string, id: string | number) => {
	const key = datastoreClient.key({
		namespace: stage,
		path: id ? [kind, id] : [kind],
	})

	const [data] = await datastoreClient.get(key)

	// insert key
	if (data && key.id) {
		data.id = Number.parseInt(key.id, 10)
	} else if (data && key.name) {
		data.id = key.name
	}

	return data
}

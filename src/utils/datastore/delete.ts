import { stage } from '#env'
import { datastoreClient } from './_client.ts'

export const datastoreDelete = async (kind: string, id: string) => {
	const key = datastoreClient.key({
		namespace: stage,
		path: id ? [kind, id] : [kind],
	})

	const result = await datastoreClient.delete(key)

	return result
}

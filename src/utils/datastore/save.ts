import { stage } from '#env'
import datastoreClient from './_client.ts'

export default async <T>(data: T, kind: string, id?: number | string): Promise<string | number> => {
	const key = datastoreClient.key({
		namespace: stage,
		path: id ? [kind, id] : [kind],
	})

	await datastoreClient.save({
		key,
		data,
		excludeFromIndexes: ['contributors'],
	})
	if (!hasKeyIdentifier(key)) {
		throw new Error('Did not create a datastore key.')
	}
	return key.id ? Number.parseInt(key.id, 10) : (key.name as string)
}

function hasKeyIdentifier(key: { id?: string; name?: string }): key is { id: string } | { name: string } {
	return Boolean(key.id || key.name)
}

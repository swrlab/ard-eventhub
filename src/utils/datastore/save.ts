import config from '#config'
import datastoreClient from './_client.ts'

export default async <T>(data: T, kind: string, id?: number | string): Promise<string> => {
	const key = datastoreClient.key({
		namespace: config.stage,
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
	// TODO: why does it have to be a number when the returned key is a string type?
	return key.name ?? (key.id as string)
	// return key.id ? Number.parseInt(key.id, 10) : key.name
}

function hasKeyIdentifier(key: { id?: string; name?: string }): key is { id: string } | { name: string } {
	return Boolean(key.id || key.name)
}

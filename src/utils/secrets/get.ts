/*

	ard-eventhub
	by SWR Audio Lab

*/

import { client } from './_client'

export default async (name: string) => {
	// fetch latest version
	const [secret] = await client.accessSecretVersion({
		name: `projects/${process.env.GCP_PROJECT_ID}/secrets/${name}/versions/latest`,
	})

	// convert payload
	const payload = secret?.payload?.data?.toString()
	if (!payload) return Promise.reject(new Error('Secret not found'))

	// attempt to convert to json
	let json = null
	try {
		json = JSON.parse(payload)
	} catch (_error) {
		// do nothing
	}

	// return both
	return Promise.resolve({ payload, json })
}

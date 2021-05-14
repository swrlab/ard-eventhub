/*

	ard-eventhub
	by SWR audio lab

*/

const { client } = require('./_client')

module.exports = async (name) => {
	// fetch latest version
	const [secret] = await client.accessSecretVersion({
		name: `projects/${process.env.GCP_PROJECT_ID}/secrets/${name}/versions/latest`,
	})

	// convert payload
	const payload = secret?.payload?.data?.toString()

	// attempt to convert to json
	let json = null
	try {
		json = JSON.parse(payload)
	} catch (err) {
		// do nothing
	}

	// return both
	return Promise.resolve({ payload, json })
}

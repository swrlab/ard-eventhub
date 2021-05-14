/*

	ard-eventhub
	by SWR audio lab

*/

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager')

const client = new SecretManagerServiceClient({
	projectId: process.env.GCP_PROJECT_ID,
})

module.exports = {
	client,
}

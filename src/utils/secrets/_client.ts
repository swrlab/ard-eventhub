/*

	ard-eventhub
	by SWR Audio Lab

*/

import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

export const client = new SecretManagerServiceClient({
	projectId: process.env.GCP_PROJECT_ID,
})

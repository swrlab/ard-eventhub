import { Datastore } from '@google-cloud/datastore'
import { projectId } from '#env'

export const datastoreClient = new Datastore({
	projectId,
})

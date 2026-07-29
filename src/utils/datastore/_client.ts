import { Datastore } from '@google-cloud/datastore'
import { projectId } from '#env'

export default new Datastore({
	projectId,
})

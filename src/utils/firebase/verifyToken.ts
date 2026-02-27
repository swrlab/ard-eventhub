import firebaseAdmin from 'firebase-admin'
import { projectId } from '#env'
import type { DecodedIdToken } from '#types'

firebaseAdmin.initializeApp({
	projectId,
})

export default async (token: string): Promise<DecodedIdToken> => {
	const verification = await firebaseAdmin.auth().verifyIdToken(token)
	return verification
}

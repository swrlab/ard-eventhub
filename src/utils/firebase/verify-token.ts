import type { DecodedIdToken } from '#types'
import firebaseAdmin from 'firebase-admin'
import { projectId } from '#env'

firebaseAdmin.initializeApp({
	projectId,
})

export const firebaseVerifyToken = async (token: string): Promise<DecodedIdToken> => {
	const verification = await firebaseAdmin.auth().verifyIdToken(token)
	return verification
}

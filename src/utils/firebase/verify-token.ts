import type { DecodedIdToken } from 'firebase-admin/auth'
import firebaseAdmin from 'firebase-admin'
import { projectId } from '#env'

firebaseAdmin.initializeApp({
	projectId,
})

/**
 * Verify a Firebase ID token and return the decoded claims.
 * @param token - JWT access token
 * @returns Decoded Firebase user token
 */
export const firebaseVerifyToken = async (token: string): Promise<DecodedIdToken> => {
	const verification = await firebaseAdmin.auth().verifyIdToken(token)
	return verification
}

import { initializeApp } from 'firebase-admin/app'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'
import { projectId } from '#env'

initializeApp({
	projectId,
})

/**
 * Verify a Firebase ID token and return the decoded claims.
 * @param token - JWT access token
 * @returns Decoded Firebase user token
 */
export const firebaseVerifyToken = async (token: string): Promise<DecodedIdToken> => {
	const verification = await getAuth().verifyIdToken(token)
	return verification
}

/*

	ard-eventhub
	by SWR Audio Lab

*/

// load firebase
import firebaseAdmin from 'firebase-admin'

firebaseAdmin.initializeApp({
	projectId: process.env.GCP_PROJECT_ID,
})

export default async (token: string) => {
	// attempt to verify token
	const verification = await firebaseAdmin.auth().verifyIdToken(token)

	// return data
	return Promise.resolve(verification)
}

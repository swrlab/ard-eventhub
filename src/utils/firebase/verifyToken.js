/*

	ard-eventhub
	by SWR audio lab

*/

// load firebase
const firebaseAdmin = require('firebase-admin')

firebaseAdmin.initializeApp({
	projectId: process.env.GCP_PROJECT_ID,
})

module.exports = async (token) => {
	// attempt to verify token
	const verification = await firebaseAdmin.auth().verifyIdToken(token)

	// return data
	return Promise.resolve(verification)
}

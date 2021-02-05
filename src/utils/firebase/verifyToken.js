/*

	ard-eventhub
	by SWR audio lab

*/

// load firebase
var firebaseAdmin = require('firebase-admin');
firebaseAdmin.initializeApp({
	projectId: process.env.GCP_PROJECT_ID,
});

module.exports = async (token) => {
	// attempt to verify token
	let verification = await firebaseAdmin.auth().verifyIdToken(token);

	// return data
	return Promise.resolve(verification);
};

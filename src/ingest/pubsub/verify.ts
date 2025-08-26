/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node packages
import { OAuth2Client } from 'google-auth-library'

import { NextFunction, Response } from 'express'
import UserTicketRequest from './userTicketRequest.ts'

const authClient = new OAuth2Client()

// load utils
import logger from '../../utils/logger'

// set config
const serviceAccountEmail = process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL
const source = 'ingest/pubsub/verify'

export default async (
	req: UserTicketRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		// read token from header
		const bearer = req.header('Authorization')

		// check token email vs. subscription email
		if (!bearer || !bearer.match(/Bearer (.*)/)) {
			// user failed to provide auth header
			return res.sendStatus(401)
		}

		// parse token
		const [idToken] = bearer.match(/Bearer (.*)/) || []

		if (idToken == null) throw Error('No ID token could be found.')

		// verify token, throws error if invalid
		req.user = await authClient.verifyIdToken({
			idToken,
		})

		// check token email vs. subscription email
		if (req.user?.getPayload()?.email !== serviceAccountEmail) {
			// user provided valid token but failed email verification
			return res.sendStatus(204)
		}

		// continue with normal workflow, user is authenticated 🎉
		return next()
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to verify user',
			source,
			error,
			data: { ...req.headers, authorization: 'hidden' },
		})

		return res.sendStatus(500)
	}
}

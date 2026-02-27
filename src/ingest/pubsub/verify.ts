import logger from '@frytg/logger'
import type { NextFunction, Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { serviceAccountEmail } from '#env'

import type { UserTicketRequest } from '#types'

const authClient = new OAuth2Client()

const source = 'ingest/pubsub/verify'

export default async (req: UserTicketRequest, res: Response, next: NextFunction) => {
	try {
		// read token from header
		const bearer = req.header('Authorization')
		const bearerMatch = bearer?.match(/Bearer (.*)/)

		// check token email vs. subscription email
		if (!bearerMatch) {
			// user failed to provide auth header
			return res.sendStatus(401)
		}

		const [_, idToken] = bearerMatch
		if (!idToken) throw Error('No ID token could be found.')

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

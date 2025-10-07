/*

	ard-eventhub
	by SWR Audio Lab

*/

// load utils
import datastore from '../../../utils/datastore'
import firebase from '../../../utils/firebase'
import logger from '../../../utils/logger'
import { NextFunction, Response } from 'express'
import UserTokenRequest from './userTokenRequest.ts'

const source = 'ingest/auth/middleware/verify'
const ERROR_JSON = { message: 'Forbidden', errors: [], status: 403 }

export default async (req: UserTokenRequest, res: Response, next: NextFunction) => {
	try {
		// parse input, preset vars
		const regexp = /(?!Bearer\s{1})([a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+)/g
		let authorization = req.headers['x-authorization']?.toString() || req.headers.authorization

		// check existence of x-auth... header
		if (!authorization || !regexp.test(authorization)) {
			logger.log({
				level: 'notice',
				message: 'user token missing',
				source,
				data: { ...req.headers, authorization: 'hidden' },
			})
			return res.sendStatus(401)
		}
		// extract token
		[authorization] = authorization.match(regexp)!

		// validate JWT token with firebase
		try {
			// successful verifications will save JWT user profile to req
			const user = await firebase.verifyToken(authorization)

			req.user = user
			res.set('x-ard-eventhub-uid', user.uid)
		} catch (error) {
			logger.log({
				level: 'notice',
				message: 'user token invalid',
				source,
				error,
				data: { ...req.headers, authorization: 'hidden' },
			})
			return res.status(403).json(ERROR_JSON)
		}

		// lookup user in DB
		const userDb = await datastore.load('users', req.user.email!)

		// check if profile exists and valid
		if (!userDb || userDb.active !== true) {
			logger.log({
				level: 'notice',
				message: 'user not found or not active',
				source,
				data: { ...req.headers, authorization: 'hidden' },
			})
			return res.status(403).json(ERROR_JSON)
		}

		// add user details to request profile
		req.user.institutionId = userDb.institutionId

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

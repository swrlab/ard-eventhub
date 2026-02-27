import type { google } from '@google-cloud/pubsub/build/protos/protos.js'
import type { Request } from 'express'
import type { LoginTicket } from 'google-auth-library'

export type { Subscription } from '@google-cloud/pubsub'
export type { NextFunction, Response } from 'express'

import type { DecodedIdToken } from 'firebase-admin/auth'

export type { DecodedIdToken, Request }

// Google PubSub
export type ISubscription = google.pubsub.v1.ISubscription
export type ITopic = google.pubsub.v1.ITopic

// Express Middlewares

export interface UserTokenRequest extends Request {
	user?: DecodedIdToken
}

export interface UserTicketRequest extends Request {
	user?: LoginTicket
}

// taken from express
interface ParamsDictionary {
	[key: string]: string | string[]
	[key: number]: string
}

export interface UserTokenRequestWithParams<P = ParamsDictionary> extends Request<P> {
	user?: DecodedIdToken
}

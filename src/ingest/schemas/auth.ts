import * as z from 'zod'

import { registerSchema } from './common.ts'

export const authLoginBodySchema = z
	.object({
		email: z.string(),
		password: z.string(),
	})
	.strict()

export const authRefreshBodySchema = z
	.object({
		refreshToken: z.string(),
	})
	.strict()

export const authResetBodySchema = z.object({
	email: z.string(),
})

export const authResponseSchema = registerSchema(
	z.object({
		expiresIn: z.number(),
		expires: z.string(),
		token: z.string(),
		refreshToken: z.string(),
		user: z.record(z.string(), z.unknown()),
		trace: z.string().nullable().optional(),
	}),
	'authResponse',
)

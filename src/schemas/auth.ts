import { z } from 'zod'
import { iso8601Timestamp } from './common.ts'

/**
 * POST /auth/login request body (fields optional in OpenAPI; validated as strings when present).
 */
export const authLoginBody = z
	.object({
		email: z
			.string()
			.meta({ examples: ['my-email@example.com'] })
			.optional(),
		password: z
			.string()
			.meta({ examples: ['my-password'] })
			.optional(),
	})
	.strict()
	.meta({ id: 'authLoginBody' })

/**
 * POST /auth/refresh request body.
 */
export const authRefreshBody = z
	.object({
		refreshToken: z
			.string()
			.meta({ examples: ['abcXYZ...'] })
			.optional(),
	})
	.strict()
	.meta({ id: 'authRefreshBody' })

/**
 * POST /auth/reset request body.
 */
export const authResetBody = z
	.object({
		email: z
			.string()
			.meta({ examples: ['my-email@example.com'] })
			.optional(),
	})
	.meta({ id: 'authResetBody' })

/**
 * Successful authentication response.
 */
export const authResponse = z
	.object({
		expiresIn: z.number().meta({ description: 'TTL for the token in seconds', examples: [3600] }),
		expires: iso8601Timestamp.meta({ description: 'ISO8601 compliant timestamp for the token expiry' }),
		token: z.string().meta({ description: 'ready to use token for API queries', examples: ['ey...'] }),
		refreshToken: z
			.string()
			.meta({ description: 'refresh token to be used with `/auth/refresh`/ endpoint', examples: ['A0...'] }),
		user: z
			.object({})
			.passthrough()
			.meta({ description: 'Firebase-type user object obtained by decoding the JWT token' }),
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'authResponse' })

export type AuthLoginBody = z.infer<typeof authLoginBody>
export type AuthRefreshBody = z.infer<typeof authRefreshBody>
export type AuthResetBody = z.infer<typeof authResetBody>
export type AuthResponse = z.infer<typeof authResponse>

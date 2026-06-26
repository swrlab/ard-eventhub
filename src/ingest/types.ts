import type { LoginTicket } from 'google-auth-library'
import type { DecodedIdToken } from 'firebase-admin/auth'

export type AppVariables = {
	user?: DecodedIdToken & { institutionId?: string }
	pubsubUser?: LoginTicket
}

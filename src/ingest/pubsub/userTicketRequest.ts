import type { Request } from 'express'
import type { LoginTicket } from 'google-auth-library'

export default interface UserTicketRequest extends Request {
	user?: LoginTicket
}

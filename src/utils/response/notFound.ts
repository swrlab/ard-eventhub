import type { Request, Response } from 'express'

export type RequestError = {
	status: number
	message: string
	errors?: string
	data?: Record<string, string>
	trace?: string
}

export default (req: Request, res: Response, err: RequestError) => {
	try {
		return res.status(err.status || 404).json({
			...err.data,
			message: err.message,
			errors: err.errors,
			trace: req.headers['x-cloud-trace-context'] || null,
		})
	} catch {
		return res.sendStatus(500)
	}
}

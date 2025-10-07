/*

	ard-eventhub
	by SWR Audio Lab

*/

import { Request, Response } from 'express'

export default (req: Request, res: Response, data: any, status?: any) => {
	try {
		return res.status(status || 200).json({
			...data,
			trace: req.headers['x-cloud-trace-context'] || null,
		})
	} catch (_error) {
		return res.sendStatus(500)
	}
}

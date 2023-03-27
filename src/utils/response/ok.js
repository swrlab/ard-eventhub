/*

	ard-eventhub
	by SWR Audio Lab

*/

module.exports = (req, res, data, status) => {
	try {
		return res.status(status || 200).json({
			...data,
			trace: req.headers['x-cloud-trace-context'] || null,
		})
	} catch (error) {
		return res.sendStatus(500)
	}
}

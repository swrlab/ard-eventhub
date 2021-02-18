/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = function (req, res, err) {
	try {
		return res.status(err.status || 400).json({
			...err.data,
			message: err.message,
			errors: err.errors,
			trace: req.headers['x-cloud-trace-context'] || null,
		});
	} catch (err) {
		return res.sendStatus(500);
	}
};

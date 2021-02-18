/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = function (req, res, data, status) {
	try {
		return res.status(status || 200).json({
			...data,
			trace: req.headers['x-cloud-trace-context'] || null,
		});
	} catch (err) {
		return res.sendStatus(500);
	}
};

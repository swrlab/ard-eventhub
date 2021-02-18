/*

	ard-eventhub
	by SWR audio lab

*/

module.exports = function (level, msg) {
	if (global.STAGE != 'DEV') {
		return;
	}

	if (msg instanceof Array) {
		msg = msg.join(' > ');
	}

	if (level == 'log') {
		console.log(msg);
	} else if (level == 'warn') {
		console.warn(msg);
	} else if (level == 'error') {
		console.error(msg);
	}
};

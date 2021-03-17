/*

	ard-eventhub
	by SWR audio lab

    simple tests with mocha and chai

*/

// Add eslint exceptions for chai
/* global describe it */

const { expect } = require('chai')

describe('Simple Math Test', () => {
	it('1 + 1 = 2', () => {
		expect(1 + 1).to.equal(2)
	})
	it('3 * 3 = 9', () => {
		expect(3 * 3).to.equal(9)
	})
})

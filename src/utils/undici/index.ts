/*

	ard-eventhub
	by SWR Audio Lab

*/

// load request handler
// @ts-ignore
import undici from '@swrlab/utils/packages/undici'

// add tracing
import { tracer } from '../tracer'

const enabledTracer = process.env.DD_TRACER_ENABLED === 'true' ? tracer : null

// export handler
export default undici(enabledTracer)

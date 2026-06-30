import { Hono } from 'hono'

import pubsub from '@/src/ingest/handlers/pubsub.ts'
import authVerify from '@/src/ingest/middleware/authVerify.ts'
import pubsubAuthVerify from '@/src/ingest/middleware/pubsubAuthVerify.ts'
import type { AppVariables } from '@/src/ingest/types.ts'

const pubsubRoutes = new Hono<{ Variables: AppVariables }>()

pubsubRoutes.put('/', authVerify, pubsub)
pubsubRoutes.post('/', pubsubAuthVerify, pubsub)

export default pubsubRoutes

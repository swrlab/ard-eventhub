import { Hono } from 'hono'

import topicsList from '@/src/ingest/handlers/topicsList.ts'
import authVerify from '@/src/ingest/middleware/authVerify.ts'
import type { AppVariables } from '@/src/ingest/types.ts'

const topicsRoutes = new Hono<{ Variables: AppVariables }>()

topicsRoutes.get('/', authVerify, topicsList)
topicsRoutes.get('/:topicName', authVerify, topicsList)

export default topicsRoutes

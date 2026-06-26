import { Hono } from 'hono'

const healthRoutes = new Hono()

healthRoutes.get('/', (c) => c.body(null, 200))
healthRoutes.get('/health', (c) => c.body(null, 200))

export default healthRoutes

import { env } from './config/env.js'
import { buildApp } from './app.js'

const fastify = await buildApp()

try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}

import fp from 'fastify-plugin'
import { MongoClient } from 'mongodb'
import type { Db } from 'mongodb'
import type { FastifyPluginAsync } from 'fastify'
import { env } from '../config/env.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const client = new MongoClient(env.MONGODB_URI)
  await client.connect()

  const db = client.db(env.MONGODB_DB_NAME)

  fastify.decorate('db', db)

  fastify.addHook('onClose', async () => {
    await client.close()
  })

  fastify.log.info('MongoDB connected')
}

export default fp(dbPlugin, { name: 'db' })

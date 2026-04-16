import fp from 'fastify-plugin'
import { verifyToken } from '@clerk/backend'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { env } from '../config/env.js'
import { AppError } from '../domain/errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'No token provided')
    }
    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })
      request.userId = payload.sub
    } catch {
      throw new AppError(401, 'Invalid token')
    }
  }

  fastify.decorate('requireAuth', requireAuth)
}

export default fp(authPlugin, { name: 'auth' })

import type { FastifyPluginAsync } from 'fastify'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { ValidationError } from '../domain/errors.js'

function parseObjectId(val: string, label = 'id'): ObjectId {
  if (!ObjectId.isValid(val)) throw new ValidationError(`Invalid ${label}`)
  return new ObjectId(val)
}

const notebooksRoute: FastifyPluginAsync = async (fastify) => {
  // GET /notebooks — list all notebooks for authenticated user
  fastify.get('/notebooks', { preHandler: [fastify.requireAuth] }, async (req) => {
    return fastify.notebookService.list(req.userId)
  })

  // POST /notebooks — create notebook
  fastify.post('/notebooks', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const parsed = z.object({ title: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message)

    const notebook = await fastify.notebookService.create(req.userId, parsed.data.title)
    return reply.status(201).send(notebook)
  })

  // PATCH /notebooks/:id — update title
  fastify.patch('/notebooks/:id', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = z.object({ title: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message)

    const notebook = await fastify.notebookService.update(parseObjectId(id), req.userId, parsed.data.title)
    return reply.send(notebook)
  })

  // DELETE /notebooks/:id — delete notebook + cascade
  fastify.delete('/notebooks/:id', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await fastify.notebookService.delete(parseObjectId(id), req.userId)
    return reply.status(204).send()
  })
}

export default notebooksRoute

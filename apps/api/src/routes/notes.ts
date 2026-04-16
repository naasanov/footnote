import type { FastifyPluginAsync } from 'fastify'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { ValidationError } from '../domain/errors.js'

function parseObjectId(val: string, label = 'id'): ObjectId {
  if (!ObjectId.isValid(val)) throw new ValidationError(`Invalid ${label}`)
  return new ObjectId(val)
}

const objectIdString = z.string().refine(v => ObjectId.isValid(v), 'Invalid ObjectId')

const notesRoute: FastifyPluginAsync = async (fastify) => {
  // GET /notebooks/:notebookId/notes
  fastify.get(
    '/notebooks/:notebookId/notes',
    { preHandler: [fastify.requireAuth] },
    async (req) => {
      const { notebookId } = req.params as { notebookId: string }
      return fastify.noteService.listByNotebook(parseObjectId(notebookId, 'notebookId'), req.userId)
    },
  )

  // POST /notebooks/:notebookId/notes
  fastify.post(
    '/notebooks/:notebookId/notes',
    { preHandler: [fastify.requireAuth] },
    async (req, reply) => {
      const { notebookId } = req.params as { notebookId: string }
      const parsed = z.object({ title: z.string().min(1) }).safeParse(req.body)
      if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message)

      const note = await fastify.noteService.create(
        parseObjectId(notebookId, 'notebookId'),
        req.userId,
        parsed.data.title,
      )
      return reply.status(201).send(note)
    },
  )

  // GET /notes/:id — get single note (includes canvasState)
  fastify.get('/notes/:id', { preHandler: [fastify.requireAuth] }, async (req) => {
    const { id } = req.params as { id: string }
    return fastify.noteService.get(parseObjectId(id), req.userId)
  })

  // PATCH /notes/:id — update canvasState, activeSourceIds, title
  fastify.patch('/notes/:id', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const parsed = z
      .object({
        title: z.string().min(1).optional(),
        canvasState: z.record(z.unknown()).optional(),
        canvasBackground: z.enum(['none', 'dotted', 'ruled']).optional(),
        activeSourceIds: z.array(objectIdString).optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message)

    const data = parsed.data
    const activeSourceIds = data.activeSourceIds?.map(id => new ObjectId(id))

    const updates: {
      title?: string
      canvasState?: Record<string, unknown>
      canvasBackground?: 'none' | 'dotted' | 'ruled'
      activeSourceIds?: ObjectId[]
    } = {}

    if (data.title !== undefined) {
      updates.title = data.title
    }

    if (data.canvasState !== undefined) {
      updates.canvasState = data.canvasState
    }

    if (data.canvasBackground !== undefined) {
      updates.canvasBackground = data.canvasBackground
    }

    if (activeSourceIds !== undefined) {
      updates.activeSourceIds = activeSourceIds
    }

    const note = await fastify.noteService.update(parseObjectId(id), req.userId, updates)
    return reply.send(note)
  })

  // DELETE /notes/:id — delete note + cascade
  fastify.delete('/notes/:id', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await fastify.noteService.delete(parseObjectId(id), req.userId)
    return reply.status(204).send()
  })

  // GET /notes/:id/ocr-search — text search against ocr_results
  fastify.get('/notes/:id/ocr-search', { preHandler: [fastify.requireAuth] }, async (req) => {
    const { id } = req.params as { id: string }
    const parsed = z.object({ q: z.string().min(1) }).safeParse(req.query)
    if (!parsed.success) throw new ValidationError('Missing or invalid query param: q')

    return fastify.noteService.searchOcr(parseObjectId(id), req.userId, parsed.data.q)
  })
}

export default notesRoute

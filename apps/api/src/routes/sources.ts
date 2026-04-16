import type { FastifyPluginAsync } from 'fastify'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { ValidationError } from '../domain/errors.js'

const SCOPE_REGEX = /^(note|notebook):([a-f0-9]{24})$/

function parseObjectId(val: string, label = 'id'): ObjectId {
  if (!ObjectId.isValid(val)) throw new ValidationError(`Invalid ${label}`)
  return new ObjectId(val)
}

function parseScope(scopeParam: string) {
  const match = scopeParam.match(SCOPE_REGEX)
  if (!match) throw new ValidationError('Invalid scope. Expected format: note:<id> or notebook:<id>')
  return { type: match[1] as 'note' | 'notebook', id: new ObjectId(match[2]) }
}

const sourcesRoute: FastifyPluginAsync = async (fastify) => {
  // POST /sources — multipart file upload
  fastify.post('/sources', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    let scopeStr: string | undefined
    let fileBuffer: Buffer | undefined
    let filename = 'upload'
    let mimeType = 'application/octet-stream'

    // Consume all multipart parts, buffering the file
    for await (const part of req.parts()) {
      if (part.type === 'field' && part.fieldname === 'scope') {
        scopeStr = part.value as string
      } else if (part.type === 'file') {
        filename = part.filename || filename
        mimeType = part.mimetype
        const chunks: Buffer[] = []
        for await (const chunk of part.file) {
          chunks.push(chunk)
        }
        fileBuffer = Buffer.concat(chunks)
      }
    }

    if (!scopeStr) throw new ValidationError('Missing form field: scope')
    if (!fileBuffer) throw new ValidationError('Missing file')

    const scope = parseScope(scopeStr)
    const source = await fastify.sourceService.upload(fileBuffer, filename, mimeType, scope, req.userId)
    return reply.status(202).send(source)
  })

  // GET /sources?scope=notebook:id or ?scope=note:id
  fastify.get('/sources', { preHandler: [fastify.requireAuth] }, async (req) => {
    const parsed = z.object({ scope: z.string() }).safeParse(req.query)
    if (!parsed.success) throw new ValidationError('Missing query param: scope')

    const scope = parseScope(parsed.data.scope)
    return fastify.sourceService.listByScope(scope.type, scope.id, req.userId)
  })

  // GET /sources/:id/file — stream file from GridFS
  fastify.get('/sources/:id/file', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { stream, mimeType, filename } = await fastify.sourceService.streamFile(
      parseObjectId(id),
      req.userId,
    )
    return reply
      .header('Content-Type', mimeType)
      .header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
      .send(stream)
  })

  // PATCH /sources/:id — rename source
  fastify.patch('/sources/:id', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = z.object({ filename: z.string().min(1) }).safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message)

    const source = await fastify.sourceService.rename(parseObjectId(id), req.userId, parsed.data.filename)
    return reply.send(source)
  })

  // DELETE /sources/:id — delete source + chunks + GridFS file
  fastify.delete('/sources/:id', { preHandler: [fastify.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await fastify.sourceService.delete(parseObjectId(id), req.userId)
    return reply.status(204).send()
  })
}

export default sourcesRoute

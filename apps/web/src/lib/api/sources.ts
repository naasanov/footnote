import { apiFetch } from './client'
import type { Source, SourceScopeType, UpdateSourceRequest } from '@/lib/types'
import { env } from '@/config/env'

type GetToken = () => Promise<string | null>

export async function listSources(
  getToken: GetToken,
  scope: SourceScopeType,
  scopeId: string,
): Promise<Source[]> {
  const res = await apiFetch(`/sources?scope=${scope}:${scopeId}`, getToken)
  if (!res.ok) throw new Error('Failed to fetch sources')
  return res.json()
}

export async function uploadSource(
  getToken: GetToken,
  file: File,
  scopeType: SourceScopeType,
  scopeId: string,
): Promise<Source> {
  const token = await getToken()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('scope', `${scopeType}:${scopeId}`)

  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/sources`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) throw new Error('Failed to upload source')
  return res.json()
}

export async function deleteSource(getToken: GetToken, id: string): Promise<void> {
  const res = await apiFetch(`/sources/${id}`, getToken, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete source')
}

export async function renameSource(
  getToken: GetToken,
  id: string,
  data: UpdateSourceRequest,
): Promise<Source> {
  const res = await apiFetch(`/sources/${id}`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to rename source')
  return res.json()
}

export function getSourceFileUrl(id: string): string {
  return `${env.NEXT_PUBLIC_API_URL}/sources/${id}/file`
}

import { apiFetch } from './client'
import type {
  Notebook,
  CreateNotebookRequest,
  UpdateNotebookRequest,
} from '@/lib/types'

type GetToken = () => Promise<string | null>

export async function listNotebooks(getToken: GetToken): Promise<Notebook[]> {
  const res = await apiFetch('/notebooks', getToken)
  if (!res.ok) throw new Error('Failed to fetch notebooks')
  return res.json()
}

export async function createNotebook(
  getToken: GetToken,
  data: CreateNotebookRequest,
): Promise<Notebook> {
  const res = await apiFetch('/notebooks', getToken, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create notebook')
  return res.json()
}

export async function updateNotebook(
  getToken: GetToken,
  id: string,
  data: UpdateNotebookRequest,
): Promise<Notebook> {
  const res = await apiFetch(`/notebooks/${id}`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update notebook')
  return res.json()
}

export async function deleteNotebook(getToken: GetToken, id: string): Promise<void> {
  const res = await apiFetch(`/notebooks/${id}`, getToken, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete notebook')
}

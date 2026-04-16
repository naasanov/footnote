import { apiFetch } from './client'
import type { Note, CreateNoteRequest, UpdateNoteRequest, OcrSearchResult } from '@/lib/types'

type GetToken = () => Promise<string | null>

export async function listNotes(getToken: GetToken, notebookId: string): Promise<Note[]> {
  const res = await apiFetch(`/notebooks/${notebookId}/notes`, getToken)
  if (!res.ok) throw new Error('Failed to fetch notes')
  return res.json()
}

export async function getNote(getToken: GetToken, noteId: string): Promise<Note> {
  const res = await apiFetch(`/notes/${noteId}`, getToken)
  if (!res.ok) throw new Error('Failed to fetch note')
  return res.json()
}

export async function createNote(
  getToken: GetToken,
  notebookId: string,
  data: CreateNoteRequest,
): Promise<Note> {
  const res = await apiFetch(`/notebooks/${notebookId}/notes`, getToken, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create note')
  return res.json()
}

export async function updateNote(
  getToken: GetToken,
  noteId: string,
  data: UpdateNoteRequest,
): Promise<Note> {
  const res = await apiFetch(`/notes/${noteId}`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update note')
  return res.json()
}

export async function deleteNote(getToken: GetToken, noteId: string): Promise<void> {
  const res = await apiFetch(`/notes/${noteId}`, getToken, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete note')
}

export async function ocrSearch(
  getToken: GetToken,
  noteId: string,
  query: string,
): Promise<OcrSearchResult[]> {
  const res = await apiFetch(
    `/notes/${noteId}/ocr-search?q=${encodeURIComponent(query)}`,
    getToken,
  )
  if (!res.ok) throw new Error('Failed to search OCR results')
  return res.json()
}

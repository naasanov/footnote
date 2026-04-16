import { env } from '@/config/env'

type GetToken = () => Promise<string | null>

export async function apiFetch(
  path: string,
  getToken: GetToken,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken()

  const headers = new Headers(init?.headers)
  const hasBody = init?.body !== undefined && init?.body !== null
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData

  // Only set JSON content type when there's a non-FormData body.
  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers,
  })
}

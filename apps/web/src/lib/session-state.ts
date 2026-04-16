'use client'

const LAST_SELECTED_NOTE_KEY = 'footnote:last-selected-note'
const EXPANDED_NOTEBOOK_IDS_KEY = 'footnote:expanded-notebook-ids'
const APP_SHELL_LAYOUT_KEY = 'footnote:app-shell-layout'

interface LastSelectedNote {
  notebookId: string
  noteId: string
}

export interface AppShellLayoutState {
  leftWidth: number
  rightWidth: number
  leftTopRatio: number
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null

  const rawValue = window.localStorage.getItem(key)
  if (!rawValue) return null

  try {
    return JSON.parse(rawValue) as T
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function readLastSelectedNote(): LastSelectedNote | null {
  const value = readJson<LastSelectedNote>(LAST_SELECTED_NOTE_KEY)

  if (!value?.notebookId || !value?.noteId) {
    return null
  }

  return value
}

export function persistLastSelectedNote(value: LastSelectedNote) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_SELECTED_NOTE_KEY, JSON.stringify(value))
}

export function clearLastSelectedNote() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LAST_SELECTED_NOTE_KEY)
}

export function readExpandedNotebookIds(): string[] {
  const value = readJson<string[]>(EXPANDED_NOTEBOOK_IDS_KEY)

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((id): id is string => typeof id === 'string')
}

export function persistExpandedNotebookIds(notebookIds: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(EXPANDED_NOTEBOOK_IDS_KEY, JSON.stringify(notebookIds))
}

export function readAppShellLayoutState(): AppShellLayoutState | null {
  const value = readJson<Partial<AppShellLayoutState>>(APP_SHELL_LAYOUT_KEY)

  if (
    typeof value?.leftWidth !== 'number' ||
    typeof value?.rightWidth !== 'number' ||
    typeof value?.leftTopRatio !== 'number'
  ) {
    return null
  }

  return {
    leftWidth: value.leftWidth,
    rightWidth: value.rightWidth,
    leftTopRatio: value.leftTopRatio,
  }
}

export function persistAppShellLayoutState(value: AppShellLayoutState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(APP_SHELL_LAYOUT_KEY, JSON.stringify(value))
}

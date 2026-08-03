// Macro sectioning is adapted from BestCraft's MacroExporter.
// Copyright (C) 2025 Tnze
// Copyright (C) 2026 FF14_Moon contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { presentAction } from './actions'
import type { CraftAction } from '../solver/types'

const MAX_MACRO_LINES = 15

export interface MacroOptions {
  includeMacroLock?: boolean
  includeCompletionNotice?: boolean
  completionSound?: number
}

export interface MacroSection {
  index: number
  lines: string[]
  text: string
  actionCount: number
  estimatedSeconds: number
}

export interface FormattedMacro {
  sections: MacroSection[]
  totalSteps: number
  estimatedSeconds: number
}

export function formatMacro(
  actions: CraftAction[],
  options: MacroOptions = {},
): FormattedMacro {
  const includeMacroLock = options.includeMacroLock ?? false
  const includeCompletionNotice = options.includeCompletionNotice ?? true
  const completionSound = options.completionSound ?? 1
  if (!Number.isInteger(completionSound) || completionSound < 1 || completionSound > 16) {
    throw new Error('完成通知音效必須介於 1 到 16。')
  }
  const reservedLines = Number(includeMacroLock) + Number(includeCompletionNotice)
  const actionCapacity = MAX_MACRO_LINES - reservedLines

  if (actionCapacity < 1) {
    throw new Error('巨集控制行占用了全部 15 行。')
  }

  const sections: MacroSection[] = []
  for (let start = 0; start < actions.length; start += actionCapacity) {
    const sectionActions = actions.slice(start, start + actionCapacity)
    const lines: string[] = []
    if (includeMacroLock) lines.push('/mlock')

    let estimatedSeconds = 0
    for (const action of sectionActions) {
      const presentation = presentAction(action)
      estimatedSeconds += presentation.waitSeconds
      lines.push(`/ac ${presentation.name} <wait.${presentation.waitSeconds}>`)
    }

    const index = sections.length + 1
    if (includeCompletionNotice) {
      lines.push(`/echo 巨集 #${index} 已完成！ <se.${completionSound}>`)
    }
    sections.push({
      index,
      lines,
      text: lines.join('\r\n'),
      actionCount: sectionActions.length,
      estimatedSeconds,
    })
  }

  return {
    sections,
    totalSteps: actions.length,
    estimatedSeconds: sections.reduce((total, section) => total + section.estimatedSeconds, 0),
  }
}

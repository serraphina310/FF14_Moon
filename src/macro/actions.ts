// Names and timing values are adapted from BestCraft zh-TW.
// Copyright (C) 2024-2025 Tnze and BestCraft contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CraftAction } from '../solver/types'

export interface ActionPresentation {
  name: string
  waitSeconds: 2 | 3
}

const TWO_SECOND_ACTIONS = new Set<CraftAction>([
  'waste_not',
  'veneration',
  'great_strides',
  'innovation',
  'final_appraisal',
  'waste_not_ii',
  'manipulation',
])

export const ZH_TW_ACTION_NAMES: Readonly<Record<CraftAction, string>> = {
  basic_synthesis: '製作',
  basic_touch: '加工',
  masters_mend: '精修',
  hasty_touch: '倉促',
  rapid_synthesis: '高速製作',
  observe: '觀察',
  tricks_of_the_trade: '秘訣',
  waste_not: '儉約',
  veneration: '崇敬',
  standard_touch: '中級加工',
  great_strides: '闊步',
  innovation: '改革',
  final_appraisal: '最終確認',
  waste_not_ii: '長期儉約',
  byregot_s_blessing: '比爾格的祝福',
  precise_touch: '集中加工',
  muscle_memory: '堅信',
  careful_synthesis: '模範製作',
  manipulation: '掌握',
  prudent_touch: '儉約加工',
  advanced_touch: '上級加工',
  reflect: '閒靜',
  preparatory_touch: '坯料加工',
  groundwork: '坯料製作',
  delicate_synthesis: '精密製作',
  intensive_synthesis: '集中製作',
  trained_eye: '工匠的神速技巧',
  prudent_synthesis: '儉約製作',
  trained_finesse: '工匠的神技',
  careful_observation: '設計變動',
  heart_and_soul: '專心致志',
  refined_touch: '精煉加工',
  daring_touch: '冒進',
  quick_innovation: '快速改革',
  immaculate_mend: '巧奪天工',
  trained_perfection: '工匠的絕技',
}

export function presentAction(action: CraftAction): ActionPresentation {
  return {
    name: ZH_TW_ACTION_NAMES[action],
    waitSeconds: TWO_SECOND_ACTIONS.has(action) ? 2 : 3,
  }
}

export const WORKBENCH_SCHEMA_VERSION = 3 as const
export const APP_VERSION = '0.0.0'
export const DATA_VERSION = 'zh-tw-7.2-2026.07.22.0000.0000.2'
export const SOLVER_VERSION = 'raphael-v0.25.3-9ec209b4'

export interface VersionSnapshot {
  app: string
  data: string
  solver: string
}

export function currentVersions(): VersionSnapshot {
  return {
    app: APP_VERSION,
    data: DATA_VERSION,
    solver: SOLVER_VERSION,
  }
}

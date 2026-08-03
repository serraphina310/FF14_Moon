import { defineStore } from 'pinia'
import type { CraftJob } from '../data/recipes'
import {
  createEmptyWorkbench,
  createProfile,
  removeSavedRecipe,
  saveRecipe,
  setActiveProfile,
  setSavedRecipeLevel,
  updateProfile,
  type AttributeProfileInput,
  type SolutionSnapshot,
  type WorkbenchState,
} from '../domain/workbench'
import {
  clearWorkbench,
  loadWorkbench,
  saveWorkbench,
  type StorageError,
} from '../domain/persistence'
import type { SolverFailure } from '../solver/types'
import { adoptSolution, recordSolveFailure } from '../domain/workbench'

interface WorkbenchStoreState {
  document: WorkbenchState
  hydrated: boolean
  storageWriteBlocked: boolean
  storageError?: StorageError
  selectedJob: CraftJob
  selectedRecipeId?: number
}

export const useWorkbenchStore = defineStore('workbench', {
  state: (): WorkbenchStoreState => ({
    document: createEmptyWorkbench(new Date(0).toISOString()),
    hydrated: false,
    storageWriteBlocked: false,
    selectedJob: 'carpenter',
  }),

  actions: {
    hydrate(): void {
      const result = loadWorkbench(window.localStorage, new Date().toISOString())
      if (result.ok) {
        this.document = result.state
        this.storageError = undefined
        this.storageWriteBlocked = false
      } else {
        this.document = result.fallback
        this.storageError = result.error
        this.storageWriteBlocked = ['corrupt', 'unsupported_schema'].includes(result.error.code)
      }
      this.hydrated = true
    },

    selectJob(job: CraftJob): void {
      this.selectedJob = job
      this.selectedRecipeId = this.document.jobs[job].recipes[0]?.recipeId
    },

    openRecipe(recipeId: number, initialLevel: number): void {
      saveRecipe(this.document, this.selectedJob, recipeId, initialLevel, new Date().toISOString())
      this.selectedRecipeId = recipeId
      this.persist()
    },

    viewRecipe(recipeId: number): void {
      const record = this.document.jobs[this.selectedJob].recipes.find(
        (candidate) => candidate.recipeId === recipeId,
      )
      if (record === undefined) return
      this.openRecipe(recipeId, record.currentLevel)
    },

    changeRecipeLevel(recipeId: number, level: number): void {
      const record = this.document.jobs[this.selectedJob].recipes.find(
        (candidate) => candidate.recipeId === recipeId,
      )
      if (record === undefined) throw new Error('找不到要修改的配方紀錄。')
      setSavedRecipeLevel(record, level, new Date().toISOString())
      this.persist()
    },

    removeRecipe(recipeId: number): void {
      removeSavedRecipe(
        this.document,
        this.selectedJob,
        recipeId,
        new Date().toISOString(),
      )
      if (this.selectedRecipeId === recipeId) {
        this.selectedRecipeId = this.document.jobs[this.selectedJob].recipes[0]?.recipeId
      }
      this.persist()
    },

    addProfile(input: AttributeProfileInput): string {
      const id = crypto.randomUUID()
      createProfile(this.document, this.selectedJob, input, id, new Date().toISOString())
      setActiveProfile(this.document, this.selectedJob, id, new Date().toISOString())
      this.persist()
      return id
    },

    editProfile(profileId: string, input: AttributeProfileInput): void {
      updateProfile(
        this.document,
        this.selectedJob,
        profileId,
        input,
        new Date().toISOString(),
      )
      this.persist()
    },

    activateProfile(profileId: string): void {
      setActiveProfile(
        this.document,
        this.selectedJob,
        profileId,
        new Date().toISOString(),
      )
      this.persist()
    },

    adopt(recipeId: number, solution: SolutionSnapshot): void {
      const record = this.requireRecipe(recipeId)
      adoptSolution(record, solution)
      this.persist()
    },

    recordFailure(recipeId: number, error: SolverFailure): void {
      recordSolveFailure(this.requireRecipe(recipeId), error, new Date().toISOString())
      this.persist()
    },

    clearAll(): void {
      const result = clearWorkbench(window.localStorage)
      if (!result.ok) {
        this.storageError = result.error
        return
      }
      this.document = createEmptyWorkbench(new Date().toISOString())
      this.selectedRecipeId = undefined
      this.storageError = undefined
      this.storageWriteBlocked = false
    },

    persist(): void {
      if (this.storageWriteBlocked) return
      const result = saveWorkbench(window.localStorage, this.document)
      this.storageError = result.ok ? undefined : result.error
    },

    requireRecipe(recipeId: number) {
      const record = this.document.jobs[this.selectedJob].recipes.find(
        (candidate) => candidate.recipeId === recipeId,
      )
      if (record === undefined) throw new Error('找不到配方紀錄。')
      return record
    },
  },
})

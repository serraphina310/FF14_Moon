import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function githubPagesBase(): string {
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
  return repository ? `/${repository}/` : '/'
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? githubPagesBase(),
  plugins: [vue()],
})

import initWasm, { toolchain_probe } from '../pkg-wasm/ff14_moon_wasm.js'

export async function loadWasmProbe(): Promise<string> {
  await initWasm()
  return toolchain_probe()
}

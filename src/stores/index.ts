import { createPinia } from 'pinia'

export const pinia = createPinia()

export { useFixedBackgroundStore, FIXED_BACKGROUND_DEFAULTS } from './backgroundStore'

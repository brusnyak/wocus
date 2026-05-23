import { getSetting, setSetting } from './db.js'

const SETTINGS_KEYS = {
  provider: 'provider',
  apiEndpoint: 'apiEndpoint',
  apiKey: 'apiKey',
  modelName: 'modelName',
  darkMode: 'darkMode',
  aiEnabled: 'aiEnabled'
}

export const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['openrouter/auto', 'mistralai/mistral-7b-instruct:free', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'meta-llama/llama-3.2-3b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'anthropic/claude-sonnet-20241022', 'deepseek/deepseek-v3-base:free']
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  ollama: {
    label: 'Ollama (Local)',
    endpoint: 'http://localhost:11434/api/generate',
    models: ['llama3', 'mistral', 'codellama', 'mixtral', 'phi']
  },
  custom: {
    label: 'Custom',
    endpoint: '',
    models: []
  }
}

const defaults = {
  provider: 'openrouter',
  apiEndpoint: PROVIDERS.openrouter.endpoint,
  apiKey: '',
  modelName: 'openrouter/auto',
  darkMode: false,
  aiEnabled: true
}

let loaded = $state(false)
let provider = $state(defaults.provider)
let apiEndpoint = $state(defaults.apiEndpoint)
let apiKey = $state('')
let modelName = $state(defaults.modelName)
let darkMode = $state(false)
let aiEnabled = $state(true)

export function getSettings() {
  return {
    get loaded() { return loaded },
    get provider() { return provider },
    set provider(v) { provider = v },
    get apiEndpoint() { return apiEndpoint },
    set apiEndpoint(v) { apiEndpoint = v },
    get apiKey() { return apiKey },
    set apiKey(v) { apiKey = v },
    get modelName() { return modelName },
    set modelName(v) { modelName = v },
    get darkMode() { return darkMode },
    set darkMode(v) { darkMode = v },
    get aiEnabled() { return aiEnabled },
    set aiEnabled(v) { aiEnabled = v },
    isOllama() {
      return provider === 'ollama' || apiEndpoint.includes('localhost') || apiEndpoint.includes('0.0.0.0')
    },
    resolveProviderFromEndpoint() {
      if (apiEndpoint.includes('openrouter')) return 'openrouter'
      if (apiEndpoint.includes('openai.com')) return 'openai'
      if (apiEndpoint.includes('localhost') || apiEndpoint.includes('0.0.0.0')) return 'ollama'
      return 'custom'
    },
    async load() {
      provider = await getSetting(SETTINGS_KEYS.provider) || defaults.provider
      apiEndpoint = await getSetting(SETTINGS_KEYS.apiEndpoint) || defaults.apiEndpoint
      apiKey = await getSetting(SETTINGS_KEYS.apiKey) || ''
      modelName = await getSetting(SETTINGS_KEYS.modelName) || defaults.modelName
      darkMode = await getSetting(SETTINGS_KEYS.darkMode) ?? false
      aiEnabled = await getSetting(SETTINGS_KEYS.aiEnabled) ?? true
      // auto-detect provider from endpoint if not explicitly set
      if (!await getSetting(SETTINGS_KEYS.provider)) {
        provider = this.resolveProviderFromEndpoint()
      }
      loaded = true
    },
    async save() {
      await setSetting(SETTINGS_KEYS.provider, provider)
      await setSetting(SETTINGS_KEYS.apiEndpoint, apiEndpoint)
      await setSetting(SETTINGS_KEYS.apiKey, apiKey)
      await setSetting(SETTINGS_KEYS.modelName, modelName)
      await setSetting(SETTINGS_KEYS.darkMode, darkMode)
      await setSetting(SETTINGS_KEYS.aiEnabled, aiEnabled)
    },
    hasApiKey() {
      return apiKey && apiKey.length > 0
    }
  }
}

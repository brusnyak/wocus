const BASE_PROMPT = `You are a text organization assistant. Analyze the provided text and return a structured version.

Rules:
1. Identify distinct topics and group related paragraphs
2. Create a hierarchical structure with H1/H2 headers — use H1 for main topics, H2 for subtopics
3. Use toggles for collapsible sections containing supporting details
4. Insert dividers between every major topic to create clear sections — each divider signals a new topic group
5. Convert action items to todo checkboxes
6. Fix grammar and flow while preserving meaning
7. Return ONLY valid JSON — no markdown fences, no explanation`

const LINK_PROMPT = `
8. For any URLs found in the text, analyze the link context and provide a brief mini-summary of what the linked content is about based on the surrounding text
9. If a URL appears, replace it with a markdown-style link [description](url) where description is a short contextual summary`

const TAGGING_PROMPT = `
10. After analyzing the content, suggest 3-5 relevant tags that describe the main topics
11. Add a "tags" field at the end of the response JSON with an array of tag strings`

const BASE_FORMAT = `
Response format:
{
  "blocks": [
    { "type": "heading", "level": 1, "content": "..." },
    { "type": "text", "content": "..." },
    { "type": "divider" },
    { "type": "heading", "level": 2, "content": "..." },
    { "type": "toggle", "content": "...", "children": [{ "type": "text", "content": "..." }] },
    { "type": "divider" },
    { "type": "heading", "level": 1, "content": "..." },
    { "type": "todo", "content": "...", "checked": false },
    { "type": "divider" }
  ],
  "tags": ["tag1", "tag2", "tag3"]
}`

function buildPrompt(text, linkAnalysis, enableTagging) {
  let prompt = BASE_PROMPT
  if (linkAnalysis) prompt += LINK_PROMPT
  if (enableTagging) prompt += TAGGING_PROMPT
  prompt += BASE_FORMAT
  return prompt
}

export function extractJsonFromResponse(text) {
  let cleaned = text.trim()
  const jsonMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim()
  }
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    const braceStart = cleaned.indexOf('{')
    const braceEnd = cleaned.lastIndexOf('}')
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      const jsonText = cleaned.slice(braceStart, braceEnd + 1)
      try {
        return JSON.parse(jsonText)
      } catch (e2) {
        for (let i = 0; i < jsonText.length; i++) {
          for (let j = jsonText.length; j > i; j--) {
            const substring = jsonText.substring(i, j)
            try {
              return JSON.parse(substring)
            } catch {}
          }
        }
      }
    }
    throw new Error('AI returned invalid JSON')
  }
}

export async function organizeWithAI(text, settings) {
  const { apiEndpoint, apiKey, modelName } = settings
  const linkAnalysis = settings.linkAnalysis !== false
  const enableTagging = settings.enableTagging !== false

  if (!apiKey) {
    throw new Error('No API key configured. Add one in Settings.')
  }

  const SYSTEM_PROMPT = buildPrompt(text, linkAnalysis, enableTagging)

  const isOllama = apiEndpoint.includes('localhost') || apiEndpoint.includes('0.0.0.0')
  const body = isOllama
    ? { model: modelName, prompt: `${SYSTEM_PROMPT}\n\nText:\n${text}`, stream: false }
    : {
        model: modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ]
      }

  const headers = {
    'Content-Type': 'application/json',
    ...(isOllama ? {} : { 'Authorization': `Bearer ${apiKey}` })
  }

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error')
    throw new Error(`API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const rawText = isOllama ? data.response : data.choices?.[0]?.message?.content

  if (!rawText) {
    throw new Error('Empty AI response')
  }

  return extractJsonFromResponse(rawText)
}

export async function transcribeAudio(blob, apiEndpoint, apiKey) {
  let audioEndpoint
  if (apiEndpoint.includes('openrouter')) {
    audioEndpoint = 'https://openrouter.ai/api/v1/audio/transcriptions'
  } else if (apiEndpoint.includes('openai.com')) {
    audioEndpoint = 'https://api.openai.com/v1/audio/transcriptions'
  } else {
    throw new Error('Audio transcription requires OpenAI or OpenRouter')
  }

  const formData = new FormData()
  formData.append('file', blob, 'recording.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'en')

  const response = await fetch(audioEndpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown')
    throw new Error(`Transcription error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return data.text
}

export function detectSensitiveData(text) {
  if (!text) return null
  const patterns = [
    { regex: /sk-[A-Za-z0-9]{20,}/g, label: 'API key (OpenAI/Anthropic format)' },
    { regex: /(?:api[_-]?key|apikey|api[_-]?secret|api[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}/gi, label: 'API credential' },
    { regex: /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, label: 'JWT token' },
    { regex: /AKIA[A-Z0-9]{16}/g, label: 'AWS access key' },
    { regex: /-----BEGIN (?:RSA |EC |)?PRIVATE KEY-----/g, label: 'private key' },
    { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, label: 'long numeric sequence (credit card?)' },
  ]
  const findings = []
  for (const { regex, label } of patterns) {
    if (regex.test(text)) findings.push(label)
  }
  return findings.length > 0 ? findings : null
}
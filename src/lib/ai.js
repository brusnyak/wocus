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
  ]
}`

function buildPrompt(text, linkAnalysis) {
  let prompt = BASE_PROMPT
  if (linkAnalysis) prompt += LINK_PROMPT
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

  if (!apiKey) {
    throw new Error('No API key configured. Add one in Settings.')
  }

  const SYSTEM_PROMPT = buildPrompt(text, linkAnalysis)

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
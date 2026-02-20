import type { GroupMessage, ParsedOffer } from '@hawala/shared';
import { EXTRACT_OFFERS_SYSTEM_PROMPT } from './prompts';

export interface LlmClientConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class LlmClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LlmClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'openai/gpt-4o-mini';
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
  }

  async parseExchangeOffers(messages: GroupMessage[]): Promise<ParsedOffer[]> {
    const userContent = messages
      .map((m, i) => `[${i}] ${m.text}`)
      .join('\n');

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: EXTRACT_OFFERS_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const parsed = JSON.parse(content) as { offers: ParsedOffer[] };
    return parsed.offers;
  }
}

import { CURRENCIES, PAYMENT_METHOD_GROUPS, getDefaultPaymentMethods, type Currency, type GroupMessage, type ParsedOffer, type ParsedPaymentMethodGroup, type PaymentMethodGroup } from '@hawala/shared';
import { ANALYZE_OFFER_EDIT_PROMPT, EXTRACT_OFFERS_SYSTEM_PROMPT } from './prompts';

const ALLOWED_CURRENCIES = new Set<string>(CURRENCIES);
const ALLOWED_PAYMENT_METHODS = new Set<string>(PAYMENT_METHOD_GROUPS);

export interface LlmClientConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface OfferEditAction {
  action: 'delete' | 'update' | 'no_change';
  updates?: {
    amount?: number;
    amountCurrency?: string;
    fromCurrency?: string;
    toCurrency?: string;
    partial?: boolean;
    partialThreshold?: number;
    takePaymentMethods?: ParsedPaymentMethodGroup[];
    givePaymentMethods?: ParsedPaymentMethodGroup[];
  };
}

export class LlmClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LlmClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'openai/gpt-5-nano';
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
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
      id?: string;
    };

    console.log('[LLM] Response full:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    console.log('[LLM] Content:', content);

    const parsed = JSON.parse(content) as { offers?: unknown };
    if (!Array.isArray(parsed.offers)) {
      return [];
    }

    const normalizedOffers: ParsedOffer[] = [];
    for (const rawOffer of parsed.offers) {
      const normalized = normalizeOffer(rawOffer);
      if (!normalized) continue;
      normalizedOffers.push(normalized);
    }

    console.log('[LLM] Parsed raw offers:', JSON.stringify(parsed.offers, null, 2));
    console.log('[LLM] Normalized offers:', JSON.stringify(normalizedOffers, null, 2));

    return normalizedOffers;
  }

  async analyzeOfferEdit(oldText: string, newText: string, model?: string): Promise<OfferEditAction> {
    const userContent = `ORIGINAL MESSAGE:\n${oldText}\n\nEDITED MESSAGE:\n${newText}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || this.model,
        messages: [
          { role: 'system', content: ANALYZE_OFFER_EDIT_PROMPT },
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
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM for offer edit analysis');
    }

    console.log('[LLM] Edit analysis content:', content);

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const action = parsed.action;

    if (action === 'delete') {
      return { action: 'delete' };
    }

    if (action === 'update' && parsed.updates && typeof parsed.updates === 'object') {
      const raw = parsed.updates as Record<string, unknown>;
      const updates: OfferEditAction['updates'] = {};

      if (typeof raw.amount === 'number') updates.amount = raw.amount;
      if (isCurrency(raw.amount_currency)) updates.amountCurrency = raw.amount_currency;
      if (isCurrency(raw.from_currency)) updates.fromCurrency = raw.from_currency;
      if (isCurrency(raw.to_currency)) updates.toCurrency = raw.to_currency;
      if (typeof raw.partial === 'boolean') updates.partial = raw.partial;
      if (typeof raw.partial_threshold === 'number') updates.partialThreshold = raw.partial_threshold;
      if (Array.isArray(raw.take_payment_methods)) {
        updates.takePaymentMethods = normalizeMethodGroups(raw.take_payment_methods);
      }
      if (Array.isArray(raw.give_payment_methods)) {
        updates.givePaymentMethods = normalizeMethodGroups(raw.give_payment_methods);
      }

      return { action: 'update', updates };
    }

    return { action: 'no_change' };
  }
}

function normalizeOffer(rawOffer: unknown): ParsedOffer | null {
  if (!rawOffer || typeof rawOffer !== 'object') {
    return null;
  }

  const raw = rawOffer as Record<string, unknown>;
  const messageIndexValue = raw.messageIndex ?? raw.message_index;
  const isExchangeOfferValue = raw.isExchangeOffer ?? raw.is_exchange_offer;
  const amountValue = raw.amount;
  const amountCurrencyValue = raw.amountCurrency ?? raw.amount_currency;
  const takeValue = raw.takePaymentMethods ?? raw.take_payment_methods;
  const giveValue = raw.givePaymentMethods ?? raw.give_payment_methods;
  const partialValue = raw.partial;
  const partialThresholdValue = raw.partialThreshold ?? raw.partial_threshold;

  if (typeof messageIndexValue !== 'number' || !Number.isInteger(messageIndexValue)) {
    return null;
  }

  return {
    messageIndex: messageIndexValue,
    isExchangeOffer: Boolean(isExchangeOfferValue),
    amount: typeof amountValue === 'number' ? amountValue : null,
    amountCurrency: isCurrency(amountCurrencyValue) ? amountCurrencyValue : null,
    takePaymentMethods: normalizeMethodGroups(takeValue),
    givePaymentMethods: normalizeMethodGroups(giveValue),
    partial: Boolean(partialValue),
    partialThreshold: typeof partialThresholdValue === 'number' ? partialThresholdValue : 0,
  };
}

function normalizeMethodGroups(value: unknown): ParsedPaymentMethodGroup[] {
  if (!Array.isArray(value)) return [];

  const result: ParsedPaymentMethodGroup[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const group = item as Record<string, unknown>;

    if (!isCurrency(group.currency)) continue;

    const validForCurrency = new Set<string>(getDefaultPaymentMethods(group.currency));
    const methods = Array.isArray(group.methods)
      ? group.methods.filter(
          (m): m is PaymentMethodGroup =>
            typeof m === 'string' && ALLOWED_PAYMENT_METHODS.has(m) && validForCurrency.has(m),
        )
      : [];

    result.push({
      currency: group.currency,
      methods: methods.length > 0 ? methods : getDefaultPaymentMethods(group.currency),
    });
  }
  return result;
}

function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && ALLOWED_CURRENCIES.has(value);
}

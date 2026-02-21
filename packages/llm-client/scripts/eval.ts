import type { GroupMessage, ParsedOffer } from '@hawala/shared';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { LlmClient } from '../src/client';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: bun packages/llm-client/scripts/eval.ts <messages.txt>');
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set');
  process.exit(1);
}

const lines = readFileSync(inputPath, 'utf-8')
  .split('\n')
  .filter((l) => l.trim().length > 0);

console.log(`Loaded ${lines.length} messages from ${basename(inputPath)}\n`);

const messages: GroupMessage[] = lines.map((text, i) => ({
  index: i,
  text,
  authorTelegramId: 100000 + i,
  messageId: i + 1,
  chatId: -1001000000000,
}));

const client = new LlmClient({
  apiKey,
  model: process.env.OPENROUTER_MODEL,
});

console.log(`Model: ${process.env.OPENROUTER_MODEL || 'openai/gpt-5-nano'}`);
console.log('Sending to LLM...\n');

const offers = await client.parseExchangeOffers(messages);

// Build result with original text for easy visual inspection
type EvalResult = ParsedOffer & { originalText: string };

const results: EvalResult[] = messages.map((msg) => {
  const offer = offers.find((o) => o.messageIndex === msg.index);
  return {
    originalText: msg.text,
    messageIndex: msg.index,
    isExchangeOffer: offer?.isExchangeOffer ?? false,
    amount: offer?.amount ?? null,
    amountCurrency: offer?.amountCurrency ?? null,
    takePaymentMethods: offer?.takePaymentMethods ?? [],
    givePaymentMethods: offer?.givePaymentMethods ?? [],
    partial: offer?.partial ?? false,
    partialThreshold: offer?.partialThreshold ?? 0,
  };
});

// Pretty-print to console
const fmtGroup = (g: { currency: string; methods: string[] }) =>
  `${g.currency}[${g.methods.join(',')}]`;

for (const r of results) {
  const text =
    r.originalText.length > 80
      ? r.originalText.slice(0, 77) + '...'
      : r.originalText;

  if (r.isExchangeOffer) {
    const take = r.takePaymentMethods.map(fmtGroup).join(', ') || '-';
    const give = r.givePaymentMethods.map(fmtGroup).join(', ') || '-';
    console.log(`✓ "${text}"`);
    console.log(`  amount: ${r.amount ?? '?'} ${r.amountCurrency ?? ''}  partial: ${r.partial}`);
    console.log(`  take: ${take}`);
    console.log(`  give: ${give}`);
  } else {
    console.log(`✗ "${text}"`);
  }
  console.log();
}

// Write JSON output
const name = basename(inputPath, '.txt');
const outputPath = join(dirname(inputPath), `${name}.results.json`);
writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`Results written to ${outputPath}`);

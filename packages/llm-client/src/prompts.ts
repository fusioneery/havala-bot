
export const EXTRACT_OFFERS_SYSTEM_PROMPT = `
Perform structured parsing of a batch of informal exchange messages in Russian (with possible English or financial terms). For each message in the array:

- Read the message, describe your thought process and reasoning (in Russian) in detail before presenting the structured result. Be sure to explain how you decided what to assign to each parameter in the output model. Refer to specific parts of the message text.
- For each message, select one of the possible "exchange offers" (or requests) from it, filling in all the fields of the new target model:

### Output model for each offer:
- message_index: message number in the batch (starting from 0)
- is_exchange_offer: true if the message is an exchange offer or willingness to make a transaction; false if it is only searching for or requesting an exchange
- amount: the specified amount to be exchanged, or null if not specified
- amount_currency: a string with the currency code of this amount (for example, "EUR", "RUB"); empty string if not specified
- take_payment_methods: an array of PaymentMethodGroup groups (see below) describing ALL currencies/methods that the person wants to RECEIVE ("take"/"search").
- give_payment_methods: an array of PaymentMethodGroup groups describing ALL currencies/methods that the person is WILLING TO GIVE ("give"/"offer").
- partial: true if partial exchange is allowed (words such as "in parts" and similar are mentioned); otherwise false.
- partial_threshold: the minimum allowed amount for partial execution (0 if not specified).

#### PaymentMethodGroup (payment method group):
- currency: string — ISO currency code (e.g., "EUR", "RUB", "USDT")
- methods: array of strings — ONLY these 4 exact values are allowed:
  - "russian_banks" — any Russian bank transfer: СБП, Сбер, Тинькофф, Т-Банк, Альфа, ВТБ, перевод на русскую карту, и т.д.
  - "local_banks" — local CIS/regional bank transfers (NOT Russian): Araratbank, HalykBank, Kaspi, BoG, TBC, Credo, Jusan, и т.д.
  - "swift" — any international transfer method: SWIFT, SEPA, Revolut, Wise, IBAN, BLIK, PayPal, и т.д.
  - "crypto" — any cryptocurrency: on-chain transfer, Binance, Bybit, P2P crypto, и т.д.
  Do NOT use any other method names — always map to one of the 4 categories above.

There can be several exchange scenarios within a single message, but each line from the batch requires a single final "offer" object with the most complete interpretation, automatically combining the take/give method options as arrays.

General rule: 
- First, provide reasoning (in Russian, for each message, in a separate paragraph), and only then the final JSON frame of the entire batch in a single object.
- In the reasoning, indicate why certain currencies/methods were chosen, how the amount was interpreted; if there is no value, explain why.

# Steps

1. Get an array of messages as input (strings in index order).
2. For each message from the input:
- Analyze the text, explain the logic (reasoning), referring to all identified fields.
- Create an offer object according to the output model structure, filling in all possible fields. If no value is found, specify null, 0, an empty string, or false, as described in the model.
- Determine is_exchange_offer: if the message explicitly contains an offer to make an exchange, set true; if it only searches for a transaction option/requests, set false.

 - Correctly analyze possible groups of methods and currencies (PaymentMethodGroup), add ALL possible options from the message (for example, if they want euros on Revolut and zlotys on BLIK at the same time — both as separate PaymentMethodGroups).
    - If partial exchange is explicitly allowed, partial=true (according to the words/context).
3. After reasoning on all messages, output the final JSON: {"offers":[...]} with the result for each message, message_index corresponds to the index of the original message.

# Examples

**Input:**
[
  "#ищу евро на револют или злотые blik\n#предлагаю 24901 рублей по сбп курс гугла",
  "#ищу 500 евро на револют/ИБАН. Можно по частям\n#предлагаю рубли по курсу Гугла через сбп/на тбанк"
]

**Output:**
Reasoning:
0: Сообщение содержит две части. "#ищу евро на револют или злотые blik" — человек хочет получить (take) евро на Revolut или злотые через BLIK. Revolut и BLIK — международные методы, значит methods=["swift"]. Это два варианта — EUR и PLN — значит две отдельные PaymentMethodGroup в take. "#предлагаю 24901 рублей по сбп курс гугла" — готов отдать (give) 24901 рублей по СБП. СБП — российский банк, methods=["russian_banks"]. Сумма 24901, валюта RUB. Человек одновременно ищет и предлагает — значит is_exchange_offer=true.
1: "#ищу 500 евро на револют/ИБАН" — хочет получить (take) 500 евро через Revolut или IBAN. Оба метода международные — methods=["swift"]. "Можно по частям" — partial=true. "#предлагаю рубли по курсу Гугла через сбп/на тбанк" — готов отдать (give) рубли через СБП или Т-Банк. Оба — российские банки, methods=["russian_banks"]. Сумма явно указана как 500 EUR (в части "ищу"). Человек и ищет, и предлагает — is_exchange_offer=true.

{
  "offers": [
    {
      "message_index": 0,
      "is_exchange_offer": true,
      "amount": 24901,
      "amount_currency": "RUB",
      "take_payment_methods": [
        {"currency":"EUR", "methods":["swift"]},
        {"currency":"PLN", "methods":["swift"]}
      ],
      "give_payment_methods": [
        {"currency":"RUB", "methods":["russian_banks"]}
      ],
      "partial": false,
      "partial_threshold": 0
    },
    {
      "message_index": 1,
      "is_exchange_offer": true,
      "amount": 500,
      "amount_currency": "EUR",
      "take_payment_methods": [
        {"currency":"EUR", "methods":["swift"]}
      ],
      "give_payment_methods": [
        {"currency":"RUB", "methods":["russian_banks"]}
      ],
      "partial": true,
      "partial_threshold": 0
    }
  ]
}

(Note: A single message often contains both "ищу" (take) and "предлагаю" (give) parts — always combine them into one offer object. If only one side is present, leave the other payment_methods array empty.)

# Notes

- Always reasoning first, then the final overall JSON.
- Don't forget message_index!
- Break down currency/method options so that all groups are covered by PaymentMethodGroup.
- If a single message contains both "looking for" and "giving" options, distribute them between take_payment_methods and give_payment_methods, respectively.
- amount — only explicitly/unambiguously specified amounts.
- is_exchange_offer: true if the person is offering something to others and is clearly ready to exchange; false if they are only looking for an option/expressing a request.
- CRITICAL: methods in PaymentMethodGroup must ONLY contain values from ["russian_banks", "local_banks", "swift", "crypto"]. Never use specific bank or service names as method values.

---
(Remember: Your task is to analyze each message in the batch, first explaining the logic (in Russian), then combining the results into a single JSON with offers according to the new scheme. Finish processing only after parsing each message.)
`;

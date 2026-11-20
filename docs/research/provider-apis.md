Research for wayfinder ticket #239, 2026-11-20.

# What Anthropic's, OpenAI's and Google's APIs allow an app with no server

**Question.** The Math assistant calls one provider's API directly, with the user's
own key and no server of ours, from the web app (a static page in Chrome or Edge)
and from the Obsidian plugin (desktop now, phone and tablet later). What do
Anthropic's, OpenAI's and Google's (Gemini API) allow, cost and keep? This note
reports facts against the ticket's nine items. It does not choose a provider.

**How to read the sources.** Every link is to the provider's own documentation,
terms, help centre or SDK repository, and every page was read on **2026-11-20**.
Nothing here is from memory. Three labels are used:

- **Verified** (the default, unmarked): the linked page says it.
- **Observed**: run from this repo's research session on 2026-11-20 with `curl`
  against the live API host, always with an **invalid key**, sending an `Origin`
  header as a browser would. It shows the CORS headers a browser would see. It
  does not show a successful, paid request: no valid key was available.
- **Inferred**: my reading of verified or observed facts. Always marked.

Where the documentation lives today:

- Anthropic: `platform.claude.com/docs` (each page also as `.md`), the privacy
  centre `privacy.claude.com`, the help centre `support.claude.com`, and
  `anthropics/anthropic-sdk-typescript` at `3edf5eb`.
- OpenAI: `developers.openai.com/api/docs` (`platform.openai.com/docs` redirects
  there), `help.openai.com`, `openai.com/policies`, and `openai/openai-node` at
  `2442a0c`.
- Google: `aistudio.google.com/docs` (`ai.google.dev/gemini-api/docs` redirects
  there), and `googleapis/js-genai` at `9a150ea`.

All three publish each documentation page as Markdown too, at the same address
with `.md` added. That form is the one that was read; the links below go to the
page itself.

Prices are in US dollars per million tokens (MTok) unless a line says otherwise.

## Answer

1. **All three answer a cross-origin call from a static page.** Only Anthropic
   documents it, and only Anthropic needs an opt-in: the request must carry
   `anthropic-dangerous-direct-browser-access: true`
   ([Browser-based applications](https://platform.claude.com/docs/en/manage-claude/authentication#browser-based-applications)).
   OpenAI and Google answered the preflight and sent CORS headers with no special
   header (**observed**). **Inferred:** none of the three is ruled out for a
   browser call.
2. **Two things can still make a browser call fail for a given user.**
   - Anthropic refuses every browser request from an organization with zero data
     retention or the Compliance API, with a 401, and no setting changes that.
   - OpenAI's answer to an **invalid key** carried no `Access-Control-Allow-Origin`
     (**observed**), so a page can't read that 401: a wrong key looks like a
     network failure. Anthropic and Google sent readable errors.
3. **All three tell developers not to put a key in browser code,** and none of the
   pages read speaks about a user typing their own key into an app. All three
   sets of terms are written for businesses and developers (wording in item 7).
4. **All three take PDFs as they are, as page pictures plus extracted text,** and
   take PNG, JPEG, WebP and GIF (Google: no GIF, plus HEIC and HEIF). Caps: Anthropic
   600 pages and 128 MB per request; OpenAI 50 MB per file and per request, no page
   cap stated; Google 1,000 pages and 50 MB per PDF. **Inferred:** no provider is
   ruled out for PDFs.
5. **All three constrain an answer to a JSON Schema,** each with its own subset.
   OpenAI needs every field `required`; Anthropic caps optional fields at 24 and
   has no recursion; Google ignores length constraints without an error.
6. **Retention differs most on the free tier.** Paid: no training on content at any
   of the three by default. Kept: Anthropic within 30 days; OpenAI abuse logs up to
   30 days, and the Responses API stores each response 30 days unless the request
   says `store: false`; Google 55 days for abuse monitoring, and the Interactions
   API stores each interaction 55 days (paid) unless `store=false`. **Google's free
   tier uses content to improve its products and lets human reviewers read it.**
7. **A sheet-sized request costs from about a tenth of a cent to about 22 cents,**
   depending on the model (table in item 6). Every current text model has a context
   window of about 1M tokens, far above the request.
8. **Only Google lets a user start without paying,** and only on some models.
   Anthropic and OpenAI are prepaid (OpenAI's minimum is $5). All three list Brazil.
9. **How long a named model lasts:** Anthropic publishes a "not sooner than" date
   per model (the four current ones: September to November 2027) and at least 60
   days' notice. OpenAI gives at least 6 months' notice for generally available
   models. Google names no notice period for stable models, and has re-routed old
   model names to newer models rather than shutting them down.
10. **No SDK is needed.** Each API is one HTTPS `POST` with a JSON body, answered as
    server-sent events when `stream` is true. **Observed:** a minimal streaming call
    bundled with each official SDK, with the plugin's own esbuild settings, adds
    387 KB (Anthropic), 395 KB (OpenAI) or 450 KB (Google) to `main.js`. A
    hand-written `fetch` with an SSE reader was 1.2 KB. The budget's headroom at
    1.0.0 was about 170 KB.

## The three against the nine items

| # | Item | Anthropic (Claude API) | OpenAI | Google (Gemini API) |
| --- | --- | --- | --- | --- |
| 1 | Direct call from a browser page | Documented. Needs the header `anthropic-dangerous-direct-browser-access: true`. Refused (401) for organizations with zero data retention or the Compliance API. Docs: call from your back end. | Not documented in the pages read. **Observed:** preflight allowed, no opt-in header. An invalid key's 401 has no CORS header. Docs: never put a key in a browser. | Not documented in the pages read; the SDK README says "Browser: Supported, with an API key". **Observed:** preflight allowed, errors readable. Docs: never expose keys client-side in production. |
| 2 | Direct call from Obsidian (provider side only) | Same header as item 1 whenever the request has an `Origin`. **Observed:** `app://obsidian.md` is allowed. Streams as SSE with named events. | **Observed:** `Access-Control-Allow-Origin: *` on preflight. Streams as SSE with typed events. | **Observed:** echoes `app://obsidian.md` back as the allowed origin. Streams as SSE with named events. |
| 3 | Input: images and PDFs | JPEG, PNG, GIF, WebP. 10 MB per image, 8000×8000 px, 600 images per request. PDF as is: 600 pages, 128 MB request, no passwords. Each page is a picture plus its text. | PNG, JPEG, WebP, non-animated GIF. 1,500 images and 512 MB per request. PDF as is: 50 MB per file and per request, no page cap stated. Page pictures plus text. | PNG, JPEG, WebP, HEIC, HEIF. 3,600 images per request. PDF as is: 1,000 pages, 50 MB. Page pictures plus embedded text. |
| 4 | A fixed shape for an answer | `output_config.format` with a JSON Schema (stable); `strict: true` on tools. Constrained decoding. No recursion, 24 optional fields at most. | `text.format` of type `json_schema` with `strict: true`; strict function calling. All fields required, `additionalProperties: false`. Recursion allowed. | `response_format` with a JSON Schema. Constrained decoding. Length and count constraints are stripped silently. |
| 5 | What is kept | Deleted within 30 days. Not used for training by default. Flagged content up to 2 years. No free tier. | Abuse logs up to 30 days. Responses API stores responses 30 days unless `store: false`. Not used for training unless opted in. | Paid: 55 days for abuse monitoring, not used to improve products. Free: used to improve products, human reviewers may read it. Interactions stored 55 days (paid) or 1 day (free) unless `store=false`. |
| 6 | Price and limits | $0.002 to $0.22 per request (estimate, item 6). Context 1M. First standard tier: 4,000 requests a minute on the current models; new organizations may start lower. | $0.001 to $0.17 per request (estimate). Context 1,050,000. After $5 of credit: 5,000 requests a minute. | Free on some models, or $0.004 to $0.08 per request (estimate). Context 1,048,576. Per-model limits are shown only inside AI Studio. |
| 7 | Getting a key | Console account, prepaid credits, no free tier found. Brazil listed. | Platform account, prepaid credits from $5. A Free tier is listed, its limits are not. Brazil listed. | Google account, key created by AI Studio. Free tier with no payment on some models; some projects need a phone check. Paid: prepay from $5. Brazil listed. |
| 8 | Models and how long a name lasts | Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5. Each ID is a pinned snapshot. Retirement "not sooner than" Sept–Nov 2027; at least 60 days' notice. | GPT-6.2 Astra, GPT-6.2 Sol, GPT-6.1 Terra, GPT-6 Luna. At least 6 months' notice for generally available models. | Gemini 4 Carbon, Neon, Hydrogen, Argon; Gemini 3.5 Flash-Lite. No shutdown dates announced, no stated notice period for stable models; old names have been re-routed to newer models. |
| 9 | SDK or plain HTTP | Plain HTTP suffices. SDK `@anthropic-ai/sdk` 1.12.0: 387 KB bundled (**observed**). | Plain HTTP suffices. SDK `openai` 7.62.0: 395 KB bundled (**observed**). | Plain HTTP suffices. SDK `@google/genai` 3.6.1: 450 KB bundled (**observed**). |

## 1. A direct call from a browser page

### What was observed, for all three

Each test sent an `OPTIONS` preflight and then a `POST`, with
`Origin: https://example.github.io`, to the endpoint the assistant would call. The
keys were invalid on purpose.

| | Preflight | `POST` with an invalid key |
| --- | --- | --- |
| Anthropic `POST /v1/messages` | 200, `Access-Control-Allow-Origin: *`, the requested headers echoed back as allowed | With the opt-in header: 401, `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: *`. **Without it: 401 with no CORS header.** |
| OpenAI `POST /v1/responses` | 200, `Access-Control-Allow-Origin: *`, `authorization,content-type` allowed | **401 with no `Access-Control-Allow-Origin`.** The same request with no `Authorization` header at all got a 401 that did have `Access-Control-Allow-Origin: *`. |
| OpenAI `POST /v1/chat/completions` | 200, the origin echoed back | 401 with no `Access-Control-Allow-Origin` |
| Google `POST /v1/interactions` and `POST /v1beta/models/…:streamGenerateContent` | 200, the origin echoed back, `content-type,x-goog-api-key` allowed | 400 `API key not valid`, the origin echoed back |

A browser lets a page read a cross-origin response only when it carries
`Access-Control-Allow-Origin`. So, **inferred** from the table:

- A wrong Anthropic or Google key gives the page a readable error.
- A wrong OpenAI key gives the page a failed `fetch` with no status and no
  message. The app could not tell "wrong key" from "no network" by the response.
- Whether a **successful** OpenAI response carries the header was not observed.
  OpenAI's SDK has a browser mode (below), which suggests it does.

### Anthropic

- "A request sent directly from a browser is a cross-origin (CORS) request. The API
  accepts these requests only when they include the
  `anthropic-dangerous-direct-browser-access: true` header, which the TypeScript SDK
  sends when you set `dangerouslyAllowBrowser` to `true`."
  ([Browser-based applications](https://platform.claude.com/docs/en/manage-claude/authentication#browser-based-applications))
- The same section opens: "Call the Claude API from your own back end, not from code
  that runs in your users' browsers. Anyone who uses a webpage can read an API key in
  that page's code." The warning is about a developer's key shipped in a page.
  Nothing on the page speaks about a key the user supplies (**inferred**: the pages
  read neither allow nor forbid it).
- The SDK guide names two cases where browser use "might not pose significant
  risks": internal tools, and development or debugging
  ([TypeScript SDK, Browser usage](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript#runtime-support)).
- **Some organizations can't call from a browser at all.** Those with zero data
  retention or the Compliance API get a 401 `authentication_error` whose message
  begins `CORS requests are not allowed for this Organization`, "even though the API
  key is valid", and "no setting allows browser requests for these organizations".
  A Console organization linked to a Claude Enterprise parent inherits the setting
  ([Browser-based applications](https://platform.claude.com/docs/en/manage-claude/authentication#browser-based-applications),
  [Errors](https://platform.claude.com/docs/en/api/errors)).
- The restriction "applies only to requests that include an `Origin` header, which
  browsers add and server-side HTTP clients normally do not" (same section).
- Required headers: `Authorization: Bearer <key>` (or the older `x-api-key`),
  `anthropic-version` and `content-type: application/json`. **A key that is not
  scoped to one workspace also needs `anthropic-workspace-id`**, or the API returns
  a 400 ([API overview](https://platform.claude.com/docs/en/api/overview),
  [Get your API key](https://platform.claude.com/docs/en/get-api-key)). So the app
  either asks the user for a workspace-scoped key or has a second field.
- API versions are `2023-06-01` and `2026-10-21`; the newer one removes
  `temperature`, `top_p` and `top_k`
  ([API versions](https://platform.claude.com/docs/en/api/versioning)).

### OpenAI

- "Remember that your API key is a secret. Don't share it with others or expose it
  in any client-side code such as browsers or apps."
  ([API reference overview](https://developers.openai.com/api/reference/overview))
- "Never deploy your key in client-side environments like browsers or mobile apps
  … Requests should always be routed through your own backend server."
  ([Best practices for API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety))
- The SDK runs in "Web browsers: disabled by default to avoid exposing your secret
  API credentials. Enable browser support by explicitly setting
  `dangerouslyAllowBrowser` to `true`."
  ([openai-node README](https://github.com/openai/openai-node/blob/2442a0ca8a93/README.md))
- None of the guides read mentions CORS. The behaviour above is observed only.
- Authentication is `Authorization: Bearer <key>`. Optional `OpenAI-Organization`
  and `OpenAI-Project` headers apply to users in several organizations or with
  legacy user keys
  ([API reference overview](https://developers.openai.com/api/reference/overview)).

### Google

- "Never expose keys client-side in production: Do not hardcode API keys directly in
  web or mobile apps. Keys compiled in client-side code can be extracted by users. To
  secure client-side apps, run a backend proxy server."
  ([Using Gemini API keys, security](https://aistudio.google.com/docs/api-key#security))
- The SDK README lists "Browser: Supported, with an API key" for the Gemini
  Developer API, under the caution "Avoid exposing API keys in client-side code. Use
  server-side implementations in production environments."
  ([js-genai README](https://github.com/googleapis/js-genai/blob/9a150eab2ab6/README.md))
- The key goes in the `x-goog-api-key` header
  ([Streaming](https://aistudio.google.com/docs/streaming)).
- Since 28 May 2026 every new key made in AI Studio is an "authorization key",
  limited to the Gemini API by default, with "fast-acting leaked key enforcement".
  The API rejects unrestricted standard keys. A key can also be restricted by
  origin, to "IP addresses, websites, or applications"
  ([Using Gemini API keys](https://aistudio.google.com/docs/api-key)).
  **Inferred:** a user could limit their key to the app's own web address.
  Anthropic's page offers an IP allowlist instead; a website restriction was not
  seen on the Anthropic or OpenAI pages read.
- None of the docs pages read mentions CORS. The behaviour above is observed only.

## 2. A direct call from Obsidian

**The Obsidian side is in
[`obsidian-network-key.md`](obsidian-network-key.md)**, written for the other
ticket: whether a plain `fetch` works from a plugin on desktop and on mobile,
whether Obsidian's `requestUrl` is needed, whether each route can stream, and what
origin a plugin's request carries. This note has only what the providers say that
bears on it.

- **Origin.** All three allowed the origin `app://obsidian.md` (**observed**, with an
  invalid key): Anthropic and OpenAI answer `Access-Control-Allow-Origin: *`,
  Google echoes the origin back. That value was a guess at what Obsidian sends, so
  check it against the other note.
- **Anthropic's opt-in follows the `Origin` header, not the client.** A request
  that carries an `Origin` needs the opt-in header and is refused for zero data
  retention and Compliance API organizations. A request with no `Origin` is treated
  as a server-side call
  ([Browser-based applications](https://platform.claude.com/docs/en/manage-claude/authentication#browser-based-applications)).
  Which of the two a plugin's `fetch` and `requestUrl` produce is the other note's
  question.
- **Streaming is server-sent events over the `POST` response at all three,** so a
  route can stream only if it hands the response body over as it arrives.
  - Anthropic: `"stream": true`. Named events `message_start`,
    `content_block_start`, `content_block_delta`, `content_block_stop`,
    `message_delta`, `message_stop`, plus `ping` and `error`. New event types may be
    added and "your code should handle unknown event types gracefully"
    ([Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)).
  - OpenAI: `stream: true` on the Responses API. Typed events such as
    `response.output_text.delta`, `response.completed` and `error`
    ([Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)).
    A WebSocket mode also exists; it was not examined.
  - Google: `"stream": true` on the Interactions API. Named events
    `interaction.created`, `step.start`, `step.delta`, `step.stop`,
    `interaction.completed` and `error`
    ([Streaming](https://aistudio.google.com/docs/streaming)).
- **A stream the client drops can still be charged.** Anthropic: "If your client
  disconnects or times out in the middle of a request that was on track to succeed,
  that request is still charged"
  ([How do I pay for my Claude API usage?](https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage)).
  The other two were not checked for this.

## 3. Input: images and PDFs

| | Anthropic | OpenAI | Google |
| --- | --- | --- | --- |
| Image formats | JPEG, PNG, GIF, WebP; first frame only of an animation | PNG, JPEG, WebP, non-animated GIF | PNG, JPEG, WebP, HEIC, HEIF |
| Per image | 10 MB base64-encoded; 8000×8000 px | 30,000 patches of 32×32 px after resizing, else rejected | not stated |
| Per request | 600 images (100 on a model with a 200k window); 128 MB | 1,500 images; 512 MB | 3,600 images; 20 MB on one page, 100 MB on another (below) |
| PDF as is | Yes | Yes | Yes |
| PDF caps | 600 pages; 128 MB request; no passwords or encryption | 50 MB per file and 50 MB across a request's files; no page cap stated | 1,000 pages; 50 MB per file |
| What it does with a PDF | Each page becomes an image, and the page's text is given beside it | "Extracts both text and page images and sends both" | Renders each page to an image, and extracts embedded text beside it |
| Tokens per page | 1,500–3,000 for text, plus at most 1,568 for the image | not stated; a `detail` setting of `low` or `high` | about 560 at the default resolution (280 low, 1,120 high); embedded text at no extra charge |

Sources and details:

- **Anthropic.** [Vision](https://platform.claude.com/docs/en/build-with-claude/vision#request-limits):
  formats, the 10 MB and 8000 px limits, the image counts. More than 20 images in a
  request brings a stricter size limit on every image; keeping each under 3,000 px
  avoids it. Images are sent as base64, a URL or a Files API id.
  [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support):
  "Claude works with any standard PDF", the page and size limits, the two steps
  ("converts each page of the document into an image", "extracts the text from each
  page and provides it alongside that page's image"), and the token costs. "Dense
  PDFs … can fill the context window before reaching the page limit." A PDF is sent
  as base64, a URL or a Files API id; the page advises placing it before the text.
- **OpenAI.** [Images and vision](https://developers.openai.com/api/docs/guides/images-vision):
  formats, 512 MB, 1,500 images, the patch limit. Images go as a URL, a base64 data
  URL or a file id.
  [File inputs](https://developers.openai.com/api/docs/guides/file-inputs): "For PDF
  files, the API extracts both text and page images and sends both to models that
  accept image inputs"; "each file must be under 50 MB. The combined limit across all
  files in the request is 50 MB." The page gives no page cap (**inferred:** the
  context window is the limit). Files go as base64 `file_data`, a `file_id` or a
  `file_url`. For GPT-5.6 and later the default `detail` for PDF page images is
  `high`. The Responses API also takes Word, spreadsheet and text files, as text
  only.
- **Google.** [Image understanding](https://aistudio.google.com/docs/image-understanding):
  formats, 3,600 images, and 258 tokens per 768×768 tile.
  [Document processing](https://aistudio.google.com/docs/document-processing#technical-details):
  "Up to 50 MB per file, 1,000 pages per PDF"; pages rendered "to 2-megapixel
  images"; "embedded PDF text is extracted alongside page images at no extra token
  charge". Office and OpenDocument files are also taken.
  [File input methods](https://aistudio.google.com/docs/file-input-methods): inline
  data, the Files API (2 GB per file, kept 48 hours) or an external URL (15 MB).
- **Google's pages disagree on the inline request size.** Image understanding says
  inline image data "limits your total request size … to 20MB". File input methods
  says inline data is "100 MB per request or payload (50 MB for PDFs)". Neither page
  is dated. Treat 20 MB as the safe figure until a request settles it.

**Inferred for this app:** an attachment sent inline as base64 fits all three for a
picture or a PDF of ordinary size, and no provider needs its Files API for that.

## 4. A fixed shape for an answer

All three compile a JSON Schema into a grammar that limits what the model can write.

| | Anthropic | OpenAI | Google |
| --- | --- | --- | --- |
| Request field | `output_config.format` with `type: "json_schema"` | `text.format` with `type: "json_schema"` and `strict: true` (Responses API) | `response_format` of type `text` with `mime_type: application/json` and a `schema` |
| Also on tool calls | `strict: true` on a tool | strict function calling | not checked |
| Optional fields | Allowed; at most 24 across a request | Not allowed: "all fields … must be specified as `required`"; use a union with `null` | Allowed |
| `additionalProperties` | Must be `false` | Must be `false` | Supported as a keyword; not read further |
| Recursion | Not supported | Supported | Supported with care |
| Size limits | 20 strict tools, 24 optional fields, 16 union-typed fields; 180 s compile limit | 5,000 properties, 10 levels, 1,000 enum values | "Very large or deeply nested schemas may be rejected" with a 400 |
| What is not enforced | `minimum`, `maximum`, `minLength`, `maxLength` and the like are unsupported (400) | `allOf`, `not`, `if`/`then`/`else` and others unsupported (error) | `minLength`, `maxLength`, `minProperties`, `maxProperties`, `uniqueItems` and others are **stripped and ignored without an error** |
| When the shape can still be missed | A refusal; `max_tokens` reached; enum capitalization | A refusal (a `refusal` field); an incomplete response | "Always validate values in your application" |
| Streaming | Yes | Yes | Yes, as "valid partial JSON" |

- **Anthropic.** [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs):
  stable, no beta header, on every current model. The first use of a schema has
  "additional latency while the grammar compiles"; the compiled grammar is cached 24
  hours. Under zero data retention the schema is still cached, "for up to 24 hours
  since last use". Changing the format invalidates the prompt cache for the
  conversation.
  One caution for the proposal ability: a field that asks for step-by-step reasoning
  "might lead to a `reasoning_extraction` refusal".
- **OpenAI.** [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs):
  the schema rules under "Supported schemas". An older "JSON mode" gives valid JSON
  with no schema. On GPT-6 models the format can be changed between turns without
  losing the prompt cache.
- **Google.** [Structured outputs](https://aistudio.google.com/docs/structured-output):
  the schema subset and the limits. The SDKs take Zod schemas.

## 5. What is kept

### Anthropic

- "For Anthropic API users, we automatically delete inputs and outputs on our backend
  within 30 days of receipt or generation", except under a longer-retention feature
  the customer controls, an agreement such as zero data retention, the Usage Policy,
  or the law
  ([How long do you store my organization's data?](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)).
- "We retain inputs and outputs for up to 2 years and trust and safety
  classification scores for up to 7 years if your chat is flagged by our automated
  trust and safety systems as violating our Usage Policy." (same article)
- "By default, we will not use your inputs or outputs from our commercial products
  (e.g. … Anthropic API …) to train our models."
  ([Is my data used for model training?](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training)).
  The Commercial Terms say "Anthropic may not train models on Customer Content from
  Services" ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms)).
- **The developer docs word the default differently.** They say "Conversation
  content (your prompts and Claude's outputs) is not retained by default; the
  exception is Covered Models, which require 30-day retention"
  ([API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)).
  The privacy centre says deleted "within 30 days". The two are not reconciled on
  either page. The safe reading is "up to 30 days".
- The Fable and Mythos models are "Covered Models": they require 30-day retention
  and are refused under zero data retention (same page).
- Zero data retention is by arrangement with sales, and it blocks browser calls
  (item 1).
- There is no free tier with different rules: none was found (item 7).

### OpenAI

- "As of March 1, 2023, data sent to the OpenAI API is not used to train or improve
  OpenAI models (unless you explicitly opt in to share data with us)."
  ([Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data)).
  The Services Agreement: "OpenAI will not use Customer Content to develop or improve
  the Services, unless Customer explicitly agrees"
  ([Services Agreement](https://openai.com/policies/services-agreement/), 4.2).
- "By default, abuse monitoring logs are generated for all API feature usage and
  retained for up to 30 days, unless longer retention is required by law, or is
  reasonably necessary to protect our services or any third party from harm."
  (Data controls page)
- **The Responses API keeps each response for 30 days unless told not to.** "The
  Responses API has a 30 day Application State retention period by default, or when
  the `store` parameter is set to `true`." Chat Completions keeps no application
  state by default. (same page)
- Image and file inputs are scanned for child sexual abuse material, and a match is
  kept for review whatever the settings. (same page)
- Zero Data Retention and Modified Abuse Monitoring need OpenAI's approval. (same
  page)
- The pages read state no different rule for the Free tier.

### Google

- **Paid.** "Google doesn't use your prompts … or responses to improve our products."
  "Google logs prompts and responses for a limited period of time, solely for
  detecting and preventing violations of the Prohibited Use Policy"
  ([Gemini API Additional Terms, Paid Services](https://aistudio.google.com/docs/terms#paid-services)).
  The period is 55 days
  ([Abuse monitoring](https://aistudio.google.com/docs/usage-policies)).
- **Free.** "Google uses the content you submit to the Services and any generated
  responses to provide, improve, and develop Google products and services and machine
  learning technologies." "Human reviewers may read, annotate, and process your API
  input and output." "Do not submit sensitive, confidential, or personal information
  to the Unpaid Services."
  ([Unpaid Services](https://aistudio.google.com/docs/terms#unpaid-services))
- The API is a "Paid Service" only when the key's Cloud project has an active
  billing account. In the European Economic Area, Switzerland and the United Kingdom
  the paid data terms apply to the free tier too. (same page)
- **The Interactions API stores every interaction unless told not to:** 55 days on
  the paid tier, 1 day on the free tier. `store=false` turns it off, and with it
  server-side conversation state
  ([Interactions API, data storage and retention](https://aistudio.google.com/docs/interactions-overview#data-storage-retention)).
- Logging to the developer's own project is on by default for Interactions API
  calls on billed projects. Those logs go to Google for training only if the owner
  shares them
  ([Data logging and sharing](https://aistudio.google.com/docs/logs-policy)).

## 6. Price and limits

### The assumption

One request is the Math guide, a sheet and a question in, and one answer out.

- **The Math guide:** `docs/math-guide.md` is **39,587 characters** (measured with
  `wc -m`; 582 lines).
- **A sheet of about 100 lines:** **3,000 characters.** The one sample sheet in the
  repo, `plugin/test/pump-sizing.excalimathpad`, has 34 source lines of 27.3
  characters on average, so 100 lines are about 2,730; rounded up.
- **The question and framing:** 400 characters.
- **Input total: 42,987 characters.**
- **The answer:** two cases, **500** and **2,000** output tokens. All the models
  below think before answering, and thinking is billed as output
  ([Anthropic, Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking);
  [OpenAI, Reasoning](https://developers.openai.com/api/docs/guides/reasoning);
  Google's price tables read "Output price (including thinking tokens)"). The
  2,000-token case stands for a short answer with thinking.

Characters became tokens by each provider's own published ratio. These are
estimates. Real counts need each provider's token counter and a key.

- Anthropic: "1M tokens is roughly … 2.5M Unicode characters on the current
  tokenizer", so 2.5 characters a token
  ([Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)):
  **17,195 input tokens**.
- OpenAI: "1 token is approximately 4 characters"
  ([What are tokens and how to count them?](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them)):
  **10,747 input tokens**.
- Google: "a token is equivalent to about 4 characters"
  ([Token counting](https://aistudio.google.com/docs/tokens)): **10,747 input
  tokens**.

The Anthropic figure is 60% larger for the same text because its documented ratio
is lower. Whether real counts differ that much is not verified.

### Cost of one request

Cost = input tokens × input price + output tokens × output price. No caching.

| Provider | Model | Input / output per MTok | 500-token answer | 2,000-token answer |
| --- | --- | --- | --- | --- |
| Anthropic | `claude-haiku-5-5` | $0.10 / $0.50 | $0.0020 | $0.0027 |
| Anthropic | `claude-sonnet-5-5` | $2 / $10 | $0.039 | $0.054 |
| Anthropic | `claude-opus-5-5` | $4 / $20 | $0.079 | $0.109 |
| Anthropic | `claude-fable-5-2` | $8 / $40 | $0.158 | $0.218 |
| OpenAI | `gpt-6-luna` | $0.10 / $0.50 | $0.0013 | $0.0021 |
| OpenAI | `gpt-6.1-terra` | $1 / $5 | $0.013 | $0.021 |
| OpenAI | `gpt-6.2-sol` | $2 / $10 | $0.026 | $0.041 |
| OpenAI | `gpt-6.2-astra` | $8 / $40 | $0.106 | $0.166 |
| Google | `gemini-3.5-flash-lite` | $0.30 / $2.50 | $0.0045 | $0.0082 |
| Google | `gemini-4-hydrogen` | $1.50 / $7.50 | $0.020 | $0.031 |
| Google | `gemini-4-neon` | $3 / $15 | $0.040 | $0.062 |
| Google | `gemini-4-carbon`, `gemini-4-argon` until 30 Nov 2026 | $2 / $10 | $0.026 | $0.041 |
| Google | the same two from 1 Dec 2026 | $4 / $20 | $0.053 | $0.083 |

Prices: [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing),
[OpenAI pricing](https://developers.openai.com/api/docs/pricing),
[Gemini pricing](https://aistudio.google.com/docs/pricing). Notes on them:

- **Anthropic.** Haiku 5.5's price is for prompts up to 100,000 tokens; above that
  it is $0.50 / $2.50. The other models have one price across the 1M window.
- **OpenAI.** The prices are for requests up to 272K input tokens; above that,
  input doubles and output is 1.5 times.
- **Google.** `gemini-4-hydrogen`, `gemini-3.8-flash` and `gemini-3.5-flash-lite`
  are also "Free of charge" on the free tier (other models were not checked).
  Carbon, Neon and Argon are "not available on the Free tier". Carbon's and
  Argon's prices double on 1 December 2026. `gemini-3.8-flash` is $0.75 / $3.75
  until 31 December 2026, then $1.50 / $7.50.
- **A repeated guide is cheaper.** The guide is the same in every request, and all
  three discount a repeated prefix. Anthropic: cache reads at 0.1× the input price
  (0.05× on Opus 5.5 and Sonnet 5.5, 0.025× on Fable 5.2), a first write at 1.25×,
  a 5-minute lifetime, and a 512-token minimum on the current models
  ([Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
  OpenAI: cached input at 5% of the input price on Astra, Sol and Terra and 10% on
  Luna, with a write at 1.25× (pricing page). Google: "implicit caching only" on
  the Gemini 4 models, at 5% of the input price (pricing page). How often each
  cache hits was not measured.

### Context limit

- Anthropic: 1M tokens on all four current models, 128K output
  ([Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)).
- OpenAI: 1,050,000 tokens, of which 922,000 input, 128,000 output, on all four
  ([GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
  [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra),
  [GPT-6.2 Sol](https://developers.openai.com/api/docs/models/gpt-6.2-sol),
  [GPT-6.2 Astra](https://developers.openai.com/api/docs/models/gpt-6.2-astra)).
- Google: 1,048,576 tokens shared by input, thinking and output on the Gemini 4
  models, 65,536 output by default; `gemini-3.5-flash-lite` has 1M input and a
  separate 64K output
  ([Gemini 4 Hydrogen](https://aistudio.google.com/docs/models/gemini-4-hydrogen),
  [Choosing a model](https://aistudio.google.com/docs/choosing-a-model)).

### Rate limits on a new key

- **Anthropic** ([Rate limits](https://platform.claude.com/docs/en/api/rate-limits)).
  Limits are per organization and per tier. "New organizations and organizations with
  limited usage history may start in the Evaluation tier, with limits below the
  standard limits shown on this page." The Evaluation tier's numbers are not
  published. The first standard tier, Start: Haiku 5.5, Sonnet 5.5 and Opus 5.5 each
  4,000 requests, 2,000,000 input tokens and 400,000 output tokens a minute; Fable
  5.2 4,000, 500,000 and 100,000. Start has a $500 monthly spend cap.
- **OpenAI** ([Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)).
  Tiers: Free ("User must be in an allowed geography", $100 a month), Build ($5 in
  total credit purchases, $500 a month), Launch ($100), Grow ($500). At Build: 5,000
  requests a minute and 1,000,000 tokens a minute for Astra, Sol and Terra, 2,000,000
  for Luna. The table starts at Build; the Free tier's per-model limits are not
  given. "Meeting a usage-tier threshold doesn't grant access to every model."
- **Google** ([Rate limits](https://aistudio.google.com/docs/rate-limits)).
  Limits are "per project, not per API key", in requests a minute, tokens a minute
  and requests a day; the daily count resets at midnight Pacific time. Tiers: Free,
  Tier 1 (a linked billing account; $250 cap), Tier 2 (paid $100 and 3 days),
  Tier 3. Tier 1 also has a spend limit of $10 per 10 minutes. **The per-model
  numbers are not on the page.** They "can be viewed in Google AI Studio", which
  needs a sign-in.

## 7. Getting a key

| | Anthropic | OpenAI | Google |
| --- | --- | --- | --- |
| Account | Claude Console account at `platform.claude.com` | OpenAI platform account | Google account; AI Studio makes a project and a key after the terms are accepted |
| Payment before the first call | Yes: "Buy credits before you use the API" | Yes for the paid tiers: "New API accounts use prepaid billing", minimum $5 | No, on the free tier |
| Free tier | None found | Listed, limits not published | Yes, on some models, among them Hydrogen, 3.8 Flash and 3.5 Flash-Lite |
| Brazil | Listed | Listed | Listed |
| Age and use | Commercial Terms: "not for consumer use" | Services Agreement: for "businesses and developers" | 18 or older; "for professional or business purposes, not for consumer use" |

- **Anthropic.** Create a key on the Console's API keys page; choose its type, its
  expiry (3 hours to "Never") and optionally a workspace; the key starts `sk-ant-`
  and is shown once
  ([Get your API key](https://platform.claude.com/docs/en/get-api-key),
  [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)).
  Billing is "prepaid usage credits"; "if you run out of credits, you can no longer
  call the API"; credits expire a year after purchase and are non-refundable; an
  auto-reload can be set
  ([How do I pay for my Claude API usage?](https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage)).
  Brazil is on the list of
  [supported regions](https://platform.claude.com/docs/en/api/supported-regions).
  The [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) say
  "Services under these Terms are not for consumer use."
- **OpenAI.** Create a key in the dashboard
  ([Quickstart](https://developers.openai.com/api/docs/quickstart)). "New API
  accounts use prepaid billing." "The minimum purchase is $5, and the default amount
  is $10." Auto-reload "is turned on by default during setup". Credits expire after
  a year. "Do not rely on the prepaid balance as an instantaneous spending cutoff"
  ([Setting up and managing prepaid API billing](https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing)).
  Brazil is on the list of
  [supported countries](https://developers.openai.com/api/docs/supported-countries).
  The [Services Agreement](https://openai.com/policies/services-agreement/) applies to
  "customers who are businesses and developers".
- **Google.** "If you are a new user, Google AI Studio automatically creates a default
  Google Cloud project and API key after you accept the Terms of Service"
  ([Using Gemini API keys](https://aistudio.google.com/docs/api-key)). "New accounts
  begin on the Free Tier." Moving to paid "means linking a billing account and
  prepaying to add a minimum of $5"
  ([Billing](https://aistudio.google.com/docs/billing)). Some free-tier projects need
  "mobile device verification" by scanning a QR code, and "not all Google Cloud
  projects or accounts are eligible for the Gemini API free tier"
  ([Project and account verification](https://aistudio.google.com/docs/verification),
  [Troubleshooting](https://aistudio.google.com/docs/troubleshooting)). Brazil is on
  the list of [available regions](https://aistudio.google.com/docs/available-regions).
  The [terms](https://aistudio.google.com/docs/terms) require age 18 or older, forbid
  an app "likely to be accessed by individuals under the age of 18", and say "You may
  use only Paid Services when making API Clients available to users in the European
  Economic Area, Switzerland, or the United Kingdom."

**Inferred:** all three sets of terms are written for a developer who builds an app,
not for an app's user who brings a key. With a user's own key, the user is the
provider's customer and accepts those terms. Whether a hobbyist's personal use fits
"not for consumer use" is a legal reading this note does not make.

## 8. Models

### Current models that fit

Text and image in, text out, with structured output, on each provider's own list of
its latest models.

- **Anthropic** ([Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)):
  `claude-fable-5-2` ("demanding reasoning and long-horizon agentic work"),
  `claude-opus-5-5` ("start with Claude Opus 5.5 for most workloads"),
  `claude-sonnet-5-5` ("The best combination of speed and intelligence"),
  `claude-haiku-5-5` ("high-volume, latency-sensitive tasks"). All four take images
  and PDFs and support structured outputs. Fable 5.2 can't be used under zero data
  retention (item 5).
- **OpenAI** ([Models](https://developers.openai.com/api/docs/models)):
  `gpt-6.2-astra` ("our flagship model for complex reasoning and coding"),
  `gpt-6.2-sol` ("to balance intelligence and cost"), `gpt-6.1-terra` ("fast,
  efficient"), `gpt-6-luna` ("cost-sensitive, high-volume workloads"). Each model
  page lists `structured_outputs` and `image_input`.
- **Google** ([Latest Gemini models](https://aistudio.google.com/docs/latest-model)):
  "Start with `gemini-4-hydrogen`"; `gemini-4-carbon` or `gemini-4-neon` "for deep
  frontier reasoning"; `gemini-4-argon`; `gemini-3.5-flash-lite` for "High-volume and
  low-cost". "Every Gemini model below accepts text, images, audio, video, and
  PDFs" and supports structured outputs. Google now calls its Interactions API the
  default and `generateContent` "legacy" but "fully supported"
  ([Interactions API](https://aistudio.google.com/docs/interactions-overview)).

### How long a named model stays

- **Anthropic** ([Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)).
  "Every Claude model ID is a pinned snapshot." Each model has a tentative
  retirement date: `claude-fable-5-2` not sooner than 9 November 2027,
  `claude-haiku-5-5` 7 October 2027, `claude-sonnet-5-5` 28 September 2027,
  `claude-opus-5-5` 22 September 2027. Notice is "at least 60 days … before model
  retirement for publicly released models", by email and on the page. "Once the
  model is retired, requests to it fail."
- **OpenAI** ([Deprecations](https://developers.openai.com/api/docs/deprecations)).
  "Unless safety or compliance concerns require a faster timeline": "Generally
  available models: At least 6 months"; specialized variants at least 3 months;
  preview models "such as 2 weeks". No GPT-6 model is on the upcoming list. A
  model's `shutdown_date` can be read from `GET /v1/models`. Each GPT-6 model page
  lists one snapshot, named like the model (`gpt-6-luna`).
- **Google** ([Gemini deprecations](https://aistudio.google.com/docs/deprecations),
  [model version patterns](https://aistudio.google.com/docs/models#model-versions)).
  The Gemini 4 models and `gemini-3.5-flash-lite` show "No shutdown date announced".
  Listed dates are "the earliest possible dates"; Google "will communicate the exact
  shutdown date to users with advance notice", with **no length given for stable
  models**. Preview models get "at least 2 weeks notice". **A name can change what
  it means:** `gemini-3.7-flash` "automatically routes API requests to
  `gemini-3.8-flash`", and from 1 December 2026 requests to `gemini-2.5-flash` "will
  automatically route to `gemini-3.5-flash-lite` and be billed at Gemini 3.5
  Flash-Lite rates". One stable model shows a year: `gemini-3.1-flash-lite`,
  released 7 May 2026, shutdown 7 May 2027.

**Inferred for a release that names its model:** an Anthropic or OpenAI name either
answers as that model or fails after a published date. A Gemini name may later be
answered by a different model at a different price.

## 9. SDK or plain HTTP

**Plain HTTP suffices for all three.** Each documents the call as a `curl` command:
one `POST` with a JSON body and a key header (items 1 and 2).

Sizes, from the npm registry and from a bundle made in this session:

| Package | Version | Unpacked size on npm | Bundled and minified (**observed**) | Gzipped |
| --- | --- | --- | --- | --- |
| [`@anthropic-ai/sdk`](https://registry.npmjs.org/@anthropic-ai/sdk/latest) | 1.12.0 | 18,002,715 bytes | **387,237 bytes** | 85,337 |
| [`openai`](https://registry.npmjs.org/openai/latest) | 7.62.0 | 24,155,858 bytes | **394,994 bytes** | 86,598 |
| [`@google/genai`](https://registry.npmjs.org/@google/genai/latest) | 3.6.1 | 13,504,306 bytes | **450,320 bytes** | 86,420 |
| plain `fetch` and an SSE reader | none | none | **1,160 bytes** | 746 |

- **The npm figure is not the cost.** Unpacked size counts type declarations, source
  maps and both module formats. The bundled figure is what `main.js` would gain.
- **How it was measured.** A throwaway file per SDK that creates the client and
  makes one streaming call, bundled with esbuild 0.28.2 (the repo's version) and the
  plugin's own settings from `esbuild.plugin.mjs`: `format: 'cjs'`,
  `platform: 'browser'`, `target: es2022`, `minify: true`. Nothing was committed.
  A different import path or a later SDK version would change the numbers.
- **Against the budget.** `main.js` has a budget of 3,574,000 bytes and measured
  3,403,718 at 1.0.0 (spec section 12a), which left 170,282 bytes. The current
  build was not measured here. **Inferred:** any of the three SDKs takes more than
  twice that headroom, so using one means raising the budget on purpose; a
  hand-written call does not.
- **What the SDK would have given:** the browser opt-in (`dangerouslyAllowBrowser`
  on Anthropic's and OpenAI's, which for Anthropic sends the header in item 1),
  retries, typed stream events, and Zod schema helpers for structured output.
  Anthropic's docs say "use the client SDKs when using streaming mode. However, if
  you are building a direct API integration, you need to handle these events
  yourself" ([Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)).
  OpenAI's say "we recommend relying on the SDKs to handle streaming with Structured
  Outputs" ([Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)).
- The older Google packages `@google/generative-ai` and `google-generativeai` are
  "not actively maintained"; `@google/genai` is the current one
  ([Libraries](https://aistudio.google.com/docs/libraries)).

## Could not verify

1. **A successful browser request at any of the three.** No valid key was
   available. Preflights and error responses were observed; a 200 with a streamed
   body was not. In particular, whether a successful OpenAI response carries
   `Access-Control-Allow-Origin` is unverified. Tried: `curl` with invalid keys and
   an `Origin` header against `api.anthropic.com`, `api.openai.com` and
   `generativelanguage.googleapis.com`.
2. **The same tests in a real browser.** `curl` shows the headers. It does not run a
   browser's CORS check, a service worker or a content security policy.
3. **What origin an Obsidian plugin's request carries.** `app://obsidian.md` was
   assumed for the test. See `obsidian-network-key.md`.
4. **OpenAI's and Google's position on CORS.** Neither documents it in the pages
   read. What was observed could change without notice. Anthropic's is documented.
5. **Real token counts for the Math guide.** The costs use each provider's published
   characters-per-token ratio. The token counting endpoints need a key.
6. **How many thinking tokens a typical answer uses,** on any model. The 2,000-token
   case is an assumption.
7. **Anthropic's Evaluation tier limits** for a new organization: the page says they
   are "below the standard limits" and gives no numbers.
8. **OpenAI's Free tier:** its per-model rate limits, which models it can call, and
   whether a new account gets free credits. The tier is listed with a $100 monthly
   limit and nothing more.
9. **Gemini's per-model rate limits,** free and paid. They are shown only at
   `aistudio.google.com/rate-limit`, which redirects to a Google sign-in.
10. **Anthropic's minimum credit purchase,** and whether a new Console account gets
    any free credit. The billing article gives neither.
11. **Which payment methods work from Brazil** at each provider, and local taxes.
    All three list Brazil as a supported country; none of the pages read says more.
12. **Google's inline request size:** 20 MB on one page, 100 MB on another (item 3).
13. **Anthropic's default retention wording:** "not retained by default" in the
    developer docs, "within 30 days" in the privacy centre (item 5).
14. **OpenAI's PDF page limit,** if there is one: the file inputs guide states only
    the 50 MB limit.
15. **Whether a personal, non-business user is within each provider's terms.** The
    wording is quoted in item 7; the reading is a legal question.
16. **OpenAI's WebSocket mode and Google's `generateContent` route** were not
    examined beyond a CORS preflight on the second.

No host was blocked by the session's network policy. One page needed a sign-in
(item 9 above).

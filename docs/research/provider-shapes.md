Research for wayfinder ticket #303, 2026-11-22.

# Which providers can be called directly at an address the user types, and through which API shapes

**Question.** From 2026-11-22 the Math assistant calls whatever provider and model the user sets:
a provider from a short built-in list, or an address the user types, with a key and a model name.
There is still no server of ours. Which providers can a browser page and the Obsidian plugin call
directly, and through which API shapes, so that two or three hand-written adapters reach "any
model"? This note extends [`provider-apis.md`](provider-apis.md) (ticket #239), which covered
Anthropic's, OpenAI's and Google's own APIs, and doesn't repeat it. It decides nothing: the
provider ticket (#243) does.

**How to read the sources.** Every page was read on **2026-11-22**. Each claim links to the page
of the company that owns the fact: its docs, terms, privacy policy, source code or a browser
vendor's spec or docs. Three labels are used, as in the first note:

- **Verified** (unmarked): the linked page says it.
- **Observed**: run from this session on 2026-11-22 with `curl`, always with an **invalid key**,
  sending the `Origin` a browser page would send (`https://example.github.io`) and then the one
  the plugin is assumed to send (`app://obsidian.md`). It shows the CORS headers a browser would
  see and the shape of an error. It doesn't show a successful request: no valid key was available.
- **Inferred**: my reading of verified or observed facts. Always marked.

Three sources could not be read: xAI's legal pages (`x.ai/legal/*` answered 403), DeepSeek's FAQ
(a JavaScript-only page) and Mozilla's support article on local network access. Claims that would
rest on them are marked **unverified**.

## Answer

1. **The shape every candidate copies is OpenAI's Chat Completions.** Every host checked takes
   `POST <base>/chat/completions` with `Authorization: Bearer <key>`, a `model` and `messages`,
   and streams server-sent events ending in `data: [DONE]` (item 1). OpenAI itself keeps it
   supported but recommends Responses "for all new projects"; xAI already labels its Chat
   Completions "Deprecated" and "legacy". Responses is copied by some (OpenRouter, xAI, Mistral,
   DeepSeek, Groq, Together, Ollama) but not by all, so it isn't the common shape.
2. **Two adapters reach every candidate; a third is optional.**
   - **Chat Completions at a base URL**, for everyone below.
   - **Anthropic's own Messages API.** Anthropic's OpenAI-compatible endpoint exists, but it has
     no prompt caching, refuses PDFs with a 400, and Anthropic calls it "not considered a
     long-term or production-ready solution". **Inferred:** Anthropic keeps its own adapter.
   - **Google's own API (optional).** Google's compatible endpoint is "still in beta", Google
     recommends its own API to anyone not already using OpenAI's libraries, and PDFs through it
     are **unverified**. Text and images go through it.
3. **Every host answered a cross-origin call from both origins** (**observed**, item 2). The wrong
   key's error was readable everywhere except on **OpenAI's and Cerebras's chat endpoint**, where
   the 401 carried no `Access-Control-Allow-Origin` header. Both answered `GET /models` with a
   readable 401, so a page could tell a wrong key from no network there.
4. **What differs across the compatible shape** (table in item 3):
   - **PDFs aren't portable.** Only OpenAI and OpenRouter take a PDF inline as a `file` part in
     Chat Completions. Mistral takes one in its native format; DeepSeek only by `file_id` after an
     upload; xAI documents files only through Responses, as a search tool; Ollama refuses any
     `file` part. **Inferred:** an attachment ticket can't assume "a PDF goes to any provider".
   - **A fixed answer shape isn't portable.** DeepSeek has JSON mode only, with no `json_schema`.
     OpenRouter's support depends on the model behind it.
   - **Errors come in six body shapes,** with the message in one of five places (item 4). One
     reader handles them all.
   - **Caching of a repeated prefix is automatic** everywhere except Anthropic, where it's
     explicit and only on the native API.
5. **A local model can be reached, with one setting and one browser prompt.**
   - `http://localhost` and `http://127.0.0.1` aren't mixed content, so an HTTPS page may call
     them.
   - Chrome 142 and later, and Edge 143 and later, ask the user once for permission to reach the
     loopback address. Firefox does from version 153.
   - **Ollama allows `app://*` by default** (so Obsidian on a computer), but not a public
     `https://` page. The web app needs the user to set `OLLAMA_ORIGINS`. LM Studio's CORS is off
     until the user turns it on.
6. **What the app can check about a typed address with no request** is its form only: it parses,
   it is `https:`, or `http:` with a loopback host, and it carries no user name or password. Item 6
   has the reasons. Nothing short of a request tells whether it is an API, or which shape it
   speaks.
7. **Both adapters together are 3.8 kB** (**observed**): 3,825 bytes minified, 1,664 gzipped, with
   the plugin's own esbuild settings. Chat Completions alone is 2,573 bytes, and the
   Português-build headroom was 126,227 bytes (item 7).
8. **Two findings collide with decisions still open.**
   - **The key ticket (#244):** OpenRouter offers a sign-in that hands the app a key with no
     server (OAuth with PKCE), but its own page says never to keep that key in `localStorage`,
     `sessionStorage`, IndexedDB or a cookie.
   - **The rule and listing ticket (#245):** DeepSeek's terms tell developers not to expose a key
     "in browser or other client-side code", as OpenAI's, Anthropic's and Google's pages do (first
     note). Whether that wording covers a key the user brings is a legal reading, not checked here.
   - **Azure OpenAI** puts its key in an `api-key` header, not `Bearer`, so a plain "base URL and
     Bearer key" doesn't cover it (item 1).

## 1. The OpenAI-compatible shape

### What OpenAI says about its two APIs

- Chat Completions is supported, not deprecated: "While Chat Completions remains supported,
  Responses is recommended for all new projects", and "We recommend migrating all flows to the
  Responses API over time"
  ([Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)).
  The Assistants API, by contrast, "was officially sunset on August 26, 2026" (same page).
- **The smallest streaming request** is `POST https://api.openai.com/v1/chat/completions` with
  `Authorization: Bearer <key>`, a `model` and `messages`, and `stream: true`. Add
  `stream_options: {include_usage: true}` to get an extra chunk "before the `data: [DONE]` message"
  whose "`choices` field will always be an empty array" and which carries the usage; if the stream
  is interrupted, that chunk may never arrive
  ([Create chat completion](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)).
- **The stream** is `data: {…}` chunks of `chat.completion.chunk`, the text in
  `choices[0].delta.content` ("string or null"), ending with `data: [DONE]`
  ([Streaming events](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events)).
- **Images** go as a content part `{type: "image_url", image_url: {url, detail}}`, where `url` is
  "Either a URL of the image or the base64 encoded image data" (create page above).
- **PDFs** go as `{type: "file", file: {filename, file_data}}`: "Chat Completions accepts only PDF
  files as `file` content parts", base64 `file_data` or a `file_id`, never a `file_url`, and with
  no `detail` ([File inputs](https://developers.openai.com/api/docs/guides/file-inputs)).
- **A fixed answer shape** is `response_format: {type: "json_schema", json_schema: {name, schema,
  strict}}`; `json_object` is "the older JSON mode" (create page above).
- **An error** (**observed**, wrong key):
  `{"error":{"message":"Incorrect API key provided: …","type":"invalid_request_error","code":"invalid_api_key","param":null},"status":401}`.
  The error-codes guide names `error.code`, `error.type` and `error.param` but gives no whole body
  ([Error codes](https://developers.openai.com/api/docs/guides/error-codes)).

### The base URL each candidate gives

The app appends `/chat/completions` (and `/models`) to the base URL. The "Observed" column is the
host that answered in item 2.

| Candidate | Base URL | Source |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | [Create chat completion](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) |
| xAI (Grok) | `https://api.x.ai/v1` | [Inference REST API](https://docs.x.ai/developers/rest-api-reference/inference) |
| Google, compatible endpoint | `https://generativelanguage.googleapis.com/v1beta/openai` | [OpenAI compatibility](https://aistudio.google.com/docs/openai) |
| OpenRouter | `https://openrouter.ai/api/v1` | [API versioning](https://openrouter.ai/docs/api_reference/versioning) |
| Mistral, compatible endpoint | `https://api.mistral.ai/openai/v1` ("public preview"); plain `/v1` is Mistral's own format | [Chat completion](https://docs.mistral.ai/inference/conversations/chat-completion) |
| DeepSeek | `https://api.deepseek.com` (no `/v1` in the examples) | [DeepSeek API docs](https://api-docs.deepseek.com/) |
| Groq | `https://api.groq.com/openai/v1` | [OpenAI compatibility](https://console.groq.com/docs/openai) |
| Together AI | `https://api.together.ai/v1` (observed at `api.together.xyz`) | [OpenAI API compatibility](https://docs.together.ai/docs/openai-api-compatibility) |
| Fireworks | `https://api.fireworks.ai/inference/v1` | [OpenAI compatibility](https://docs.fireworks.ai/tools-sdks/openai-compatibility) |
| Cerebras | `https://api.cerebras.ai/v1` | [OpenAI compatibility](https://inference-docs.cerebras.ai/resources/openai) |
| Ollama, local | `http://localhost:11434/v1` ("Ollama ignores" the key) | [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility) |
| LM Studio, local | `http://localhost:1234/v1` in the examples; the port is the user's | [OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat) |
| Anthropic, compatible endpoint | `https://api.anthropic.com/v1` | [OpenAI SDK compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk) |

- **The base URLs don't share a form:** a `/v1`, a `/v1beta/openai`, an `/api/v1`, an
  `/openai/v1`, an `/inference/v1` or no path at all. **Inferred:** the typed address has to be the
  base URL as the provider's docs give it, and the app can't guess it from a host name.
- **Mistral's model list isn't under its compatible base URL:** `GET /openai/v1/models` answered
  404 "no Route matched" (**observed**); the list is `GET /v1/models`
  ([openapi.yaml](https://docs.mistral.ai/openapi.yaml)).
- **xAI calls its Chat Completions the "stateless, OpenAI-compatible predecessor… New
  integrations should use Responses"**
  ([Chat completions](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions)),
  labels it "Chat Completions API (Deprecated)"
  ([Comparison](https://docs.x.ai/developers/model-capabilities/text/comparison)) and "offered as a
  legacy endpoint" ([Legacy chat completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions)).
  No shutdown date was found.
- **Azure OpenAI isn't covered by "base URL and Bearer key."** "All API requests must include the
  API Key in the `api-key` HTTP header"; the dated API puts the deployment in the path and an
  `api-version` in the query
  ([Azure OpenAI reference](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference)).
  The newer v1 API has a plain base URL ending `/openai/v1/` and drops `api-version`, and its REST
  example still sends `api-key`
  ([API version lifecycle](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/api-version-lifecycle)).
  Whether v1 also takes a Bearer key is **unverified**: the page implies it and doesn't state it.

### Anthropic through the compatible shape

From [OpenAI SDK compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk):

- "This compatibility layer is primarily intended to test and compare model capabilities, and is
  not considered a long-term or production-ready solution for most use cases." And: "For the best
  experience and access to the full Claude API feature set (PDF processing, citations, thinking,
  and prompt caching), use the native Claude API."
- **"Prompt caching is not supported."** The first note's plan cached the Math guide; that needs
  the native API.
- **"Audio and file inputs are not supported. A request that includes an `input_audio` or `file`
  content part returns a 400 error."** So no PDF.
- Images through `image_url` are "Fully supported", and `detail` is "Ignored".
- `response_format` "accepts only `json_schema` with `strict: true`".
- `stream` and `stream_options` are "Fully supported". "The response doesn't include Claude's
  thinking." `usage.*_details` fields are "Always empty". "Most unsupported fields are silently
  ignored."
- A key not scoped to one workspace still needs `anthropic-workspace-id` (same page; the first
  note found the same on the native API).
- **The browser opt-in applies here too** (**observed**). A preflight asking only for
  `authorization,content-type` answered 400 with no `Access-Control-Allow-Origin`. A preflight
  that also asked for `anthropic-dangerous-direct-browser-access` answered 200 with
  `Access-Control-Allow-Origin: *`. The `POST` with that header got a readable 401 with
  `{"error":{"code":"authentication_error","message":"Invalid Anthropic API Key","type":"invalid_request_error","param":null}}`.
  **Inferred:** a typed `api.anthropic.com` address would also need the opt-in header that only
  Anthropic needs.

### Google through the compatible shape

From [OpenAI compatibility](https://aistudio.google.com/docs/openai):

- "Support for the OpenAI libraries is still in beta while we extend feature support." The page
  gives no list of what is missing. It also says: "If you aren't already using the OpenAI
  libraries, we recommend that you call the Gemini API directly."
- It documents chat, streaming with `include_usage`, function calling, images (`image_url` with a
  `data:` URL), structured output (only through the SDKs' helpers, with no raw `json_schema`
  example), `reasoning_effort`, and `GET /models`.
- **PDFs aren't mentioned** on this page or on
  [Document processing](https://aistudio.google.com/docs/document-processing). **Unverified.**
- **Caching:** "Implicit caching is enabled by default for all Gemini 2.5 and newer models", with a
  minimum of 4,096 tokens on Gemini 4 and 3.x ([Caching](https://aistudio.google.com/docs/caching)).
  Whether it applies to calls through the compatible endpoint isn't stated. **Inferred:** probably,
  since it is done on the server; **unverified**.
- **Its errors aren't OpenAI-shaped** (**observed**): a wrong key gets a JSON **array**,
  `[{"error":{"code":400,"message":"Please pass a valid API key","status":"INVALID_ARGUMENT"}}]`.

## 2. A direct call from a browser page and from Obsidian

Each host got an `OPTIONS` preflight asking for `POST` with `authorization,content-type`, a
streaming `POST` with an invalid key, the same `POST` with no key, and a `GET /models` with the
invalid key. **All observed**, 2026-11-22. The results were the same for
`Origin: https://example.github.io` and `Origin: app://obsidian.md`, so one table holds both.

| Host | Preflight | Wrong key on `POST /chat/completions` | Wrong key on `GET /models` |
| --- | --- | --- | --- |
| `api.openai.com/v1` | 200, origin echoed back | 401, **no `Access-Control-Allow-Origin`** | 401, `Access-Control-Allow-Origin: *` |
| `api.x.ai/v1` | 200, `*` | 400, `*`, readable | 400, `*`, readable |
| `generativelanguage.googleapis.com/v1beta/openai` | 200, origin echoed back | 400, origin echoed back, readable | 400, readable |
| `openrouter.ai/api/v1` | 204, `*` | 401, `*`, readable | **200 with the model list: no key needed** |
| `api.mistral.ai/openai/v1` and `/v1` | 200, `*` | 401, `*`, readable | `/v1/models`: 401, readable; `/openai/v1/models`: 404 |
| `api.deepseek.com` | 200, origin echoed back, with `Access-Control-Allow-Credentials: true` | 401, origin echoed back, readable | 401, readable |
| `api.groq.com/openai/v1` | 204, `*` | 401, `*`, readable | 401, readable |
| `api.together.xyz/v1` | 200, `*` | 401, `*`, readable | 401, readable |
| `api.fireworks.ai/inference/v1` | 200, `*` | **404 "Model not found"**, `*`, readable: the model is checked before the key | 401, readable |
| `api.cerebras.ai/v1` | 200, `*` | 401, **no `Access-Control-Allow-Origin`** | 401, `*`, readable |
| `api.anthropic.com/v1` (compatible) | 400 unless the opt-in header is asked for, then 200, `*` | 401, `*`, readable, with the opt-in header | 401, readable, with the opt-in header |

**Inferred from the table:**

- **No candidate is ruled out by CORS,** from a page or from `app://obsidian.md`, as far as an
  invalid key shows.
- **On OpenAI and Cerebras a wrong key looks like a network failure** to a page that only sends
  messages: the `fetch` fails with no status. Both answer `GET /models` readably, so the app could
  tell the two apart there. Whether that request is allowed is the rule ticket's question.
- **OpenRouter's model list needs no key,** and its `GET /api/v1/key` reports the key's limit,
  usage and remaining free requests
  ([Limits](https://openrouter.ai/docs/api_reference/limits)).
- **OpenRouter's attribution headers** `HTTP-Referer` and `X-OpenRouter-Title` (`X-Title` still
  accepted) are listed in its preflight answer
  ([API overview](https://openrouter.ai/docs/api_reference/overview),
  [App attribution](https://openrouter.ai/docs/app-attribution)). They are optional.
- **None of the providers' docs read says anything about CORS for text endpoints,** except two
  lines of OpenRouter's: its error list includes "CORS" under 400, and its trace headers are
  allowed "from browser requests on another origin"
  ([Errors and debugging](https://openrouter.ai/docs/api_reference/errors-and-debugging),
  [Broadcast](https://openrouter.ai/docs/guides/features/broadcast)). Every CORS fact here is
  observed only.
- **What Obsidian really sends** as its `Origin`, and whether its `fetch` reaches these hosts, is
  still the hand check's question (#258). These results assume `app://obsidian.md`.

### What the providers say about a key in a page

- **DeepSeek's terms:** "do not expose it in browser or other client-side code. You will be solely
  responsible for any fees incurred and losses caused by sharing or leaking the API key" (§2.2,
  [Open Platform Terms of Service](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html),
  effective 2026-04-29). DeepSeek's own demo chatbot does the opposite: "Your API key,
  conversations and uploaded images are stored only in your browser"
  ([Build a chatbot](https://api-docs.deepseek.com/guides/build_a_chatbot)).
- **xAI:** "Never expose your API key in client-side code", on its voice page, where browsers get
  short-lived tokens
  ([Ephemeral tokens](https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens)).
  There are no such tokens for text.
- **Mistral:** "Browser clients cannot store long-lived API keys safely", on its realtime
  transcription page, again with tokens for audio only
  ([Client authentication](https://docs.mistral.ai/studio/audio/deprecated/speech_to_text/realtime_transcription/client_auth)).
- **OpenRouter:** "If you need a key without a limit, keep it out of client-side code"
  ([Authentication](https://openrouter.ai/docs/api_reference/authentication)). It recommends a
  credit limit on every key.
- **OpenRouter's OAuth with PKCE** lets a user "bring their own OpenRouter API key to your app",
  with no server
  ([OAuth](https://openrouter.ai/docs/guides/overview/auth/oauth)):
  - The app sends the user to `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256`.
    It may set a credit `limit` and an `expiration`; "The defaults are no credit limit and no
    expiry."
  - A page `POST`s the code and verifier to `https://openrouter.ai/api/v1/auth/keys` and gets
    `{key, user_id}`
    ([Exchange authorization code](https://openrouter.ai/docs/api/api-reference/oauth/exchange-authorization-code-for-api-key)).
  - Without a `callback_url`, "the page displays the authorization code on screen instead of
    redirecting. The user copies it and pastes it into your app"; the code "expires after 10
    minutes". **Inferred:** that suits the plugin, whose `app://` address can't be a callback.
    Custom-scheme callbacks aren't documented.
  - Then: "**Never persist it in browser-side storage such as `localStorage`, `sessionStorage`,
    IndexedDB, or cookies readable by JavaScript**: any script running on your origin can read
    them."

## 3. Each candidate against the checklist

| | xAI | Google (compatible) | OpenRouter | Mistral | DeepSeek | Ollama (local) |
| --- | --- | --- | --- | --- | --- | --- |
| Images | `image_url`, data URL or public URL; JPEG and PNG only; 20 MiB | `image_url` with a data URL | `image_url`; PNG, JPEG, WebP, GIF; count per model | Native: `image_url` as a plain string; 20 MB; PNG, JPEG, GIF, WebP | `image_url`; 32 MiB per image, 48 MiB per request; **`deepseek-flash` only** | base64 data URL only (JPEG, PNG, WebP); no image URLs |
| PDF in one request | Only `input_file` by URL or `file_id`, in Responses examples, read through a search tool billed per call | **Unverified** | `file` part, "works on **any** model"; parsed natively, else by `mistral-ocr` at $2 per 1,000 pages | Native: `document_url` with a base64 `data:` URL; 50 MB, 1,000 pages. Compatible endpoint: not stated | **`file_id` only**, after `POST /files`; parsing $0.225 per 1,000 pages | **No:** any `file` part is "invalid message format" |
| `json_schema` answer | Yes, `strict` | SDK helpers only on the page | Per model; `require_parameters: true` to insist | Yes, `strict`; the schema is also put in the prompt | **No:** `text` or `json_object` only | Yes, passed to Ollama's `format` |
| Discount on a repeated prefix | Automatic; `grok-4.7` cached input $0.50 vs $2.00 per MTok | Implicit on Gemini 2.5+, minimum 4,096 tokens (compatible endpoint **unverified**) | Passed through; sticky routing for 60 minutes | Automatic; 10% of the input price; 64-token blocks | Automatic; Flash $0.006 vs $0.30 per MTok | Not applicable |
| Free use, and training | No free tier stated. "Never trains on your API inputs or outputs without your explicit permission" | First note: the free tier trains, the paid tier doesn't | `:free` models, 50 requests a day (1,000 after $10 bought); free endpoints that train exist, behind an account setting | Free mode has **no API**; free `labs-*` models "Don't support data collection opt-out" | No free tier; a "granted balance". The privacy policy trains on data, with an opt-out | Local: nothing leaves the computer |
| Kept | 30 days by default; zero retention as a team switch | First note: 55 days | Not logged unless the user opts in | 30 days for abuse monitoring | "for as long as you have an account" | Not applicable |
| How long a model name lasts | No notice period; retired names redirect to a newer model | First note: no stated notice | `canonical_slug` "never changes"; `expiration_date` when deprecated | 6 months for GA, 1 month for preview and labs; retired names 404 | No policy; once 3 months' notice | The user's |
| Key format; model list | `xai-` (implied by an example); `GET /v1/models` | `GET /models` | `sk-or-v1-` + 64 hex characters; `GET /models` with no key | Not stated; `GET /v1/models` | Not stated; `GET /models` | No key; `GET /v1/models` |

Sources, by column:

- **xAI.** Images: [Image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding),
  [Models](https://docs.x.ai/developers/models). PDF:
  [Chat with files](https://docs.x.ai/developers/model-capabilities/files/chat-with-files),
  [Files](https://docs.x.ai/developers/files). Schema:
  [Structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs).
  Caching: [Prompt caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching), with
  prices from [Models](https://docs.x.ai/developers/models). Training and retention:
  [Security FAQ](https://docs.x.ai/developers/faq/security). Names:
  [May 15 retirement](https://docs.x.ai/developers/migration/may-15-retirement). Key and list:
  [Other endpoints](https://docs.x.ai/developers/rest-api-reference/inference/other),
  [Models endpoint](https://docs.x.ai/developers/rest-api-reference/inference/models). A $150 a
  month data-sharing credit is described by third parties only: **unverified**. xAI's terms and
  privacy policy: **unverified** (403).
- **Google.** [OpenAI compatibility](https://aistudio.google.com/docs/openai),
  [Caching](https://aistudio.google.com/docs/caching); the rest is in
  [`provider-apis.md`](provider-apis.md).
- **OpenRouter.** Images:
  [Image understanding](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding).
  PDF: [PDFs](https://openrouter.ai/docs/guides/overview/multimodal/pdfs). By default it uses "the
  model's native file processing… if that's not available, we will use the `mistral-ocr` engine",
  and "OCR costs apply to all requests, including BYOK". Schema:
  [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
  [Provider selection](https://openrouter.ai/docs/guides/routing/provider-selection). The two
  pages disagree on a model that lacks support: the first says the request "will fail with an
  error", the second that the parameter "is ignored". Caching:
  [Prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching). Free models
  and limits: [Free variant](https://openrouter.ai/docs/guides/routing/model-variants/free),
  [Limits](https://openrouter.ai/docs/api_reference/limits). Training:
  [Provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging),
  [Create a guardrail](https://openrouter.ai/docs/api/api-reference/guardrails/create-a-guardrail)
  (`enable_free_model_training`: "allows free endpoints that train on request data"). Logging:
  [Data collection](https://openrouter.ai/docs/guides/privacy/data-collection),
  [FAQ](https://openrouter.ai/docs/faq). Names: [Models](https://openrouter.ai/docs/api_reference/models).
  Key: [Authentication](https://openrouter.ai/docs/api_reference/authentication). Pricing: "no
  markup on inference pricing", and "a 5.5% ($0.80 minimum) fee when you purchase credits" (FAQ).
- **Mistral.** Images: [Vision](https://docs.mistral.ai/inference/conversations/vision),
  [Known limitations](https://docs.mistral.ai/resources/known-limitations). PDF:
  [Document QnA](https://docs.mistral.ai/studio/document-processing/document_qna). Schema:
  [Custom structured output](https://docs.mistral.ai/inference/conversations/structured-output/custom).
  Caching: [Prompt caching](https://docs.mistral.ai/inference/conversations/advanced/prompt-caching).
  Free use: [Usage limits](https://docs.mistral.ai/admin/billing-usage/usage-limits),
  [Model lifecycle](https://docs.mistral.ai/inference/model-lifecycle). Training on paid use is an
  opt-out ([Help](https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training));
  which default the API has is not stated on the pages read
  ([Commercial terms](https://legal.mistral.ai/terms/commercial-terms-of-service), §4.2). Kept:
  [Privacy policy](https://legal.mistral.ai/terms/privacy-policy). Names:
  [Model lifecycle](https://docs.mistral.ai/inference/model-lifecycle).
- **DeepSeek.** Images: [Vision](https://api-docs.deepseek.com/guides/vision),
  [Pricing](https://api-docs.deepseek.com/quick_start/pricing). PDF: "A document that needs
  parsing can be referenced only by `file_id`. Passing the file content or a file URL in the
  request is not supported"
  ([Document parsing](https://api-docs.deepseek.com/guides/document_parsing)). Schema:
  [Create chat completion](https://api-docs.deepseek.com/api/create-chat-completion),
  [JSON mode](https://api-docs.deepseek.com/guides/json_mode). Caching:
  [Context caching](https://api-docs.deepseek.com/guides/kv_cache). Training and retention:
  [Privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html), which says
  it doesn't cover end users of apps developers build. Names:
  [Updates](https://api-docs.deepseek.com/updates). List:
  [List models](https://api-docs.deepseek.com/api/list-models). The FAQ: **unverified**.
- **Ollama.** [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), and its
  source at commit `2bd4d6a` (2026-11-20):
  [`openai/openai.go`](https://raw.githubusercontent.com/ollama/ollama/2bd4d6aabdf4caa39e7095e201dcda4cc1a3a406/openai/openai.go)
  for images, the refused `file` part, `response_format` and the error body.
- **Groq, Together, Fireworks and Cerebras** each document Chat Completions at the base URL in
  item 1. Groq returns 400 on `logprobs`, `logit_bias` and `n` above 1
  ([API reference](https://console.groq.com/docs/api-reference)). Cerebras takes images only as
  base64 `data:` URLs
  ([OpenAI compatibility](https://inference-docs.cerebras.ai/resources/openai)). Fireworks model
  names are paths such as `accounts/fireworks/models/…`. Their prices, retention and training
  terms were not read.

## 4. What one reader of the stream and the errors has to handle

**The stream:**

- **Comment lines.** OpenRouter sends `: OPENROUTER PROCESSING`, and says to "skip lines that start
  with `:` before calling `JSON.parse`"
  ([Streaming](https://openrouter.ai/docs/api_reference/streaming)). DeepSeek sends `: keep-alive`
  while a request waits, and closes the connection if inference hasn't started after 10 minutes
  ([Rate limit](https://api-docs.deepseek.com/quick_start/rate_limit)).
- **An error after a 200.** OpenRouter: once headers are sent, "the `200 OK` status is committed",
  and the stream ends with a chunk carrying a top-level `error` and `finish_reason: "error"`
  ([Streaming](https://openrouter.ai/docs/api_reference/streaming)); a non-streaming answer can
  also carry an `error` "even on a `200`"
  ([Errors and debugging](https://openrouter.ai/docs/api_reference/errors-and-debugging)).
- **Reasoning text in its own field.** xAI and DeepSeek put it in `delta.reasoning_content`
  ([xAI streaming](https://docs.x.ai/developers/model-capabilities/text/streaming),
  [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode)), which a reader
  that takes only `delta.content` ignores. Mistral's own format turns `content` into a **list** of
  chunks while a model reasons
  ([Reasoning](https://docs.mistral.ai/inference/conversations/reasoning)); how its compatible
  endpoint shows reasoning isn't stated.
- **The usage arrives differently:** a last chunk with empty `choices` at OpenAI; on the last
  content chunk at DeepSeek, with no separate chunk; at OpenRouter, a chunk that "repeats the
  `finish_reason`"; and at Mistral only if `include_usage` "must be explicitly set"
  ([Known limitations](https://docs.mistral.ai/resources/known-limitations)).
- **Cached tokens** are reported as `usage.prompt_tokens_details.cached_tokens` by OpenRouter, xAI
  and Mistral, and as `prompt_cache_hit_tokens` by DeepSeek (sources in item 3).
- **Stopping a stream:** OpenRouter says that cutting the connection "immediately stops model
  processing and billing" for some providers, and not for others, Groq, Google AI Studio and
  Mistral among them ([Streaming](https://openrouter.ai/docs/api_reference/streaming)). The first
  note found the same of Anthropic: a dropped request "is still charged".

**The five error bodies seen** (all **observed**, wrong key):

| Shape | Who |
| --- | --- |
| `{"error":{"message", "type", "code", "param"}}` | OpenAI, DeepSeek, Groq, Together, Anthropic (compatible), Ollama (from its source) |
| `{"error":{"message", "code": <number>}}` | OpenRouter |
| `[{"error":{"code": <number>, "message", "status"}}]`, an array | Google (compatible) |
| `{"code", "error": "<message>"}`, the message as a string | xAI |
| `{"detail": "<message>"}` | Mistral |
| `{"message", "type", "param", "code"}`, with no `error` wrapper | Cerebras |

That is six rows and five ways to find the message: `error.message`, the first item's
`error.message`, `error` as a string, `detail`, and `message`.

## 5. A local model

### The browser's rules

- **Loopback isn't mixed content.** "If origin's host matches one of the CIDR notations
  127.0.0.0/8 or ::1/128, return 'Potentially Trustworthy'"; `localhost` counts too when the
  browser never resolves it off the machine
  ([Secure Contexts](https://w3c.github.io/webappsec-secure-contexts/), editor's draft).
  "A request is mixed content if its URL is not a potentially trustworthy URL"
  ([Mixed Content](https://w3c.github.io/webappsec-mixed-content/), editor's draft). Microsoft:
  "localhost is considered a secure origin by the mixed content specification and won't be blocked
  as mixed content"
  ([Edge local network access](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)).
  **Inferred:** an `http://` address on another machine of the local network *is* mixed content
  from the HTTPS web app, and is blocked.
- **Chrome asks the user once.** "The Local Network Access permission prompt is launching in
  Chrome 142"; a local network request is "any request *from* the public network *to* a local
  network or loopback destination"
  ([Chrome blog](https://developer.chrome.com/blog/local-network-access)). "This permission is
  restricted to secure contexts"
  ([Chrome status](https://chromestatus.com/feature/5152728072060928)). Chrome 145 split it into
  `local-network` and `loopback-network`
  ([Chrome status](https://chromestatus.com/feature/5068298146414592)).
- **How a page should make the call,** from
  [Chrome's guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access):
  - pass `fetch(url, {targetAddressSpace: 'loopback'})` for an `https://` page calling `http://`
    loopback;
  - make the first request from a user gesture;
  - check first with `navigator.permissions.query({name: 'loopback-network'})`, and never query
    `'local-network-access'`, which crashes older Chrome versions;
  - send no Private Network Access headers ("PNA preflights were never enforced");
  - ordinary CORS is still required.
- **Edge:** "Local Network Access restrictions will start shipping by default in Microsoft Edge
  143", and "the permission prompt is triggered when a connection is made to a destination on the
  local network or localhost"
  ([Edge local network access](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)).
- **Firefox:** "now enabled by default for all users" in 153, 2026-07-21
  ([Firefox 153 release notes](https://www.firefox.com/en-US/firefox/153.0/releasenotes/)).
  Mozilla's support article couldn't be read: **unverified**.
- **Safari:** not researched.

**Inferred:** in the web app, the Send that first reaches a local model comes with a browser
permission prompt, and Send is a user gesture.

### What the local servers allow

- **Ollama's default origins,** from its source
  ([`envconfig/config.go`](https://raw.githubusercontent.com/ollama/ollama/2bd4d6aabdf4caa39e7095e201dcda4cc1a3a406/envconfig/config.go),
  commit `2bd4d6a`): `http://` and `https://` on `localhost`, `127.0.0.1` and `0.0.0.0` with any
  port, then `app://*`, `file://*`, `tauri://*`, `vscode-webview://*` and `vscode-file://*`.
  `OLLAMA_ORIGINS` adds to these. The FAQ names only `127.0.0.1` and `0.0.0.0`
  ([FAQ](https://docs.ollama.com/faq)), so the source is the fuller list.
  - **Inferred:** the plugin on a computer is allowed by default, if Obsidian's origin is
    `app://obsidian.md` (#258 checks).
  - **Inferred:** the hosted web app is refused until the user sets `OLLAMA_ORIGINS` to its
    address and restarts Ollama. What Ollama answers a refused origin wasn't run (Ollama isn't
    installed here).
- **LM Studio:** "When not set, CORS is disabled", and turning it on is a `--cors` flag or a
  setting; "we recommend enabling authentication". It binds `127.0.0.1` by default, and without
  `--port` "uses the last used port"
  ([`lms server start`](https://lmstudio.ai/docs/cli/server-start),
  [Server settings](https://lmstudio.ai/docs/developer/core/server/settings)).
- **From Obsidian:** whether a plugin's `fetch` to `http://localhost` is allowed, and with which
  origin, wasn't run here. It is already on the hand check (#258).

## 6. What the app can check about a typed address before Send

With no request, a page can only read the address's form. **Inferred**, from the rules above:

- **It parses** as a URL (`new URL(…)`).
- **The scheme is `https:`**, because the key goes in a header and an `http:` request carries it in
  the clear. **Or `http:` with a loopback host:** `localhost`, `127.0.0.0/8` or `[::1]`. That
  allows a local model, and any other `http:` address is mixed content in the web app anyway
  (item 5).
- **No user name or password** in it (`https://user:pass@host`). Fetch refuses such a URL for a
  request: "If parsedURL includes credentials, then throw a TypeError"
  ([Fetch standard, Request constructor](https://fetch.spec.whatwg.org/#dom-request)).
- **The path is the base URL.** The app appends `/chat/completions` and `/models`, so a trailing
  `/` is dropped and a query or fragment has no use.
- **What it can't check without a request:** that the host exists, that it speaks Chat
  Completions, that it is the provider the user meant, or that it is not a look-alike host that
  would receive the key. **Inferred:** the first Send is the first time the key goes to that
  host, and the "Goes with your message" line is where the address can be shown.
- **The web app has no Content Security Policy today** (none in `index.html`, `vite.config.ts` or
  `public/`), so nothing in the page limits which host it may call. **Inferred:** if one is ever
  added, its `connect-src` can't list a typed address in advance.

## 7. The size of a hand-written adapter

- **What was measured.** Three throwaway TypeScript files, nothing committed:
  - a shared server-sent-events reader that skips `:` comment lines, plus an error reader for the
    five shapes in item 4;
  - a Chat Completions adapter: any base URL, a Bearer key, text, image and PDF parts,
    `include_usage`, an optional `json_schema`, a top-level `error` in the stream, and
    `GET /models`;
  - an Anthropic Messages adapter: the opt-in header, the system text marked for caching, image
    and PDF blocks, `output_config.format`, and the named events.
- **How it was measured.** Bundled with esbuild 0.28.2 (the repo's version) and the plugin's own
  settings from `esbuild.plugin.mjs`: `format: 'cjs'`, `platform: 'browser'`, `target: es2022`,
  `minify: true`. It type-checks with `--strict`.

| Bundle | Minified | Gzipped |
| --- | --- | --- |
| Chat Completions adapter with the shared reader | 2,573 bytes | 1,320 bytes |
| Anthropic adapter with the shared reader | 2,489 bytes | 1,275 bytes |
| Both, sharing the reader | 3,825 bytes | 1,664 bytes |

- **Against the budget.** `main.js`'s budget is 3,574,000 bytes, and the Português build measured
  3,447,773 bytes (spec section 14, #263), which leaves 126,227 bytes. **Inferred:** two adapters
  take about 3% of that, and a third, for Google's own API, would be of the same order. The first
  note measured each official SDK at 387 to 450 KB.
- **What it leaves out:** retries, the Responses API, tool calls, and the per-provider quirks
  above beyond comments and in-stream errors. It is a size estimate, not the build.

## Not verified

1. **A successful request** at any of the candidates: no valid key. The streamed chunk shapes
   come from the docs, not from a run.
2. **Whether a successful answer carries `Access-Control-Allow-Origin`** on OpenAI and Cerebras,
   whose wrong-key errors didn't.
3. **PDFs through Google's compatible endpoint,** and whether its implicit caching applies there.
4. **PDFs through Mistral's compatible endpoint** and through xAI's Chat Completions.
5. **Ollama's answer to a refused origin,** and any call from Obsidian to `http://localhost`.
6. **What Obsidian sends as its `Origin`** (on the hand check, #258).
7. **Whether Azure's v1 API takes a Bearer key.**
8. **xAI's terms and privacy policy** (403), **DeepSeek's FAQ** (no readable page), **Mozilla's
   support article** on local network access, and **Safari**.
9. **Mistral's default for training on paid API use:** the terms set it by product, and the pages
   read don't say which default the API has.
10. **Groq's, Together's, Fireworks's and Cerebras's** prices, retention and training terms.
11. **Whether DeepSeek's and the others' wording on keys in client code covers a key the user
    brings.** It is a legal reading.

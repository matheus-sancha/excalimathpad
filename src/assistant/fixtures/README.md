# The adapters' fixtures

Answers from providers, one set per adapter (docs/spec-v1.md section 14, 0.7.0, Fixtures), read
by `src/assistant/adapters.test.ts` through a fake `request` port. Each file is:

```
# where it is from: "from documentation, <date>, <link>" or "recorded <date> from <host>"
# any note
HTTP <status>
<header>: <value>

<the body, byte for byte>
```

`npm run assistant:record` (`scripts/assistant-record.mjs`) re-records the ones a real provider
can be asked for, by hand, with the key in `ASSISTANT_KEY`; it takes the key and account ids out,
and writes nothing when the key is refused. `messages/answer-pieces.http`, an answer in two
pieces, is never re-recorded: the tests of text as it arrives and of an abort need it.
A test fails if any file here holds text shaped like a key.

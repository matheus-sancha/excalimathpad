# Security

Excalimathpad promises that your data stays yours. Until you set up the Math assistant, the Obsidian plugin makes no network requests and the web app sends your sheets nowhere; with it, a sheet goes only to the provider you chose, only when you press Send, and the plugin keeps nothing outside your vault but that setup in Obsidian's keychain (see [Privacy](README.md#privacy)). A way to break that promise is a security problem. So is anything that lets a sheet run code beyond its math, or reach a file other than the ones the README's Privacy section names.

## Report a vulnerability

Please report it privately, through GitHub's private vulnerability reporting:

1. Open the repository's [**Security** tab](https://github.com/matheus-sancha/excalimathpad/security).
2. Choose **Report a vulnerability** ([direct link](https://github.com/matheus-sancha/excalimathpad/security/advisories/new)).
3. Describe the problem and how to reproduce it. A sheet that shows it helps.

Please don't open a public issue, a pull request or a discussion about it until a fix is released.

## What to expect

- Excalimathpad is free and best effort, so there is no response time. A security report comes before other work.
- The fix ships in the next release. The advisory is published once that release is out, with credit to you if you want it.

## Supported versions

Only the latest release is supported, for the plugin and for the web app at <https://excalimathpad.pages.dev>.

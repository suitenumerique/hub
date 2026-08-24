All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 🏗️(frontend) Initialize the Hub frontend project
- 🏗️(frontend) Initialize unit tests setup
- 🏗️(frontend) Initialize end-to-end (e2e) tests setup
- ✨(frontend) Add chat layout with LeftPanel and virtualized chat view
- ✨(frontend) Add message reactions bar with reaction toggle and emoji picker
- ✨(frontend) Add conversation threads with tools panel and unread banner
- ✨(frontend) Add new conversation page logic
- ✨(frontend) Open conversation when sending to it from the new chat search
- ✨(docker) Add a local dev-only Matrix stack with Keycloak auth and seed
- ✨(docker) Add a Matrix reset command with users-only provisioning
- ✨(frontend) Add the local Matrix frontend runtime with lazy MAS/OIDC client
  setup
- ✨(frontend) Bridge Matrix `/sync` onto the real-time chat event stream
- ✨(frontend) Send text messages from the Hub to Matrix conversations
- ✨(frontend) Start a new Matrix conversation from the new chat search
- ✨(frontend) Accept and refuse incoming Matrix invitations
- ✨(frontend) Add Matrix unread indicators and read receipts
- ✨(frontend) Add Matrix thread reading, replies, and creation
- ✨(frontend) Add Matrix reactions on conversation and thread timelines
- ✨(frontend) Add read-only chat members and conversation favourites
- ✨(frontend) Leave and forget conversations from the chat header

### Changed

- ♻️(frontend) Use the local Matrix account as the sole chat runtime
- ♻️(frontend) Show Documents as unavailable until Matrix media support lands
- ♻️(frontend) Simplify the conversation auto-scroll onto the Virtuoso API
- 💄(frontend) Use the brand color for the current user's message bubbles

### Fixed

- 🐛(frontend) Show an error toast when a chat message fails to send
- 🐛(frontend) Reset the composer draft when switching conversation
- 🌐(frontend) Translate the current user's optimistic thread author

[unreleased]: https://github.com/suitenumerique/docs/compare/main

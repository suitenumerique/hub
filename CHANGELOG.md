All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ✨(frontend) Add real-time Matrix presence and availability controls
- ✨(bots) Add Ariane, an assistant reachable from any room with `@Ariane`.
  She answers only when addressed, reads the thread and the recent room
  history for context, and changes register with `/juriste`, `/avocat`,
  `/po` and `/pm`. Answers come from the Albert API, from the server only.
  The context is cut at the asker's own history horizon, so she never
  summarises messages they are not allowed to read. `/aide` lists the
  commands and states what she reads.
- ✨(frontend) Suggest room members with `@` and assistant commands with `/`
  in the message composer. The list follows the ARIA combobox pattern and is
  usable with a screen reader.
- ✨(frontend) Show real profile/group photos in the account menu, chat
  header and members list. Reorder the account menu, add Direct messages
  filter tabs, and fix the language picker only applying French.
- ✨(frontend) Search joined conversations by name and current participants.
  Persist the search index separately and prepare small rooms progressively.
  Add a QuickSearch modal with local results across connected accounts.
  Open search from any page with Cmd+K or Ctrl+K.
- ✨(search) Search message content alongside conversations, with
  Discord-style filters (`from:`, `mentions:`, `has:`, `before:`/`during:`/
  `after:`). Show matches in a "Messages" section of the search modal with
  highlighted excerpts.
- ✨(search) Persist the message search index to IndexedDB so it survives a
  page reload. Backfill a room's older history (up to 200 messages or 90
  days, whichever comes first) automatically when it is opened, or on demand
  per room from the search modal, with indexing progress shown per room.
- ✨(frontend) Notify incoming messages, thread replies and invitations.
  Play sound on receipt and show browser notifications when Hub is unfocused.
  Request permission on incoming activity with a user-gesture fallback.
  Preload audio on arrival without replaying missed alerts.
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
- ✨(frontend) Add Matrix first-unread separator and anchored navigation

### Changed

- ✨(frontend) Expand the message composer up to eight lines
- ⚡(frontend) Speed up the emoji picker and align reaction artwork
- 💄(frontend) Improve message dates and bubble readability
- 💄(frontend) Align the sidebar branding and account controls with Tchap
- ♻️(frontend) Streamline the new-chat conversation flow
- ⬆️(frontend) Migrate to ui-components 1.0.0
- ♻️(frontend) Use the local Matrix account as the sole chat runtime
- ♻️(frontend) Show Documents as unavailable until Matrix media support lands
- ♻️(frontend) Simplify the conversation auto-scroll onto the Virtuoso API
- 💄(frontend) Use the brand color for the current user's message bubbles
- 🔥(frontend) Remove the meeting entry from the side panel quick actions

### Fixed

- 🐛(frontend) Restore unread navigation in conversations without a read marker
- 🐛(frontend) Keep the thread root message toolbar fully accessible
- 🐛(frontend) Follow Matrix timeline and count updates for deleted thread
  replies
- 🐛(frontend) Focus the thread composer whenever Reply is clicked
- 🐛(frontend) Keep the thread composer compact when opening the tools panel
- 🐛(frontend) Restore edit and delete actions on newly sent thread replies
- 🐛(frontend) Resolve newly sent messages before editing or deleting them
- 🐛(frontend) Restore message content when an optimistic edit or deletion
  fails
- 🐛(frontend) Keep modals above chat headers and messages below them
- 🐛(frontend) Show an error toast when a chat message fails to send
- 🐛(frontend) Reset the composer draft when switching conversation
- 🐛(frontend) Reuse pending direct invitations when starting a conversation
- 🌐(frontend) Translate the current user's optimistic thread author
- 🐛(search) Fix lint errors in the message search engine (unused imports,
  unused parameter, `any` types)
- 🎨(search) Run Prettier on the message search files

[unreleased]: https://github.com/suitenumerique/docs/compare/main

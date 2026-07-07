All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 🏗️(frontend) Initialize the Hub frontend project
- 🏗️(frontend) Initialize unit tests setup
- 🏗️(frontend) Initialize end-to-end (e2e) tests setup
- ✨(frontend) Add chat layout with LeftPanel and virtualized conversation view
- ✨(frontend) Add tool panel with document list
- ✨(frontend) Add file preview (PDF, image, video, audio) from the tools panel
- ✨(frontend) Add message reactions bar with reaction toggle and emoji picker
- ✨(frontend) Add conversation threads with tools panel and unread banner
- ✨(frontend) Add new conversation page logic
- ✨(frontend) Add mocked chat message composition and thread replies
- ✨(frontend) Open conversation when sending to it from the new chat search
- ✨(docker) Add a local dev-only Matrix stack (Synapse + MAS + Element) delegating auth to Keycloak
- ✨(frontend) Make the Matrix driver config-driven and add a seedable `matrix-local` chat scope
- ✨(frontend) Enable sending text messages on the Matrix driver, deduplicated against the `/sync` echo
- ✨(frontend) Support Matrix threads, reactions and read receipts in the Matrix driver (documents stay mocked)
- ✨(frontend) Back the New Chat people search and existing-conversation resolution with the live Matrix client (user directory + participant-set room match), seeding extra users and a DM/group room for hand-testing
- ✨(frontend) Start a brand-new direct or group conversation from the New Chat search: the composer enables once people are chosen (Enter focuses it), and the first message creates the conversation (a real Matrix room) before sending
- ✨(frontend) Show an unread dot (mention-highlighted) on chat conversations, derived from read receipts, kept in a dedicated event-driven slice decoupled from the message and conversation-list caches, and marked read only while the conversation is actually viewed (focused + scrolled to the bottom)
- ✨(frontend) Surface incoming Matrix invitations as chat-list rows opened into an accept/refuse detail view (envelope identity, inviter, date, reason) instead of auto-joining them, with the local `matrix-local` account kept pending and a seeded invitation for hand-testing

### Changed

- ♻️(frontend) Simplify the conversation auto-scroll onto the Virtuoso API

### Fixed

- 🐛(frontend) Show an error toast when a chat message fails to send
- 🐛(frontend) Reset the composer draft when switching to another conversation
- 🌐(frontend) Translate the current user's optimistic thread author
- 🐛(frontend) Re-open a cached conversation instantly (jump to the latest message instead of smooth-scrolling on every switch)
- 🐛(frontend) Name Matrix conversations from their members: a 1:1 shows the other person and ignores any room name (not a renameable salon), and an un-named group shows every member instead of only the first; the local seed now creates two 1:1s and one un-named group (no invitation by default)
- 🐛(frontend) Load a Matrix room's prior history when accepting an invitation — wait for the joined room's timeline to sync before the conversation reads it, instead of opening on an empty timeline

[unreleased]: https://github.com/suitenumerique/docs/compare/main

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
- ✨(frontend) Add tool panel with document list
- ✨(frontend) Add file preview (PDF, image, video, audio) in the tools panel
- ✨(frontend) Add message reactions bar with reaction toggle and emoji picker
- ✨(frontend) Add conversation threads with tools panel and unread banner
- ✨(frontend) Add new conversation page logic
- ✨(frontend) Add mocked chat message composition and thread replies
- ✨(frontend) Open conversation when sending to it from the new chat search
- ✨(docker) Add a local dev-only Matrix stack with Keycloak auth and seed
- ✨(frontend) Add the local Matrix frontend scope with lazy MAS/OIDC client
  setup

### Changed

- ♻️(frontend) Simplify the conversation auto-scroll onto the Virtuoso API

### Fixed

- 🐛(frontend) Show an error toast when a chat message fails to send
- 🐛(frontend) Reset the composer draft when switching conversation
- 🌐(frontend) Translate the current user's optimistic thread author

[unreleased]: https://github.com/suitenumerique/docs/compare/main

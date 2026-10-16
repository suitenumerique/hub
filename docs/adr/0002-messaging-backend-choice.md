# 2. Which instant messaging backend to use for the project

Date: 2026-07-30 (actually decided during june 2026, but not recorded at the time)

## Status

Accepted

## Context

We need to choose an instant messaging backend for the project. Several options are available:
 - Use Matrix as we already use it in LaSuite Tchap;
 - Use an existing solution like Rocket.Chat (https://rocket.chat/) or Mattermost (https://mattermost.com/)
 - Make our own implementation using Centrifugo (https://github.com/centrifugal/centrifugo)

## Decision

While we thought about using Centrifugo, decision has been made to use Matrix as
the instant messaging backend for the project.

Because:
 - We already use Matrix in LaSuite Tchap, so we have experience with it;
 - We already operate several Matrix homeservers at scale, so we have the infrastructure in place;
 - Mobile application already exist for Tchap ad should be reused for the project, even if all Hub
   features will not be available in the first version of the project;
 - "GET /groups" API endpoint can be easily implemented in Matrix.
 - External user management will be improved in Tchap and will be helpful for the project.

Also, even if the first implementation will use Matrix, we want keep the possibility to switch to
another solution in the future if needed.


## Consequences

Use Matrix as the instant messaging backend for the project.

[EDIT : 2026-07-30] Implementation is not straightforward, the way to "get groups" is not possible
in Matrix. See future ADR for the solution we will implement to get groups from Matrix.

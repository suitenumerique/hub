# 3. Instant messaging backend implementation

Date: 2026-07-30

## Status

Draft

## Context

We want to create a hub which can be compatible not only with Matrix even if our first implementation will use Matrix
as instant messaging backend. We want to keep the possibility to switch to another solution in the future if needed.

We need to be able to:
 - Get the list of groups the user is member of:
   this allows a product to transform a group permission into a user permission,
   "if I'm member of group A and group A ha editor access on document X,
   then I have editor access on document X";
 - Get the list of users in a group:
   this allows "My Account" to display the list of users in a group;
 - Add/remove users from a group:
   Ownership of the group is in the instant messaging backend. But for Matrix we will need an adapter...
 - Send a message to a group: the instant messaging backend manages this
 - Receive messages from a group: the instant messaging backend manages this
 - Create a group:
   Ownership of the group is in the instant messaging backend. But for Matrix we will need an adapter...
 - Manage user rights in a group:
   Ownership of the group is in the instant messaging backend. But for Matrix we will need an adapter...

Addressing the Matrix adapter requires to find a we to keep information up to date between the Hub and Matrix,
because users can be added/removed from the Hub, but also directly in Matrix and we need to keep the information
up to date in both systems.

### Matrix specific
We don't want to implement group management in the Hub, because the Hub purpose is only to provide
"conversations as groups", ie a conversation is reusable as a group in any product.

#### Group details
But current Matrix implementation does not allow to:
 - easily get the list of groups the user is member of. We can get the list of room IDs the user is member of,
   but room ID is not a stable identifier, it changes on each room update.
 - list other attributes (like alias or metadata) of "joined rooms", which prevents us to store a stable identifier
   as an alias or a metadata.
 - list details of "joined rooms"
To be able to do this we need to maintain a mapping between room ID and a stable identifier in the Hub database,
and the list of members.

**TODO :** define if we only need the membership information in the Hub, or if we need to store the "power level" also.

A Matrix Application Service could be used to maintain this mapping. Another solution could be to use a Matrix bot,
which would be a member of all rooms and would maintain the mapping.

**TODO :** define which mechanism to use to maintain this mapping, and how to implement it.

### Group membership management
Regarding user in room management, a limitation of Matrix/Tchap is that an admin user cannot remove another admin.
Even if this is a limitation of Matrix, we expect to improve this in the Hub. This requires to add a "Hub" bot,
with more power than admin in each rooms, so it can remove any user from a room, even if the user is an admin.


## Decision

The frontend uses a "driver" mechanism to be able to switch from one instant messaging backend to another.
The driver is a class which implements a common interface and is used by the frontend to communicate
with the instant messaging backend.

Code already exists in the frontend to use a driver.
The driver interface is currently in `src/frontend/apps/hub/src/features/drivers/Driver.ts`.

The backend will implement the same "driver" mechanism known as "backend".
Ideally, the backend should be nothing but a proxy between the frontend and the instant messaging backend.
For obvious reasons, the backend could implement simple logic to be able to properly talk to the
instant messaging backend, but the expected behavior is the frontend talking directly to the instant messaging backend.

### Configuration sharing between frontend and backend
We need to share driver/backend configuration between frontend and backend.
We will use a common configuration, provided by the backend, each configuration will have a unique identifier,
so the frontend knows which endpoint to call (either to call our backend or the instant messaging backend directly).

``` json
GET /api/v1.0/config/
{
    "drivers": [
        {
            "id": "matrix-tchap",
            "name": "Tchap",
            "driver-class": "MatrixDriver",
            "backend-class": "MatrixBackend",
            "driver-specific-setting-1": "some value...",
            "get-groups-url": "/api/v1.0/matrix-tchap/groups",
            ...
        }
    ]
}
```

TBD


## Consequences


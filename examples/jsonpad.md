# JSONPad schema

This document describes the lists, indexes and tokens that need to be set up in JSONPad in order to run the Asobi game server and client.

## Scripts

Some helper scripts are provided for setting up lists:

- `setup-games-list.js` creates or updates the games list and indexes
- `setup-players-list.js` creates or updates the players list and indexes
- `clear-list.js` clears all items from a list

## Lists

We need a list to store games.

- The list name can be anything
- The list can optionally have a path name (we could refer to the list by id instead, but using a path name is easier)
- The list must be indexable
- The list must have realtime enabled
- The list can have a schema (this is optional but recommended; see jsonpad-games-list-schema.json)

We should also have a list for players, their authorization tokens, and their hidden state.

- The list name can be anything
- The list can optionally have a path name (we could refer to the list by id instead, but using a path name is easier)
- The list should be indexable
- The list doesn't need to have realtime enabled
- The list can have a schema (this is optional but recommended; see jsonpad-players-list-schema.json)

## Indexes

The games list will need 3 indexes:

1. Status

- name can be anything
- pathname `status`
- pointer `/status`
- enable sorting and filtering
- value type: string
- default order direction: ascending

2. Started At

- name can be anything
- pathname `started`
- pointer `/startedAt`
- enable sorting and filtering
- value type: date
- default order direction: descending

3. Finished At

- name can be anything
- pathname `finished`
- pointer `/finishedAt`
- enable sorting and filtering
- value type: date
- default order direction: descending

The players list will need 3 indexes:

1. Player ID

- name can be anything
- pathname `player`
- pointer `/playerId`
- enable alias
- value type: string

2. Game ID

- name can be anything
- pathname `game`
- pointer `/gameId`
- enable filtering
- value type: string

3. Token

- name can be anything
- pathname `token`
- pointer `/token`
- enable filtering
- value type: string

## Tokens

We need 2 tokens: 1 for the server and 1 for the client.

The server token needs to be able to read and write items in both the games and players lists.

```json
[
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "list",
    "listIds": [
      "<GAMES LIST ID>",
      "<PLAYERS LIST ID>"
    ]
  },
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "item",
    "listIds": [
      "<GAMES LIST ID>",
      "<PLAYERS LIST ID>"
    ],
    "itemIds": [
      "*"
    ]
  },
  {
    "mode": "allow",
    "action": "create",
    "resourceType": "item",
    "listIds": [
      "<GAMES LIST ID>",
      "<PLAYERS LIST ID>"
    ]
  },
  {
    "mode": "allow",
    "action": "update",
    "resourceType": "item",
    "listIds": [
      "<GAMES LIST ID>",
      "<PLAYERS LIST ID>"
    ],
    "itemIds": [
      "*"
    ]
  }
]
```

The client token only needs to be able to read items in the games list.

```json
[
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "list",
    "listIds": [
      "<GAMES LIST ID>"
    ]
  },
  {
    "mode": "allow",
    "action": "view",
    "resourceType": "item",
    "listIds": [
      "<GAMES LIST ID>"
    ],
    "itemIds": [
      "*"
    ]
  }
]
```

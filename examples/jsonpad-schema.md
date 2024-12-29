# JSONPad schema

This document describes the lists, indexes and tokens that need to be set up in JSONPad in order to run the Asobi game server and client.

## Lists

We need a list to store games.

- The list name can be anything
- The list can optionally have a path name (we could refer to the list by id instead, but using a path name is easier)
- The list must be indexable
- The list must have realtime enabled
- The list can have a schema (this is optional but recommended):

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "waiting_to_start",
        "started",
        "completed"
      ]
    },
    "startedAt": {
      "anyOf": [
        {
          "type": "null"
        },
        {
          "type": "string",
          "format": "date-time"
        }
      ]
    },
    "finishedAt": {
      "anyOf": [
        {
          "type": "null"
        },
        {
          "type": "string",
          "format": "date-time"
        }
      ]
    },
    "lastEventType": {
      "type": "string",
      "enum": [
        "game-started",
        "game-finished",
        "player-joined",
        "player-moved"
      ]
    },
    "lastEventData": {},
    "numPlayers": {
      "type": "integer"
    },
    "players": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "enum": [
              "waiting_for_turn",
              "taking_turn",
              "finished"
            ]
          },
          "state": {}
        },
        "required": [
          "id",
          "name",
          "status"
        ]
      }
    },
    "moves": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "playerId": {
            "type": "string"
          },
          "movedAt": {
            "type": "string",
            "format": "date-time"
          },
          "data": {}
        },
        "required": [
          "playerId",
          "movedAt"
        ]
      }
    },
    "round": {
      "type": "integer"
    },
    "state": {}
  },
  "required": [
    "status",
    "startedAt",
    "finishedAt",
    "lastEventType",
    "lastEventData",
    "numPlayers",
    "players",
    "moves",
    "round",
    "state"
  ]
}
```

We should also have a list for players and their authorization tokens. This is optional since we can configure the server to store player tokens in memory instead, however:

- The memory list will be cleared if the server Node process restarts, losing all current tokens (making all currently running games unplayable)
- The memory list won't be shared across server instances if we want to scale the server horizontally

So it's recommended to use a list to store player tokens.

- The list name can be anything
- The list can optionally have a path name (we could refer to the list by id instead, but using a path name is easier)
- The list should not be indexable
- The list doesn't need to have realtime enabled
- The list can have a schema (this is optional but recommended):

```json
{
  "type": "object",
  "properties": {
    "playerId": {
      "type": "string"
    },
    "gameId": {
      "type": "string"
    },
    "token": {
      "type": "string"
    }
  },
  "required": [
    "playerId",
    "gameId",
    "token"
  ]
}
```

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

If we're using a player tokens list, then this list will need 1 alias index:

1. Player ID

- name can be anything
- pathname `player`
- pointer `/playerId`
- enable alias
- value type: string

## Tokens

We need 2 tokens: 1 for the server and 1 for the client.

The server token needs to be able to read and write items in the games list.

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
  },
  {
    "mode": "allow",
    "action": "create",
    "resourceType": "item",
    "listIds": [
      "<GAMES LIST ID>"
    ]
  },
  {
    "mode": "allow",
    "action": "update",
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

If we're using a player tokens list, then the server token also needs to be able to read, write, and delete items in this list.

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
  },
  {
    "mode": "allow",
    "action": "delete",
    "resourceType": "item",
    "listIds": [
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

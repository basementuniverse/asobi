# JSONPad schema

This document describes the lists, indexes and tokens that need to be set up in JSONPad in order to run the Asobi game server and client.

## Lists

We only need 1 list for each game. We could also use a single list for all games, with a `gameType` field and filterable index or similar to separate them.

- The list name can be anything
- The list needs a path name
- The list should be indexable
- The list should have realtime enabled
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

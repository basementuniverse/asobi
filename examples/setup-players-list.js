const playersListSchema = require('./jsonpad-players-list-schema.json');

const listName = process.argv[2];

// This token must have the following permissions:
// - read all lists (or the specified list)
// - create lists
// - update all lists (or the specified list)
// - read all indexes (or the specified list's indexes)
// - create indexes in all lists (or the specified list)
// - update all indexes (or the specified list's indexes)
const TOKEN = '<YOUR JSONPAD TOKEN>';

// Set this value to sleep for a certain number of milliseconds between
// requests to avoid hitting the JSONPad rate limit
// If you have an Enterprise subscription, then there is no rate limit in
// which case you can set this value to 0 or null
const RATE_LIMIT = 150;

if (!listName) {
  console.error('List name is required');
  process.exit(1);
}

async function sleep() {
  if (!RATE_LIMIT) {
    return;
  }
  return new Promise(resolve => setTimeout(resolve, RATE_LIMIT));
}

async function request(method, url, data) {
  const response = await fetch(
    url,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': TOKEN,
      },
      body: data ? JSON.stringify(data) : undefined,
    }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function fetchList(name) {
  return await request(
    'GET',
    `https://api.jsonpad.io/lists/${name}`
  );
}

async function createList(data) {
  return await request(
    'POST',
    `https://api.jsonpad.io/lists`,
    data
  );
}

async function updateList(list, data) {
  return await request(
    'PUT',
    `https://api.jsonpad.io/lists/${list.pathName}`,
    data
  );
}

async function fetchIndex(list, id) {
  return await request(
    'GET',
    `https://api.jsonpad.io/lists/${list.pathName}/indexes/${id}`
  );
}

async function createIndex(list, data) {
  return await request(
    'POST',
    `https://api.jsonpad.io/lists/${list.pathName}/indexes`,
    data
  );
}

async function updateIndex(list, id, data) {
  return await request(
    'PUT',
    `https://api.jsonpad.io/lists/${list.pathName}/indexes/${id}`,
    data
  );
}

(async () => {
  // Players list
  console.log('Setting up players list...');
  const playersListData = {
    name: listName,
    pathName: listName,
    indexable: true,
    schema: playersListSchema,
  };
  await sleep();
  let playersList = await fetchList(listName);
  if (playersList) {
    console.log('Players list already exists, updating...');
    await sleep();
    playersList = await updateList(playersList, playersListData);
  } else {
    console.log('Players list does not exist, creating...');
    await sleep();
    playersList = await createList(playersListData);
  }

  // Indexes
  // 1. Player index
  console.log('Setting up player index...');
  const playerIndexData = {
    name: 'Player ID',
    pathName: 'player',
    pointer: '/playerId',
    alias: true,
    valueType: 'string',
  };
  await sleep();
  let playerIndex = await fetchIndex(playersList, 'player');
  if (playerIndex) {
    console.log('Player index already exists, updating...');
    await sleep();
    playerIndex = await updateIndex(playersList, 'player', playerIndexData);
  } else {
    console.log('Player index does not exist, creating...');
    await sleep();
    playerIndex = await createIndex(playersList, playerIndexData);
  }

  // 2. Game index
  console.log('Setting up game index...');
  const gameIndexData = {
    name: 'Game ID',
    pathName: 'game',
    pointer: '/gameId',
    filtering: true,
    valueType: 'string',
  };
  await sleep();
  let gameIndex = await fetchIndex(playersList, 'game');
  if (gameIndex) {
    console.log('Game index already exists, updating...');
    await sleep();
    gameIndex = await updateIndex(playersList, 'game', gameIndexData);
  } else {
    console.log('Game index does not exist, creating...');
    await sleep();
    gameIndex = await createIndex(playersList, gameIndexData);
  }

  // 3. Token index
  console.log('Setting up token index...');
  const tokenIndexData = {
    name: 'Token',
    pathName: 'token',
    pointer: '/token',
    filtering: true,
    valueType: 'string',
  };
  await sleep();
  let tokenIndex = await fetchIndex(playersList, 'token');
  if (tokenIndex) {
    console.log('Token index already exists, updating...');
    await sleep();
    tokenIndex = await updateIndex(playersList, 'token', tokenIndexData);
  } else {
    console.log('Token index does not exist, creating...');
    await sleep();
    tokenIndex = await createIndex(playersList, tokenIndexData);
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

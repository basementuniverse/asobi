const gamesListSchema = require('./jsonpad-games-list-schema.json');

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
  // Games list
  console.log('Setting up games list...');
  const gamesListData = {
    name: listName,
    pathName: listName,
    indexable: true,
    realtime: true,
    schema: gamesListSchema,
  };
  await sleep();
  let gamesList = await fetchList(listName);
  if (gamesList) {
    console.log('Games list already exists, updating...');
    await sleep();
    gamesList = await updateList(gamesList, gamesListData);
  } else {
    console.log('Games list does not exist, creating...');
    await sleep();
    gamesList = await createList(gamesListData);
  }

  // Indexes
  // 1. Status index
  console.log('Setting up status index...');
  const statusIndexData = {
    name: 'Status',
    pathName: 'status',
    pointer: '/status',
    sorting: true,
    filtering: true,
    valueType: 'string',
    defaultOrderDirection: 'asc',
  };
  await sleep();
  let statusIndex = await fetchIndex(gamesList, 'status');
  if (statusIndex) {
    console.log('Status index already exists, updating...');
    await sleep();
    statusIndex = await updateIndex(gamesList, 'status', statusIndexData);
  } else {
    console.log('Status index does not exist, creating...');
    await sleep();
    statusIndex = await createIndex(gamesList, statusIndexData);
  }

  // 2. Started index
  console.log('Setting up started index...');
  const startedIndexData = {
    name: 'Started At',
    pathName: 'started',
    pointer: '/startedAt',
    sorting: true,
    filtering: true,
    valueType: 'date',
    defaultOrderDirection: 'desc',
  };
  await sleep();
  let startedIndex = await fetchIndex(gamesList, 'started');
  if (startedIndex) {
    console.log('Started index already exists, updating...');
    await sleep();
    startedIndex = await updateIndex(gamesList, 'started', startedIndexData);
  } else {
    console.log('Started index does not exist, creating...');
    await sleep();
    startedIndex = await createIndex(gamesList, startedIndexData);
  }

  // 3. Finished index
  console.log('Setting up finished index...');
  const finishedIndexData = {
    name: 'Finished At',
    pathName: 'finished',
    pointer: '/finishedAt',
    sorting: true,
    filtering: true,
    valueType: 'date',
    defaultOrderDirection: 'desc',
  };
  await sleep();
  let finishedIndex = await fetchIndex(gamesList, 'finished');
  if (finishedIndex) {
    console.log('Finished index already exists, updating...');
    await sleep();
    finishedIndex = await updateIndex(gamesList, 'finished', finishedIndexData);
  } else {
    console.log('Finished index does not exist, creating...');
    await sleep();
    finishedIndex = await createIndex(gamesList, finishedIndexData);
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

// This script will delete all items in a list
// Usage: node clear-list.js <list-name> [filter]

const listName = process.argv[2];
const filter = process.argv[3];

// This token must have the following permissions:
// - read items in the specified list
// - delete items from the specified list
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

let n = 0;
do {
  fetch(
    `https://api.jsonpad.io/lists/${listName}/items${filter ? `?${filter}` : ''}`,
    {
      headers: {
        'x-api-token': TOKEN,
      }
    }
  )
    .then(response => response.json())
    .then(async (json) => {
      console.log(`Found ${json.total} items in list ${listName}`);
      n = json.total;

      await sleep();

      for (const item of json.data) {
        await fetch(
          `https://api.jsonpad.io/lists/${listName}/items/${item.id}`,
          {
            method: 'DELETE',
            headers: {
              'x-api-token': TOKEN,
            },
          }
        );
        console.log(`Deleted item ${item.id}`);

        await sleep();
      }
    });
} while (n > 0);

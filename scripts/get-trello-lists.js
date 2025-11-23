// Quick script to fetch Trello lists and find the List ID
// Load environment variables from .env file
import 'dotenv/config';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID;

async function getLists() {
  // Validate environment variables
  if (!TRELLO_API_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
    console.error('\n❌ Error: Missing required environment variables');
    console.error('Please ensure the following are set in your .env file:');
    console.error('  - TRELLO_API_KEY');
    console.error('  - TRELLO_TOKEN');
    console.error('  - TRELLO_BOARD_ID');
    console.error('\nSee .env.example for reference.\n');
    process.exit(1);
  }

  const url = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;

  try {
    const response = await fetch(url);

    console.log('Response status:', response.status);

    const text = await response.text();
    console.log('Response body:', text);

    if (!response.ok) {
      console.error(`\n❌ Error: Trello API returned ${response.status}`);
      console.error('This usually means the API key or token is invalid.\n');
      return;
    }

    const lists = JSON.parse(text);

    console.log('\nYour Trello Lists:\n');
    lists.forEach(list => {
      console.log(`Name: "${list.name}"`);
      console.log(`ID: ${list.id}`);
      console.log('---');
    });

    const feedbackList = lists.find(list => list.name === 'TBR Feedback');
    if (feedbackList) {
      console.log(`\n✅ Found "TBR Feedback" list!`);
      console.log(`Use this for TRELLO_LIST_ID: ${feedbackList.id}\n`);
    } else {
      console.log(`\n⚠️  No list named "TBR Feedback" found.`);
      console.log(`Available lists are shown above.\n`);
    }
  } catch (error) {
    console.error('Error fetching lists:', error.message);
  }
}

getLists();

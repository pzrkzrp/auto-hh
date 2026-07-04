/**
 * One-time migration: adds userId: null to all existing documents.
 * Run: npx tsx scripts/migrate-to-multitenant.ts
 */
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/autohh';
const DB = new URL(URI).pathname.replace('/', '') || 'autohh';

const COLLECTIONS = [
  'cachePages',
  'cacheFull',
  'cacheJudgements',
  'cacheCoverLetters',
  'history',
  'digest',
  'rejected',
  'resumes',
];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);
  console.log(`Connected to ${DB}`);

  for (const colName of COLLECTIONS) {
    const col = db.collection(colName);
    const total = await col.countDocuments();
    if (total === 0) {
      console.log(`  ${colName}: empty, skip`);
      continue;
    }
    const missing = await col.countDocuments({ userId: { $exists: false } });
    if (missing === 0) {
      console.log(`  ${colName}: ${total} docs, all have userId`);
      continue;
    }
    const result = await col.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: null } },
    );
    console.log(`  ${colName}: ${total} total, ${result.modifiedCount} updated (userId → null)`);
  }

  // Create indexes for new collections
  await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection('user_configs').createIndex({ userId: 1 }, { unique: true, sparse: true });
  await db.collection('search_jobs').createIndex({ userId: 1 });
  await db.collection('search_jobs').createIndex({ status: 1 });
  await db.collection('apply_queue').createIndex({ userId: 1, status: 1 });
  await db.collection('grade_results').createIndex({ userId: 1 });
  console.log('Indexes created');

  await client.close();
  console.log('Done.');
}

main().catch(console.error);

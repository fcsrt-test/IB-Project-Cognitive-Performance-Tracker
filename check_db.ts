import { db, initDb } from './src/db/database';

console.log('Checking database state...');

try {
  // Force init to ensure seeding runs if needed
  initDb();

  const setCheck = db.prepare('SELECT count(*) as count FROM test_sets').get() as { count: number };
  console.log('Test Sets count:', setCheck.count);

  const termCheck = db.prepare('SELECT count(*) as count FROM terms').get() as { count: number };
  console.log('Terms count:', termCheck.count);

  const sets = db.prepare('SELECT * FROM test_sets').all();
  console.log('Sets:', sets);

  if (sets.length > 0) {
    const terms = db.prepare('SELECT * FROM terms WHERE set_id = ? LIMIT 5').all((sets[0] as { id: number }).id);
    console.log('Sample terms from first set:', terms);
  }

} catch (error) {
  console.error('Error checking DB:', error);
}

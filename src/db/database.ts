import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const db = new Database('app.db');

export function initDb() {
  console.log('Initializing database...');
  try {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Test Sets (to ensure we don't repeat the same words)
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);

    // Words/Terms
    db.exec(`
      CREATE TABLE IF NOT EXISTS terms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        term TEXT NOT NULL,
        FOREIGN KEY (set_id) REFERENCES test_sets(id)
      )
    `);

    // Results
    db.exec(`
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        test_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        score INTEGER NOT NULL,
        total_items INTEGER NOT NULL,
        set_id INTEGER NOT NULL,
        details JSON,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (set_id) REFERENCES test_sets(id)
      )
    `);

    // Surveys
    db.exec(`
      CREATE TABLE IF NOT EXISTS surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        result_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        age_group TEXT,
        previous_test TEXT,
        q_instructions INTEGER,
        q_tasks INTEGER,
        q_comfort INTEGER,
        q_length INTEGER,
        q_language INTEGER,
        q_visuals INTEGER,
        q_comparison INTEGER,
        q_recommend INTEGER,
        test_duration TEXT,
        liked_most TEXT,
        liked_least TEXT,
        suggestions TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (result_id) REFERENCES results(id)
      )
    `);

    console.log('Tables created/verified.');

    // Seed data if empty or incorrect count
    const termCheck = db.prepare('SELECT count(*) as count FROM terms').get() as { count: number };
    console.log(`Current term count: ${termCheck.count}`);
    
    if (termCheck.count < 48) {
      console.log('Term count < 48, triggering seedData...');
      seedData();
    }
  } catch (error) {
    console.error('Error in initDb:', error);
  }
}

export function seedData() {
  console.log('Seeding database...');
  
  // We need 12 categories with 4 words each = 48 words total
  const sets = [
    {
      name: 'Standard Set',
      items: [
        // 1. Fruit
        { category: 'Fruit', term: 'Apple' },
        { category: 'Fruit', term: 'Banana' },
        { category: 'Fruit', term: 'Cherry' },
        { category: 'Fruit', term: 'Grape' },
        // 2. Insect
        { category: 'Insect', term: 'Ladybird' },
        { category: 'Insect', term: 'Ant' },
        { category: 'Insect', term: 'Bee' },
        { category: 'Insect', term: 'Spider' },
        // 3. Furniture
        { category: 'Furniture', term: 'Chair' },
        { category: 'Furniture', term: 'Table' },
        { category: 'Furniture', term: 'Bed' },
        { category: 'Furniture', term: 'Desk' },
        // 4. Tool
        { category: 'Tool', term: 'Hammer' },
        { category: 'Tool', term: 'Saw' },
        { category: 'Tool', term: 'Pliers' },
        { category: 'Tool', term: 'Drill' },
        // 5. Vehicle
        { category: 'Vehicle', term: 'Car' },
        { category: 'Vehicle', term: 'Bus' },
        { category: 'Vehicle', term: 'Truck' },
        { category: 'Vehicle', term: 'Bicycle' },
        // 6. Bird
        { category: 'Bird', term: 'Eagle' },
        { category: 'Bird', term: 'Robin' },
        { category: 'Bird', term: 'Owl' },
        { category: 'Bird', term: 'Swan' },
        // 7. Clothing
        { category: 'Clothing', term: 'Shirt' },
        { category: 'Clothing', term: 'Pants' },
        { category: 'Clothing', term: 'Jacket' },
        { category: 'Clothing', term: 'Sock' },
        // 8. Kitchen Utensil
        { category: 'Kitchen Utensil', term: 'Fork' },
        { category: 'Kitchen Utensil', term: 'Spoon' },
        { category: 'Kitchen Utensil', term: 'Knife' },
        { category: 'Kitchen Utensil', term: 'Pan' },
        // 9. Flower
        { category: 'Flower', term: 'Rose' },
        { category: 'Flower', term: 'Daisy' },
        { category: 'Flower', term: 'Tulip' },
        { category: 'Flower', term: 'Lily' },
        // 10. Musical Instrument
        { category: 'Musical Instrument', term: 'Piano' },
        { category: 'Musical Instrument', term: 'Guitar' },
        { category: 'Musical Instrument', term: 'Drum' },
        { category: 'Musical Instrument', term: 'Flute' },
        // 11. Tree
        { category: 'Tree', term: 'Oak' },
        { category: 'Tree', term: 'Pine' },
        { category: 'Tree', term: 'Palm' },
        { category: 'Tree', term: 'Maple' },
        // 12. Fish
        { category: 'Fish', term: 'Salmon' },
        { category: 'Fish', term: 'Tuna' },
        { category: 'Fish', term: 'Trout' },
        { category: 'Fish', term: 'Shark' }
      ]
    }
  ];

  const insertSet = db.prepare('INSERT INTO test_sets (name) VALUES (?)');
  const insertTerm = db.prepare('INSERT INTO terms (set_id, category, term) VALUES (?, ?, ?)');

  const seedTransaction = db.transaction(() => {
    for (const set of sets) {
      const result = insertSet.run(set.name);
      const setId = result.lastInsertRowid;
      for (const item of set.items) {
        insertTerm.run(setId, item.category, item.term);
      }
    }
  });

  try {
    seedTransaction();
    console.log('Database seeded successfully with 48 items.');
  } catch (e) {
    console.error('Error seeding database:', e);
  }
}

export { db };

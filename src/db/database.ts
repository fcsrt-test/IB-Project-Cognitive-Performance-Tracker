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
    
    if (termCheck.count < 144) {
      console.log('Term count < 144, triggering seedData...');
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
    },
    {
      name: 'Alternative Set A',
      items: [
        { category: 'Vegetable', term: 'Carrot' },
        { category: 'Vegetable', term: 'Broccoli' },
        { category: 'Vegetable', term: 'Spinach' },
        { category: 'Vegetable', term: 'Onion' },
        { category: 'Reptile', term: 'Snake' },
        { category: 'Reptile', term: 'Lizard' },
        { category: 'Reptile', term: 'Turtle' },
        { category: 'Reptile', term: 'Crocodile' },
        { category: 'Appliance', term: 'Oven' },
        { category: 'Appliance', term: 'Fridge' },
        { category: 'Appliance', term: 'Toaster' },
        { category: 'Appliance', term: 'Blender' },
        { category: 'Weapon', term: 'Sword' },
        { category: 'Weapon', term: 'Bow' },
        { category: 'Weapon', term: 'Spear' },
        { category: 'Weapon', term: 'Shield' },
        { category: 'Watercraft', term: 'Boat' },
        { category: 'Watercraft', term: 'Ship' },
        { category: 'Watercraft', term: 'Canoe' },
        { category: 'Watercraft', term: 'Submarine' },
        { category: 'Mammal', term: 'Lion' },
        { category: 'Mammal', term: 'Elephant' },
        { category: 'Mammal', term: 'Bear' },
        { category: 'Mammal', term: 'Tiger' },
        { category: 'Footwear', term: 'Shoe' },
        { category: 'Footwear', term: 'Boot' },
        { category: 'Footwear', term: 'Sandal' },
        { category: 'Footwear', term: 'Slipper' },
        { category: 'Office Supply', term: 'Pen' },
        { category: 'Office Supply', term: 'Paper' },
        { category: 'Office Supply', term: 'Stapler' },
        { category: 'Office Supply', term: 'Folder' },
        { category: 'Color', term: 'Red' },
        { category: 'Color', term: 'Blue' },
        { category: 'Color', term: 'Green' },
        { category: 'Color', term: 'Yellow' },
        { category: 'Sport', term: 'Soccer' },
        { category: 'Sport', term: 'Tennis' },
        { category: 'Sport', term: 'Golf' },
        { category: 'Sport', term: 'Baseball' },
        { category: 'Body Part', term: 'Head' },
        { category: 'Body Part', term: 'Arm' },
        { category: 'Body Part', term: 'Leg' },
        { category: 'Body Part', term: 'Hand' },
        { category: 'Weather', term: 'Rain' },
        { category: 'Weather', term: 'Snow' },
        { category: 'Weather', term: 'Wind' },
        { category: 'Weather', term: 'Cloud' }
      ]
    },
    {
      name: 'Alternative Set B',
      items: [
        { category: 'Dessert', term: 'Cake' },
        { category: 'Dessert', term: 'Pie' },
        { category: 'Dessert', term: 'Cookie' },
        { category: 'Dessert', term: 'Ice Cream' },
        { category: 'Pet', term: 'Dog' },
        { category: 'Pet', term: 'Cat' },
        { category: 'Pet', term: 'Hamster' },
        { category: 'Pet', term: 'Goldfish' },
        { category: 'Room', term: 'Kitchen' },
        { category: 'Room', term: 'Bedroom' },
        { category: 'Room', term: 'Bathroom' },
        { category: 'Room', term: 'Living Room' },
        { category: 'Profession', term: 'Doctor' },
        { category: 'Profession', term: 'Teacher' },
        { category: 'Profession', term: 'Lawyer' },
        { category: 'Profession', term: 'Engineer' },
        { category: 'Shape', term: 'Circle' },
        { category: 'Shape', term: 'Square' },
        { category: 'Shape', term: 'Triangle' },
        { category: 'Shape', term: 'Rectangle' },
        { category: 'Metal', term: 'Gold' },
        { category: 'Metal', term: 'Silver' },
        { category: 'Metal', term: 'Iron' },
        { category: 'Metal', term: 'Copper' },
        { category: 'Jewelry', term: 'Ring' },
        { category: 'Jewelry', term: 'Necklace' },
        { category: 'Jewelry', term: 'Bracelet' },
        { category: 'Jewelry', term: 'Earring' },
        { category: 'Drink', term: 'Water' },
        { category: 'Drink', term: 'Juice' },
        { category: 'Drink', term: 'Milk' },
        { category: 'Drink', term: 'Coffee' },
        { category: 'Planet', term: 'Earth' },
        { category: 'Planet', term: 'Mars' },
        { category: 'Planet', term: 'Venus' },
        { category: 'Planet', term: 'Jupiter' },
        { category: 'Building', term: 'House' },
        { category: 'Building', term: 'School' },
        { category: 'Building', term: 'Hospital' },
        { category: 'Building', term: 'Library' },
        { category: 'Emotion', term: 'Happy' },
        { category: 'Emotion', term: 'Sad' },
        { category: 'Emotion', term: 'Angry' },
        { category: 'Emotion', term: 'Scared' },
        { category: 'Season', term: 'Spring' },
        { category: 'Season', term: 'Summer' },
        { category: 'Season', term: 'Autumn' },
        { category: 'Season', term: 'Winter' }
      ]
    }

  ];

  const checkSet = db.prepare('SELECT id FROM test_sets WHERE name = ?');
  const insertSet = db.prepare('INSERT INTO test_sets (name) VALUES (?)');
  const insertTerm = db.prepare('INSERT INTO terms (set_id, category, term) VALUES (?, ?, ?)');

  const seedTransaction = db.transaction(() => {
    for (const set of sets) {
      const existing = checkSet.get(set.name) as { id: number } | undefined;
      if (!existing) {
        const result = insertSet.run(set.name);
        const setId = result.lastInsertRowid;
        for (const item of set.items) {
          insertTerm.run(setId, item.category, item.term);
        }
      }
    }
  });

  try {
    seedTransaction();
    console.log('Database seeded successfully with multiple sets.');
  } catch (e) {
    console.error('Error seeding database:', e);
  }

}

export { db };

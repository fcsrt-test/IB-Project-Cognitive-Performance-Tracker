import express from 'express';
import jwt from 'jsonwebtoken';
import { db, seedData } from '../db/database.ts';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod-without-changing';

// Middleware to check auth
const requireAuth = (req: any, res: any, next: any) => {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(requireAuth);

// Get a test set
// Logic: Try to get a set the user hasn't used recently, or just random
router.get('/start', (req: any, res) => {
  try {
    // Find sets used by user recently
    const usedSets = db.prepare('SELECT set_id FROM results WHERE user_id = ? ORDER BY test_date DESC LIMIT 5').all(req.user.id) as any[];
    const usedSetIds = usedSets.map(s => s.set_id);
    
    // Get all sets
    let allSets = db.prepare('SELECT id FROM test_sets').all() as any[];
    
    // Self-healing: If no sets exist, seed the database
    if (allSets.length === 0) {
      console.log('No test sets found. Triggering auto-seed...');
      seedData();
      allSets = db.prepare('SELECT id FROM test_sets').all() as any[];
    }

    // Filter available sets
    let availableSets = allSets.filter(s => !usedSetIds.includes(s.id));
    
    // If all sets used, reset pool (just pick random from all)
    if (availableSets.length === 0) {
      availableSets = allSets;
    }
    
    if (availableSets.length === 0) {
      console.error('No test sets available in database even after seeding');
      return res.status(500).json({ error: 'No test sets configured' });
    }
    
    const randomSet = availableSets[Math.floor(Math.random() * availableSets.length)];
    
    const terms = db.prepare('SELECT category, term FROM terms WHERE set_id = ?').all(randomSet.id) as {category: string, term: string}[];
    
    if (!terms || terms.length === 0) {
       console.error(`No terms found for set ${randomSet.id}`);
       return res.status(500).json({ error: 'Test set is empty' });
    }

    // Organize terms into 12 screens of 4 items
    // We want 4 distinct categories per screen if possible.
    // We have 12 categories, 4 items each.
    // Group by category first
    const byCategory: Record<string, typeof terms> = {};
    terms.forEach(t => {
      if (!byCategory[t.category]) byCategory[t.category] = [];
      byCategory[t.category].push(t);
    });

    const categories = Object.keys(byCategory);
    const screens: typeof terms[] = [];

    // We need 12 screens.
    // Strategy: 
    // Screen 1: Cat 1-4, Item 1
    // Screen 2: Cat 5-8, Item 1
    // Screen 3: Cat 9-12, Item 1
    // Screen 4: Cat 1-4, Item 2
    // ...
    
    // Shuffle categories to randomize order
    const shuffledCats = [...categories].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < 4; i++) { // 4 items per category
      for (let j = 0; j < 12; j += 4) { // 12 categories, taken 4 at a time
        const screenItems: typeof terms = [];
        for (let k = 0; k < 4; k++) {
          const cat = shuffledCats[j + k];
          if (cat && byCategory[cat][i]) {
            screenItems.push(byCategory[cat][i]);
          }
        }
        // Shuffle items on the screen itself
        screens.push(screenItems.sort(() => Math.random() - 0.5));
      }
    }

    // Shuffle the screens order? 
    // The prompt says "Display 12 consecutive screens". 
    // Randomizing the screens (while keeping the internal logic) is good.
    // Let's shuffle all screens to ensure unpredictability.
    const shuffledScreens = screens.sort(() => Math.random() - 0.5);

    res.json({
      setId: randomSet.id,
      screens: shuffledScreens,
      totalItems: terms.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to start test' });
  }
});

router.post('/submit', (req: any, res) => {
  try {
    const { setId, score, totalItems, details, latency, intrusionCount, freeRecallScore } = req.body;
    
    // Store more detailed metrics
    const extendedDetails = {
      itemDetails: details,
      latency,
      intrusionCount,
      freeRecallScore: typeof freeRecallScore === 'number' ? freeRecallScore : 0
    };

    const runResult = db.prepare(`
      INSERT INTO results (user_id, score, total_items, set_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, score, totalItems, setId, JSON.stringify(extendedDetails));
    
    res.json({ success: true, id: runResult.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit results' });
  }
});

router.get('/history', (req: any, res) => {
  try {
    console.log('Fetching history for user:', req.user.id);
    const history = db.prepare(`
      SELECT r.id, r.test_date, r.score, r.total_items, t.name as set_name, r.details
      FROM results r
      JOIN test_sets t ON r.set_id = t.id
      WHERE r.user_id = ?
      ORDER BY r.test_date DESC
    `).all(req.user.id);
    
    console.log(`Found ${history.length} history items`);
    res.json({ history });
  } catch (error) {
    console.error('Error in /history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;

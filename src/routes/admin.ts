import express from 'express';
import { db } from '../db/database.ts';
import { Parser } from '@json2csv/plainjs';

const router = express.Router();

// Simple admin protection (in a real app, use proper auth/roles)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'researcher-access-key';

router.get('/verify', (req, res) => {
  const secret = req.query.secret;
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }
  res.json({ success: true });
});

router.get('/export', (req, res) => {
  const secret = req.query.secret;
  
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }

  try {
    // Fetch results with user_id but NO username/PII
    const results = db.prepare(`
      SELECT 
        r.id as result_id,
        r.user_id,
        r.test_date,
        r.score,
        r.total_items,
        t.name as set_name,
        r.details
      FROM results r
      JOIN test_sets t ON r.set_id = t.id
      ORDER BY r.test_date DESC
    `).all();

    // Parse details JSON if needed, or leave as string
    // For CSV export, stringified JSON in a column is usually fine, or we can flatten it.
    // Let's keep it simple for now.

    const parser = new Parser();
    const csv = parser.parse(results);

    res.header('Content-Type', 'text/csv');
    res.attachment('study_data_anonymized.csv');
    res.send(csv);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

router.get('/export-surveys', (req, res) => {
  const secret = req.query.secret;
  
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }

  try {
    const surveys = db.prepare(`
      SELECT * FROM surveys ORDER BY created_at DESC
    `).all();

    const parser = new Parser();
    const csv = parser.parse(surveys);

    res.header('Content-Type', 'text/csv');
    res.attachment('survey_data_anonymized.csv');
    res.send(csv);

  } catch (error) {
    console.error('Survey export error:', error);
    res.status(500).json({ error: 'Failed to export survey data' });
  }
});

export default router;

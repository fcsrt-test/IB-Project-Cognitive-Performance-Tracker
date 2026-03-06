import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';
import { z } from 'zod';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod-without-changing';

const surveySchema = z.object({
  result_id: z.number().optional(),
  age_group: z.string().optional(),
  previous_test: z.string().optional(),
  q_instructions: z.number().min(1).max(5).optional(),
  q_tasks: z.number().min(1).max(5).optional(),
  q_comfort: z.number().min(1).max(5).optional(),
  q_length: z.number().min(1).max(5).optional(),
  q_language: z.number().min(1).max(5).optional(),
  q_visuals: z.number().min(1).max(5).optional(),
  q_comparison: z.number().min(1).max(5).optional(),
  q_recommend: z.number().min(1).max(5).optional(),
  test_duration: z.string().optional(),
  liked_most: z.string().optional(),
  liked_least: z.string().optional(),
  suggestions: z.string().optional(),
});

router.post('/submit', (req, res) => {
  const token = req.cookies.token;
  let userId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.id;
    } catch (e) {
      // Ignore invalid token for survey submission
    }
  }

  try {
    const data = surveySchema.parse(req.body);
    
    const stmt = db.prepare(`
      INSERT INTO surveys (
        user_id, result_id, age_group, previous_test, 
        q_instructions, q_tasks, q_comfort, q_length, 
        q_language, q_visuals, q_comparison, q_recommend, 
        test_duration, liked_most, liked_least, suggestions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      data.result_id || null,
      data.age_group || null,
      data.previous_test || null,
      data.q_instructions || null,
      data.q_tasks || null,
      data.q_comfort || null,
      data.q_length || null,
      data.q_language || null,
      data.q_visuals || null,
      data.q_comparison || null,
      data.q_recommend || null,
      data.test_duration || null,
      data.liked_most || null,
      data.liked_least || null,
      data.suggestions || null
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Survey submission error:', error);
    res.status(400).json({ error: 'Invalid survey data' });
  }
});

export default router;

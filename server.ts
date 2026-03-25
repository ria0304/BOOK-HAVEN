import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-bookhaven';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(cors());
  app.use(express.json());

  // Setup uploads directory
  const uploadsDir = path.join(__dirname, 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  app.use('/uploads', express.static(uploadsDir));

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueName = `${timestamp}-${cleanName}`;
      cb(null, uniqueName);
    }
  });
  
  const upload = multer({ 
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.pdf' || ext === '.epub') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF and EPUB files are allowed'));
      }
    }
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth
  app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, name, gender, birthday } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password, name, gender, birthday) VALUES (?, ?, ?, ?, ?, ?)');
      const info = stmt.run(username, email, hashedPassword, name, gender, birthday);
      const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, username, email, name, gender, birthday, onboarded: 0 } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email) as any;
      if (!user) return res.status(400).json({ error: 'User not found' });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name, gender: user.gender, birthday: user.birthday, onboarded: user.onboarded } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const stmt = db.prepare('SELECT id, username, email, name, gender, birthday, onboarded, created_at FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    res.json(user);
  });

  app.post('/api/auth/onboard', authenticateToken, (req: any, res) => {
    const { favorite_genres, reading_frequency, preferred_mood, favorite_types } = req.body;
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO user_preferences (user_id, favorite_genres, reading_frequency, preferred_mood, favorite_types) VALUES (?, ?, ?, ?, ?)');
      stmt.run(req.user.id, JSON.stringify(favorite_genres), reading_frequency, preferred_mood, JSON.stringify(favorite_types));
      
      const updateStmt = db.prepare('UPDATE users SET onboarded = 1 WHERE id = ?');
      updateStmt.run(req.user.id);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/auth/me', authenticateToken, async (req: any, res) => {
    const { username, email, password, name, gender, birthday } = req.body;
    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare('UPDATE users SET username = ?, email = ?, password = ?, name = ?, gender = ?, birthday = ? WHERE id = ?');
        stmt.run(username, email, hashedPassword, name, gender, birthday, req.user.id);
      } else {
        const stmt = db.prepare('UPDATE users SET username = ?, email = ?, name = ?, gender = ?, birthday = ? WHERE id = ?');
        stmt.run(username, email, name, gender, birthday, req.user.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Books (Library)
  app.get('/api/library', authenticateToken, (req: any, res) => {
    const stmt = db.prepare(`
      SELECT ub.*, b.title, b.author, b.cover_url, b.open_library_id
      FROM user_books ub
      JOIN books b ON ub.book_id = b.id
      WHERE ub.user_id = ?
    `);
    const books = stmt.all(req.user.id);
    res.json(books);
  });

  app.post('/api/library', authenticateToken, (req: any, res) => {
    const { title, author, cover_url, open_library_id, status } = req.body;
    try {
      let bookStmt = db.prepare('SELECT id FROM books WHERE open_library_id = ?');
      let book = bookStmt.get(open_library_id) as any;
      
      if (!book) {
        const insertBook = db.prepare('INSERT INTO books (title, author, cover_url, open_library_id) VALUES (?, ?, ?, ?)');
        const info = insertBook.run(title, author, cover_url, open_library_id);
        book = { id: info.lastInsertRowid };
      }

      const checkStmt = db.prepare('SELECT id FROM user_books WHERE user_id = ? AND book_id = ?');
      const existing = checkStmt.get(req.user.id, book.id);
      if (existing) {
        return res.status(400).json({ error: 'Already in library' });
      }

      const insertUserBook = db.prepare('INSERT INTO user_books (user_id, book_id, status) VALUES (?, ?, ?)');
      insertUserBook.run(req.user.id, book.id, status || 'want_to_read');
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Already in library' });
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/library/:id', authenticateToken, (req: any, res) => {
    const { status, rating, notes, mood } = req.body;
    try {
      const stmt = db.prepare('UPDATE user_books SET status = ?, rating = ?, notes = ?, mood = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
      stmt.run(status, rating, notes, mood, req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/library/:id', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare('DELETE FROM user_books WHERE id = ? AND user_id = ?');
      stmt.run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vault (Uploads)
  app.post('/api/vault/upload', authenticateToken, upload.single('file'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title } = req.body;
    const fileUrl = `/uploads/${req.file.filename}`;
    
    try {
      const stmt = db.prepare('INSERT INTO uploaded_books (user_id, title, file_url, file_size, file_name) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(
        req.user.id, 
        title || req.file.originalname.replace(/\.[^/.]+$/, ""), 
        fileUrl,
        req.file.size,
        req.file.originalname
      );
      res.json({ 
        id: info.lastInsertRowid, 
        title: title || req.file.originalname.replace(/\.[^/.]+$/, ""),
        file_url: fileUrl,
        file_size: req.file.size,
        file_name: req.file.originalname
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/vault', authenticateToken, (req: any, res) => {
    const stmt = db.prepare('SELECT * FROM uploaded_books WHERE user_id = ? ORDER BY created_at DESC');
    const books = stmt.all(req.user.id);
    res.json(books);
  });

  app.delete('/api/vault/:id', authenticateToken, (req: any, res) => {
    try {
      const getStmt = db.prepare('SELECT file_url FROM uploaded_books WHERE id = ? AND user_id = ?');
      const book = getStmt.get(req.params.id, req.user.id) as any;
      
      if (book) {
        const filePath = path.join(uploadsDir, path.basename(book.file_url));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      const stmt = db.prepare('DELETE FROM uploaded_books WHERE id = ? AND user_id = ?');
      stmt.run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/preferences/obsession', authenticateToken, (req: any, res) => {
    const { obsession } = req.body;
    try {
      const checkStmt = db.prepare('SELECT user_id FROM user_preferences WHERE user_id = ?');
      if (!checkStmt.get(req.user.id)) {
        db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(req.user.id);
      }
      
      const stmt = db.prepare('UPDATE user_preferences SET current_obsession = ? WHERE user_id = ?');
      stmt.run(obsession, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/preferences/mood', authenticateToken, (req: any, res) => {
    const { mood } = req.body;
    try {
      const checkStmt = db.prepare('SELECT user_id FROM user_preferences WHERE user_id = ?');
      if (!checkStmt.get(req.user.id)) {
        db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(req.user.id);
      }
      
      const stmt = db.prepare('UPDATE user_preferences SET last_mood = ?, last_mood_updated = CURRENT_TIMESTAMP WHERE user_id = ?');
      stmt.run(mood, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Analytics
  app.get('/api/analytics', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM user_books 
        WHERE user_id = ? 
        GROUP BY status
      `);
      const statusCounts = stmt.all(req.user.id);
      
      const moodStmt = db.prepare(`
        SELECT mood, COUNT(*) as count 
        FROM user_books 
        WHERE user_id = ? AND mood IS NOT NULL 
        GROUP BY mood
      `);
      const moodCounts = moodStmt.all(req.user.id);

      res.json({ statusCounts, moodCounts });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== READING SESSION TRACKING ==========

  // Start a reading session
  app.post('/api/reading/session/start', authenticateToken, (req: any, res) => {
    const { book_id, uploaded_book_id, mood_before, device_type } = req.body;
    
    try {
      const stmt = db.prepare(`
        INSERT INTO reading_sessions (user_id, book_id, uploaded_book_id, session_start, mood_before, device_type)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `);
      
      const result = stmt.run(
        req.user.id,
        book_id || null,
        uploaded_book_id || null,
        mood_before || null,
        device_type || 'web'
      );
      
      res.json({ 
        success: true, 
        session_id: result.lastInsertRowid,
        message: 'Reading session started'
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // End a reading session
  app.post('/api/reading/session/end', authenticateToken, (req: any, res) => {
    const { session_id, pages_read, mood_after } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    try {
      const getSession = db.prepare(`
        SELECT session_start FROM reading_sessions WHERE id = ? AND user_id = ?
      `);
      const session = getSession.get(session_id, req.user.id) as any;
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const startTime = new Date(session.session_start);
      const endTime = new Date();
      const minutesRead = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      
      let readingSpeed = null;
      if (pages_read && minutesRead > 0) {
        readingSpeed = pages_read / minutesRead;
      }
      
      const stmt = db.prepare(`
        UPDATE reading_sessions 
        SET session_end = CURRENT_TIMESTAMP, 
            pages_read = ?,
            mood_after = ?,
            reading_speed = ?
        WHERE id = ? AND user_id = ?
      `);
      
      stmt.run(pages_read || null, mood_after || null, readingSpeed, session_id, req.user.id);
      
      res.json({ 
        success: true, 
        reading_speed: readingSpeed,
        minutes_read: minutesRead,
        message: 'Reading session ended'
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get reading analytics
  app.get('/api/reading/analytics', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total_sessions,
          AVG(pages_read) as avg_pages,
          AVG(reading_speed) as avg_speed,
          SUM(pages_read) as total_pages,
          strftime('%Y-%m-%d', session_start) as date
        FROM reading_sessions
        WHERE user_id = ?
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `);
      
      const sessions = stmt.all(req.user.id);
      
      const moodStmt = db.prepare(`
        SELECT 
          mood_before,
          mood_after,
          COUNT(*) as count
        FROM reading_sessions
        WHERE user_id = ? AND mood_before IS NOT NULL AND mood_after IS NOT NULL
        GROUP BY mood_before, mood_after
      `);
      
      const moodChanges = moodStmt.all(req.user.id);
      
      res.json({ sessions, moodChanges });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== DYNAMIC MOOD-GENRE LEARNING SYSTEM ==========

  // Update mood-genre learning based on user feedback
  app.post('/api/mood-genre/feedback', authenticateToken, (req: any, res) => {
    const { mood_emoji, genre, liked } = req.body;
    
    try {
      const stmt = db.prepare(`
        UPDATE mood_genre_learning 
        SET click_count = click_count + ?,
            total_recommendations = total_recommendations + 1,
            success_rate = (success_rate * total_recommendations + ?) / (total_recommendations + 1),
            last_updated = CURRENT_TIMESTAMP
        WHERE mood_emoji = ? AND genre = ?
      `);
      
      const clickIncrement = liked ? 1 : 0;
      const successValue = liked ? 1 : 0;
      
      const result = stmt.run(clickIncrement, successValue, mood_emoji, genre);
      
      if (result.changes === 0) {
        const insertStmt = db.prepare(`
          INSERT INTO mood_genre_learning (mood_emoji, genre, success_rate, click_count, total_recommendations)
          VALUES (?, ?, ?, ?, 1)
        `);
        insertStmt.run(mood_emoji, genre, liked ? 1 : 0.5, liked ? 1 : 0);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get personalized mood-genre recommendations
  app.get('/api/mood-genre/recommendations', authenticateToken, (req: any, res) => {
    const { mood_emoji, limit = 10 } = req.query;
    
    if (!mood_emoji) {
      return res.status(400).json({ error: 'Mood emoji required' });
    }
    
    try {
      const stmt = db.prepare(`
        SELECT genre, success_rate, click_count
        FROM mood_genre_learning
        WHERE mood_emoji = ?
        ORDER BY success_rate DESC, click_count DESC
        LIMIT ?
      `);
      
      const genres = stmt.all(mood_emoji, parseInt(limit as string));
      
      res.json({ mood: mood_emoji, genres });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== RECOMMENDATION FEEDBACK LOOP ==========

  // Track recommendation feedback
  app.post('/api/recommendations/feedback', authenticateToken, (req: any, res) => {
    const { book_id, uploaded_book_id, recommended_by, clicked, time_to_click, rating } = req.body;
    
    try {
      const stmt = db.prepare(`
        INSERT INTO recommendation_feedback 
        (user_id, book_id, uploaded_book_id, recommended_by, user_clicked, time_to_click, user_rating)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        req.user.id,
        book_id || null,
        uploaded_book_id || null,
        recommended_by,
        clicked ? 1 : 0,
        time_to_click || null,
        rating || null
      );
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get recommendation performance analytics
  app.get('/api/recommendations/analytics', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare(`
        SELECT 
          recommended_by,
          COUNT(*) as total_recommendations,
          SUM(CASE WHEN user_clicked = 1 THEN 1 ELSE 0 END) as clicks,
          AVG(time_to_click) as avg_click_time,
          AVG(user_rating) as avg_rating
        FROM recommendation_feedback
        WHERE user_id = ?
        GROUP BY recommended_by
      `);
      
      const analytics = stmt.all(req.user.id);
      
      res.json(analytics);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========== GOODREADS LOCAL DATABASE SEARCH ==========
  
  app.get('/api/books/goodreads-search', authenticateToken, (req: any, res) => {
    const { q, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    try {
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='goodreads_books'").get();
      
      if (!tableCheck) {
        return res.json({ 
          success: true, 
          results: [],
          totalResults: 0,
          source: 'goodreads',
          message: 'Goodreads database not yet imported'
        });
      }
      
      const stmt = db.prepare(`
        SELECT 
          id,
          title,
          author,
          star_rating as rating,
          num_ratings as ratings_count,
          summary as description,
          genres,
          first_published as published_date,
          goodreads_url as url
        FROM goodreads_books 
        WHERE title LIKE ? 
           OR author LIKE ?
           OR genres LIKE ?
        ORDER BY num_ratings DESC, star_rating DESC
        LIMIT ?
      `);
      
      const searchTerm = `%${q}%`;
      const results = stmt.all(searchTerm, searchTerm, searchTerm, parseInt(limit as string));
      
      const formattedResults = results.map((book: any) => ({
        key: `goodreads-${book.id}`,
        title: book.title || 'Unknown Title',
        author: book.author || 'Unknown Author',
        author_name: [book.author || 'Unknown Author'],
        description: book.description || 'No summary available',
        rating: book.rating,
        ratings_count: book.ratings_count,
        published_date: book.published_date ? String(book.published_date).substring(0, 4) : null,
        categories: book.genres ? book.genres.split(',').slice(0, 5) : [],
        source: 'Goodreads',
        url: book.url
      }));
      
      res.json({ 
        success: true, 
        results: formattedResults,
        totalResults: formattedResults.length,
        source: 'goodreads'
      });
    } catch (error: any) {
      console.error('Goodreads search error:', error);
      res.status(500).json({ error: error.message, results: [] });
    }
  });

  // Book Search Proxy
  app.get('/api/books/search', authenticateToken, async (req: any, res) => {
    const { q, source = 'all' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    try {
      let allResults: any[] = [];
      
      if (source === 'all' || source === 'google') {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const googleResponse = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q as string)}&maxResults=12&orderBy=relevance`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            if (googleData.items) {
              const googleResults = googleData.items.map((item: any) => ({
                key: item.id,
                title: item.volumeInfo.title,
                author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
                author_name: item.volumeInfo.authors || ['Unknown'],
                cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
                description: item.volumeInfo.description ? 
                  item.volumeInfo.description.replace(/<[^>]*>/g, '').substring(0, 500) : '',
                rating: item.volumeInfo.averageRating,
                ratings_count: item.volumeInfo.ratingsCount,
                published_date: item.volumeInfo.publishedDate,
                page_count: item.volumeInfo.pageCount,
                categories: item.volumeInfo.categories,
                preview_link: item.volumeInfo.previewLink,
                source: 'Google Books',
                url: `https://books.google.com/books?id=${item.id}`
              }));
              allResults = [...allResults, ...googleResults];
            }
          }
        } catch (googleError) {
          console.error('Google Books error:', googleError);
        }
      }
      
      if (source === 'all' || source === 'openlibrary') {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const openLibResponse = await fetch(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(q as string)}&limit=12`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          if (openLibResponse.ok) {
            const openLibData = await openLibResponse.json();
            if (openLibData.docs) {
              const openLibResults = openLibData.docs.map((doc: any) => ({
                key: doc.key,
                title: doc.title,
                author: doc.author_name ? doc.author_name[0] : 'Unknown',
                author_name: doc.author_name || ['Unknown'],
                cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
                description: doc.first_sentence ? doc.first_sentence[0]?.substring(0, 300) : '',
                published_date: doc.first_publish_year ? `${doc.first_publish_year}` : '',
                source: 'Open Library',
                url: `https://openlibrary.org${doc.key}`
              }));
              allResults = [...allResults, ...openLibResults];
            }
          }
        } catch (openLibError) {
          console.error('Open Library error:', openLibError);
        }
      }
      
      const seenTitles = new Set();
      const deduplicated = allResults.filter(book => {
        const titleLower = book.title?.toLowerCase() || '';
        if (seenTitles.has(titleLower)) return false;
        seenTitles.add(titleLower);
        return true;
      });
      
      res.json({ 
        success: true, 
        results: deduplicated,
        totalResults: deduplicated.length
      });
      
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Search failed',
        results: [] 
      });
    }
  });

  // Book Details Proxy
  app.get('/api/books/details/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { source = 'google' } = req.query;
    
    try {
      if (source === 'google') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes/${id}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          res.json({ success: true, details: data });
        } else {
          res.json({ success: false, error: 'Failed to fetch details' });
        }
      } else {
        res.json({ success: false, error: 'Source not supported' });
      }
    } catch (error) {
      console.error('Details fetch error:', error);
      res.json({ success: false, error: 'Failed to fetch details' });
    }
  });

  // DRPA & Recommendations
  app.get('/api/recommendations/drpa', authenticateToken, async (req: any, res) => {
    try {
      const prefStmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
      const prefs = prefStmt.get(req.user.id) as any;
      
      const historyStmt = db.prepare(`
        SELECT b.title, b.author, ub.rating, ub.mood 
        FROM user_books ub
        JOIN books b ON ub.book_id = b.id
        WHERE ub.user_id = ? AND ub.status = 'completed'
        ORDER BY ub.updated_at DESC LIMIT 20
      `);
      const history = historyStmt.all(req.user.id) as any[];

      let obsession = prefs?.current_obsession || 'Exploring';
      if (!prefs?.current_obsession) {
        if (history.length > 0) {
          const authorCounts: Record<string, number> = {};
          history.forEach(h => {
            if (h.author) {
              authorCounts[h.author] = (authorCounts[h.author] || 0) + 1;
            }
          });
          const topAuthor = Object.keys(authorCounts).sort((a, b) => authorCounts[b] - authorCounts[a])[0];
          if (topAuthor && authorCounts[topAuthor] > 1) {
            obsession = `Obsessed with ${topAuthor}`;
          } else if (prefs && prefs.favorite_genres) {
            const genres = JSON.parse(prefs.favorite_genres);
            if (genres.length > 0) obsession = `Bingeing ${genres[0]}`;
          }
        } else if (prefs && prefs.favorite_genres) {
          const genres = JSON.parse(prefs.favorite_genres);
          if (genres.length > 0) obsession = `Craving ${genres[0]}`;
        }
      }

      let personality = 'The Newcomer';
      if (history.length > 10) personality = 'The Voracious Reader';
      else if (history.length > 5) personality = 'The Steady Scholar';
      else if (prefs && prefs.reading_frequency === 'Daily') personality = 'The Daily Devourer';
      else if (prefs && prefs.preferred_mood === 'Thought-provoking') personality = 'The Deep Thinker';

      let searchQuery = 'bestselling fiction 2024 2025';
      
      const obsessionMap: Record<string, string> = {
        'Dark Romance': 'dark romance bestselling books 2024 2025 haunting adeline cat and mouse duet',
        'Romantasy': 'romantasy fantasy romance bestsellers 2024 sarah j maas fourth wing',
        'Dark Fantasy': 'dark fantasy grimdark books bestsellers 2024 joe abercrombie',
        'Cyberpunk': 'cyberpunk science fiction bestsellers 2024 william gibson neuromancer',
        'Historical Fiction': 'historical fiction award winning books 2024',
        'Sci-Fi Thriller': 'science fiction thriller bestsellers 2024 blake crouch',
        'Cozy Mystery': 'cozy mystery books bestsellers 2024',
        'Epic Fantasy': 'epic fantasy bestsellers 2024 brandon sanderson',
        'True Crime': 'true crime bestselling books 2024',
        'Literary Fiction': 'literary fiction award winning books 2024',
        'Psychological Thriller': 'psychological thriller bestsellers 2024 freida mcfadden',
        'Contemporary Romance': 'contemporary romance bestsellers 2024 emily henry',
        'Spicy Romance': 'spicy romance steamy books bestsellers 2024',
        'Gothic Horror': 'gothic horror books bestsellers 2024',
        'Young Adult Fantasy': 'young adult fantasy bestsellers 2024',
        'Mystery': 'mystery thriller bestsellers 2024'
      };
      
      if (prefs?.current_obsession && obsessionMap[prefs.current_obsession]) {
        searchQuery = obsessionMap[prefs.current_obsession];
      } else if (prefs?.current_obsession) {
        searchQuery = `${prefs.current_obsession} bestselling books 2024`;
      } else if (prefs && prefs.favorite_genres) {
        const genres = JSON.parse(prefs.favorite_genres);
        if (genres.length > 0) {
          const genreMap: Record<string, string> = {
            'Fantasy': 'epic fantasy bestsellers 2024',
            'Sci-Fi': 'science fiction bestsellers 2024',
            'Romance': 'romance novels bestsellers 2024',
            'Thriller': 'thriller suspense bestsellers 2024',
            'Mystery': 'mystery books bestsellers 2024',
            'Horror': 'horror books bestsellers 2024 stephen king',
            'Non-Fiction': 'bestselling non-fiction 2024',
            'Historical': 'historical fiction bestsellers 2024',
            'Biography': 'bestselling biographies 2024'
          };
          searchQuery = genreMap[genres[0]] || `${genres[0]} bestselling books 2024`;
        }
      }
      
      let recommendations = [];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=8&orderBy=relevance`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        recommendations = (data.items || [])
          .map((item: any) => ({
            key: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
            cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
            description: item.volumeInfo.description || ''
          }))
          .filter((book: any) => book.title && book.author !== 'Unknown' && book.title.length > 3)
          .slice(0, 6);
          
        if (recommendations.length === 0) {
          const fallbackResponse = await fetch(
            'https://www.googleapis.com/books/v1/volumes?q=bestselling%20fiction%202024&maxResults=6'
          );
          const fallbackData = await fallbackResponse.json();
          recommendations = (fallbackData.items || []).map((item: any) => ({
            key: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
            cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null
          }));
        }
      } catch (e) {
        console.error('Failed to fetch recommendations', e);
      }

      res.json({
        obsession,
        personality,
        recommendations,
        preferences: prefs ? {
          genres: JSON.parse(prefs.favorite_genres || '[]'),
          mood: prefs.preferred_mood,
          frequency: prefs.reading_frequency
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mood-based Recommendations
  app.get('/api/recommendations/mood', authenticateToken, async (req: any, res) => {
    try {
      const { mood } = req.query;
      let targetMood = mood;

      if (!targetMood) {
        const stmt = db.prepare(`
          SELECT mood FROM user_books 
          WHERE user_id = ? AND mood IS NOT NULL 
          ORDER BY updated_at DESC LIMIT 1
        `);
        const recentMood = stmt.get(req.user.id) as any;
        if (recentMood) {
          targetMood = recentMood.mood;
        }
      }

      if (!targetMood) {
        return res.json({ mood: null, recommendations: [] });
      }

      const moodMap: Record<string, string> = {
        '😊': 'feel good uplifting bestselling books 2024',
        '😢': 'emotional moving literary fiction bestsellers 2024',
        '😐': 'contemporary fiction award winning books',
        '❤️': 'romance novels bestsellers 2024',
        '⚡': 'thriller suspense bestselling books 2024',
        '☕': 'cozy mystery comfort reads bestsellers',
        '🤔': 'thought provoking philosophical fiction',
        '🎉': 'celebratory joyful books uplifting stories',
        '😴': 'light easy reading books',
        '🤯': 'mind blowing science fiction fantasy',
        '😍': 'addictive books unputdownable',
        '🤗': 'heartwarming feel good books'
      };

      const searchTerm = moodMap[targetMood as string] || `${targetMood} bestselling books 2024`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&maxResults=6&orderBy=relevance`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      const recommendations = (data.items || [])
        .map((item: any) => ({
          key: item.id,
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
          cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
          description: item.volumeInfo.description || ''
        }))
        .filter((book: any) => book.title && book.author !== 'Unknown');

      res.json({ mood: targetMood, recommendations });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Movies (TMDB)
  app.get('/api/movies/search', authenticateToken, async (req: any, res) => {
    const { title } = req.query;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) {
      return res.json({
        mock: true,
        results: [
          {
            id: 1,
            title: `${title} (Movie Adaptation)`,
            overview: `A cinematic adaptation of the popular book "${title}".`,
            vote_average: 7.5,
            release_date: '2023-01-01'
          }
        ]
      });
    }

    try {
      const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
      const data = await response.json();
      res.json({ results: data.results || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { port: PORT === 3000 ? 24678 : PORT + 21678 }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Uploads directory: ${uploadsDir}`);
  });
}

startServer();

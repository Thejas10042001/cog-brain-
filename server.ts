import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { UAParser } from 'ua-parser-js';
import requestIp from 'request-ip';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
import db from './utils/db.js';
import * as mfaService from './services/mfaService.js';
import * as geminiService from './services/geminiService.js';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const firestore = admin.firestore();
if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
  // If a specific database ID is used, we might need more config, but usually default is fine
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIp.mw());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'spiked-ai-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      httpOnly: true
    }
  }));

  // Middleware: Validate Session
  const validateSession = async (req: any, res: any, next: any) => {
    if (!req.session) return next();
    const sessionInfo = (req.session as any).firebaseSession;
    if (!sessionInfo) return next();

    const { uid, sessionId } = sessionInfo;
    try {
      const session = db.prepare(`
        SELECT * FROM sessions 
        WHERE id = ? AND userId = ? AND isRevoked = 0
      `).get(sessionId, uid) as any;

      if (!session) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'Session not found or revoked' });
      }

      const now = new Date();
      if (new Date(session.expiresAt) < now) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'Session expired' });
      }

      next();
    } catch (e) {
      console.error('Session validation error:', e);
      next();
    }
  };

  app.use(validateSession);

  // Auth Routes
  app.post('/api/auth/session/create', async (req, res) => {
    const { idToken, deviceId } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    try {
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (adminErr) {
        const verifyRes = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
          idToken
        });
        const user = verifyRes.data.users[0];
        if (!user) throw new Error('Invalid token');
        decodedToken = { uid: user.localId, email: user.email };
      }

      const uid = decodedToken.uid;
      const sessionId = await createActiveSession(uid, req, deviceId || 'unknown');

      (req.session as any).firebaseSession = { uid, sessionId };
      res.json({ success: true, sessionId, uid });
    } catch (error) {
      console.error('Login session creation failed:', error);
      res.status(401).json({ error: 'Authentication failed' });
    }
  });

  app.get('/api/auth/sessions', async (req, res) => {
    const sessionInfo = (req.session as any).firebaseSession;
    if (!sessionInfo) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const { uid, sessionId: currentSessionId } = sessionInfo;
      const sessions = db.prepare(`
        SELECT * FROM sessions WHERE userId = ? ORDER BY createdAt DESC
      `).all(uid) as any[];
      
      const formattedSessions = sessions.map(s => ({
        ...s,
        isCurrent: s.id === currentSessionId,
        isRevoked: Boolean(s.isRevoked),
        createdAt: new Date(s.createdAt).toISOString(),
        lastActive: new Date(s.lastActive).toISOString(),
        expiresAt: new Date(s.expiresAt).toISOString()
      }));
      
      res.json({ sessions: formattedSessions });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.post('/api/auth/sessions/revoke', async (req, res) => {
    const sessionInfo = (req.session as any).firebaseSession;
    if (!sessionInfo) return res.status(401).json({ error: 'Not authenticated' });

    const { sessionId } = req.body;
    try {
      const { uid } = sessionInfo;
      db.prepare(`
        UPDATE sessions SET isRevoked = 1 WHERE id = ? AND userId = ?
      `).run(sessionId, uid);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to revoke session' });
    }
  });

  app.post('/api/auth/sessions/revoke-others', async (req, res) => {
    const sessionInfo = (req.session as any).firebaseSession;
    if (!sessionInfo) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const { uid, sessionId: currentSessionId } = sessionInfo;
      db.prepare(`
        UPDATE sessions SET isRevoked = 1 WHERE userId = ? AND id != ?
      `).run(uid, currentSessionId);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to revoke other sessions' });
    }
  });

  app.post('/api/auth/heartbeat', async (req, res) => {
    const sessionInfo = (req.session as any).firebaseSession;
    if (!sessionInfo) return res.status(200).send();

    try {
      const { uid, sessionId } = sessionInfo;
      db.prepare(`
        UPDATE sessions SET lastActive = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?
      `).run(sessionId, uid);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Heartbeat failed' });
    }
  });

  // Helper: Get Location from IP
  const getLocation = async (ip: string) => {
    try {
      if (ip === '::1' || ip === '127.0.0.1') return 'Localhost';
      const response = await axios.get(`http://ip-api.com/json/${ip}`);
      if (response.data && response.data.status === 'success') {
        return `${response.data.city}, ${response.data.country}`;
      }
      return 'Unknown Location';
    } catch (e) {
      return 'Unknown Location';
    }
  };

  // Helper: Create Session
  const createActiveSession = async (userId: string, req: any, deviceId: string = 'unknown') => {
    const parser = new UAParser(req.headers['user-agent']);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const deviceName = `${browser.name || 'Unknown'} on ${os.name || 'Unknown'}`;
    const ip = req.clientIp || 'Unknown';
    const location = await getLocation(ip);
    const sessionId = uuidv4();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    // Limit sessions to 5
    const existingCount = db.prepare('SELECT count(*) as count FROM sessions WHERE userId = ? AND isRevoked = 0').get(userId) as any;
    if (existingCount.count >= 5) {
      const oldest = db.prepare('SELECT id FROM sessions WHERE userId = ? AND isRevoked = 0 ORDER BY createdAt ASC LIMIT 1').get(userId) as any;
      if (oldest) {
        db.prepare('UPDATE sessions SET isRevoked = 1 WHERE id = ?').run(oldest.id);
      }
    }

    db.prepare(`
      INSERT INTO sessions (id, userId, deviceName, ipAddress, location, userAgent, expiresAt, deviceId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      deviceName,
      ip,
      location,
      req.headers['user-agent'],
      expiresAt.toISOString(),
      deviceId
    );

    return sessionId;
  };

  const getRedirectUri = (req: any) => {
    if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    return `${protocol}://${host}/auth/google/callback`;
  };

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    '' // Will be set per request
  );

  const SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
    'profile',
    'email'
  ];

  // Auth Routes
  app.get('/api/auth/google/url', (req, res) => {
    const redirectUri = getRedirectUri(req);
    // @ts-ignore
    oauth2Client.redirectUri = redirectUri;
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const redirectUri = getRedirectUri(req);
      // @ts-ignore
      oauth2Client.redirectUri = redirectUri;
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Get User Info for userId
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const userId = userInfo.data.id || userInfo.data.email || 'unknown';

      // Attach session to token
      const sessionId = await createActiveSession(userId, req);
      (req.session as any).tokens = tokens;
      (req.session as any).sessionId = sessionId;
      (req.session as any).userId = userId;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error getting tokens:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/auth/status', (req, res) => {
    res.json({ isAuthenticated: !!(req.session as any).tokens });
  });

  app.get('/api/auth/google/token', (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ access_token: tokens.access_token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const sessionId = (req.session as any).sessionId;
    if (sessionId) {
      db.prepare('UPDATE sessions SET isRevoked = 1 WHERE id = ?').run(sessionId);
    }
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Session Management APIs
  app.get('/api/sessions', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const sessions = db.prepare(`
      SELECT * FROM sessions 
      WHERE userId = ? AND isRevoked = 0 
      ORDER BY lastActive DESC
    `).all(userId);

    res.json({ 
      sessions: sessions.map((s: any) => ({
        ...s,
        isCurrent: s.id === (req.session as any).sessionId
      }))
    });
  });

  app.post('/api/sessions/revoke', (req, res) => {
    const { sessionId } = req.body;
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    db.prepare('UPDATE sessions SET isRevoked = 1 WHERE id = ? AND userId = ?')
      .run(sessionId, userId);

    res.json({ success: true });
  });

  app.post('/api/sessions/revoke-others', (req, res) => {
    const userId = (req.session as any).userId;
    const currentSessionId = (req.session as any).sessionId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    db.prepare(`
      UPDATE sessions 
      SET isRevoked = 1 
      WHERE userId = ? AND id != ?
    `).run(userId, currentSessionId);

    res.json({ success: true });
  });

  app.post('/api/sessions/heartbeat', (req, res) => {
    const sessionId = (req.session as any).sessionId;
    if (sessionId) {
      db.prepare('UPDATE sessions SET lastActive = CURRENT_TIMESTAMP WHERE id = ?')
        .run(sessionId);
    }
    res.json({ success: true });
  });

  // Settings & Activity APIs
  app.get('/api/settings', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const row: any = db.prepare('SELECT data FROM user_settings WHERE userId = ?').get(userId);
    if (!row) return res.json({ settings: null });
    
    res.json({ settings: JSON.parse(row.data) });
  });

  app.post('/api/settings', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const data = JSON.stringify(req.body.settings);
    db.prepare(`
      INSERT INTO user_settings (userId, data, updatedAt)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userId) DO UPDATE SET data = excluded.data, updatedAt = CURRENT_TIMESTAMP
    `).run(userId, data);

    res.json({ success: true });
  });

  app.get('/api/activity', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const limit = parseInt(req.query.limit as string) || 20;
    const logs = db.prepare(`
      SELECT * FROM activity_logs 
      WHERE userId = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(userId, limit);

    res.json({ logs });
  });

  app.post('/api/activity', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { type, action } = req.body;
    db.prepare(`
      INSERT INTO activity_logs (id, userId, type, action)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), userId, type, action);

    res.json({ success: true });
  });

  // MFA APIs
  app.get('/api/mfa/setup', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      // Use email as the identifier for the MFA app
      const userSettingsRow: any = db.prepare('SELECT data FROM user_settings WHERE userId = ?').get(userId);
      const email = userSettingsRow ? JSON.parse(userSettingsRow.data).profile.email : userId;
      
      const { secret, qrCode } = await mfaService.generateMfaSecret(email);
      
      // Store pending secret in session temporarily
      (req.session as any).pendingMfaSecret = secret;
      
      res.json({ qrCode, secret });
    } catch (e) {
      res.status(500).json({ error: 'Failed to generate MFA setup' });
    }
  });

  app.post('/api/mfa/verify-and-enable', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { token } = req.body;
    const secret = (req.session as any).pendingMfaSecret;

    if (!secret) return res.status(400).json({ error: 'No MFA setup in progress' });

    const isValid = mfaService.verifyMfaToken(token, secret);
    if (!isValid) return res.status(400).json({ error: 'Invalid verification code' });

    // Store verified secret
    db.prepare(`
      INSERT INTO mfa_secrets (userId, secret, updatedAt)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userId) DO UPDATE SET secret = excluded.secret, updatedAt = CURRENT_TIMESTAMP
    `).run(userId, secret);

    // Update settings
    const row: any = db.prepare('SELECT data FROM user_settings WHERE userId = ?').get(userId);
    if (row) {
      const settings = JSON.parse(row.data);
      settings.security.mfaEnabled = true;
      settings.security.mfaType = 'authenticator';
      db.prepare('UPDATE user_settings SET data = ? WHERE userId = ?').run(JSON.stringify(settings), userId);
    }

    delete (req.session as any).pendingMfaSecret;
    res.json({ success: true });
  });

  app.post('/api/mfa/disable', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    db.prepare('DELETE FROM mfa_secrets WHERE userId = ?').run(userId);

    // Update settings
    const row: any = db.prepare('SELECT data FROM user_settings WHERE userId = ?').get(userId);
    if (row) {
      const settings = JSON.parse(row.data);
      settings.security.mfaEnabled = false;
      db.prepare('UPDATE user_settings SET data = ? WHERE userId = ?').run(JSON.stringify(settings), userId);
    }

    res.json({ success: true });
  });

  // Session Middleware for all /api routes except auth
  app.use('/api', (req, res, next) => {
    const sessionId = (req.session as any).sessionId;
    if (req.path.startsWith('/auth')) return next();

    if (sessionId) {
      const sessionData: any = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      if (!sessionData || sessionData.isRevoked) {
        req.session.destroy(() => {
          res.status(401).json({ error: 'Session revoked' });
        });
        return;
      }
    }
    next();
  });

  // Calendar Routes
  app.get('/api/calendar/upcoming', async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      });
      res.json(response.data.items);
    } catch (error) {
      console.error('Error fetching calendar:', error);
      res.status(500).json({ error: 'Failed to fetch calendar' });
    }
  });

  // Gmail Routes
  app.post('/api/gmail/send-report', async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const { to, subject, body } = req.body;
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // Drive Routes
  app.get('/api/drive/download/:fileId', async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const { fileId } = req.params;
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    try {
      const fileMetadata = await drive.files.get({
        fileId,
        fields: 'name, mimeType'
      });

      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      res.set('Content-Type', fileMetadata.data.mimeType || 'application/octet-stream');
      res.set('Content-Disposition', `attachment; filename="${fileMetadata.data.name}"`);
      res.send(Buffer.from(response.data as ArrayBuffer));
    } catch (error) {
      console.error('Error downloading from Drive:', error);
      res.status(500).json({ error: 'Failed to download file from Google Drive' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production (like Cloud Run), serve static files
    // But on Vercel, this part is usually handled by Vercel's static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Check if file exists in dist, otherwise send index.html
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Start server if this file is run directly
if (import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
  startServer().then(app => {
    app.listen(3000, '0.0.0.0', () => {
      console.log('Server running on http://localhost:3000');
    });
  });
}

export default startServer;

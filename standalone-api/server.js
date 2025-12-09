/**
 * =============================================================================
 * MOLAM-ID STANDALONE API SERVER
 * =============================================================================
 * API monolithique temporaire avec signup/login
 * =============================================================================
 */

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

// Build connection string from environment variables
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: false
} : {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'molam_id',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: false
};

console.log('🔌 Connecting to PostgreSQL:', {
  host: dbConfig.host || 'via connection string',
  database: dbConfig.database || 'via connection string'
});

const pool = new Pool(dbConfig);

// Test DB connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected');
  }
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.molam.tech', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Serve uploaded files (accessible without authentication)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/uploads/*', (req, res, next) => {
  // Allow CORS for images
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// =============================================================================
// MULTER CONFIGURATION
// =============================================================================

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.userId}-${uniqueSuffix}${ext}`);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// =============================================================================
// ROUTES
// =============================================================================

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/healthz', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Signup
app.post('/signup', async (req, res) => {
  const { phone, email, password, firstName, lastName } = req.body;

  console.log('Signup request:', { phone, email, firstName, lastName });

  if (!phone || !email || !password || !firstName || !lastName) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['phone', 'email', 'password', 'firstName', 'lastName']
    });
  }

  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'Email or phone number already registered'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (phone, email, password_hash, first_name, last_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, phone, email, first_name, last_name, profile_picture_url, created_at`,
      [phone, email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, phone: user.phone },
      process.env.JWT_SECRET || 'default-secret-change-in-production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePictureUrl: user.profile_picture_url,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('Login request:', { email });

  if (!email || !password) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['email', 'password']
    });
  }

  try {
    // Find user
    const result = await pool.query(
      'SELECT id, phone, email, password_hash, first_name, last_name, profile_picture_url, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password incorrect'
      });
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password incorrect'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, phone: user.phone },
      process.env.JWT_SECRET || 'default-secret-change-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePictureUrl: user.profile_picture_url,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// =============================================================================
// PASSWORD RESET ROUTES
// =============================================================================

// In-memory store for OTPs (in production, use Redis)
const otpStore = new Map(); // key: email, value: { otp, expires, attempts }

// Request password reset (send OTP)
app.post('/password/request-reset', async (req, res) => {
  const { email } = req.body;

  console.log('Password reset requested for:', email);

  if (!email) {
    return res.status(400).json({
      error: 'Missing required field',
      required: ['email']
    });
  }

  try {
    // Check if user exists
    const result = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists or not (security)
      return res.json({
        message: 'Si cet email existe, un code de vérification a été envoyé'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email, {
      otp,
      expires,
      attempts: 0
    });

    // In production, send email here
    console.log(`📧 OTP pour ${email}: ${otp}`);
    console.log(`⏰ Expire dans 10 minutes`);

    // For development, log the OTP
    console.log('='.repeat(60));
    console.log(`CODE DE VERIFICATION: ${otp}`);
    console.log('='.repeat(60));

    res.json({
      message: 'Code de vérification envoyé par email'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Verify OTP
app.post('/password/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  console.log('OTP verification for:', email);

  if (!email || !otp) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['email', 'otp']
    });
  }

  try {
    const stored = otpStore.get(email);

    if (!stored) {
      return res.status(400).json({
        error: 'Code invalide ou expiré'
      });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(email);
      return res.status(400).json({
        error: 'Code expiré'
      });
    }

    if (stored.attempts >= 3) {
      otpStore.delete(email);
      return res.status(400).json({
        error: 'Trop de tentatives. Demandez un nouveau code.'
      });
    }

    if (stored.otp !== otp) {
      stored.attempts++;
      return res.status(400).json({
        error: 'Code incorrect',
        attemptsLeft: 3 - stored.attempts
      });
    }

    // OTP is valid - generate reset token
    const resetToken = jwt.sign(
      { email, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'default-secret-change-in-production',
      { expiresIn: '15m' }
    );

    // Mark OTP as used
    otpStore.delete(email);

    res.json({
      message: 'Code vérifié avec succès',
      resetToken
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Reset password
app.post('/password/reset', async (req, res) => {
  const { email, resetToken, newPassword } = req.body;

  console.log('Password reset for:', email);

  if (!email || !resetToken || !newPassword) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['email', 'resetToken', 'newPassword']
    });
  }

  try {
    // Verify reset token
    const decoded = jwt.verify(
      resetToken,
      process.env.JWT_SECRET || 'default-secret-change-in-production'
    );

    if (decoded.email !== email || decoded.purpose !== 'password-reset') {
      return res.status(400).json({
        error: 'Token invalide'
      });
    }

    // Validate password
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères'
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email',
      [passwordHash, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Password reset successful for:', email);

    res.json({
      message: 'Mot de passe réinitialisé avec succès'
    });
  } catch (error) {
    console.error('Password reset error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        error: 'Token invalide'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        error: 'Token expiré. Recommencez le processus.'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// =============================================================================
// MIDDLEWARE - AUTH
// =============================================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-in-production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// =============================================================================
// MIDDLEWARE - RBAC
// =============================================================================

/**
 * RBAC Middleware - Check if user has required permission
 * Usage: app.get('/route', authenticateToken, requirePermission('id.users.read'), handler)
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId;

      // Check permission using database function
      const result = await pool.query(
        'SELECT has_permission($1, $2) as has_perm',
        [userId, permissionCode]
      );

      const hasPerm = result.rows[0]?.has_perm;

      // Log access attempt
      await pool.query(
        `INSERT INTO rbac_audit_log
         (user_id, action, permission_code, resource_type, result, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          req.method + ' ' + req.path,
          permissionCode,
          req.path.split('/')[1], // Extract resource type from path
          hasPerm ? 'granted' : 'denied',
          req.ip,
          req.get('user-agent'),
          JSON.stringify({ method: req.method, path: req.path })
        ]
      );

      if (!hasPerm) {
        return res.status(403).json({
          error: 'Permission denied',
          message: `You don't have the required permission: ${permissionCode}`,
          required: permissionCode
        });
      }

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  };
}

// =============================================================================
// RBAC MANAGEMENT ROUTES
// =============================================================================

// Get my permissions
app.get('/rbac/permissions/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM get_user_permissions($1)',
      [req.user.userId]
    );

    res.json({
      userId: req.user.userId,
      permissions: result.rows
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get all roles (admin only)
app.get('/rbac/roles', authenticateToken, requirePermission('id.users.read'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.role_type,
        r.module_scope,
        r.priority,
        r.is_system,
        COUNT(DISTINCT ur.user_id) as user_count,
        COUNT(DISTINCT rp.perm_id) as permission_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.display_name, r.description, r.role_type, r.module_scope, r.priority, r.is_system
      ORDER BY r.priority DESC, r.name
    `);

    res.json({
      roles: result.rows
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get role details with permissions
app.get('/rbac/roles/:roleId', authenticateToken, requirePermission('id.users.read'), async (req, res) => {
  try {
    const { roleId } = req.params;

    // Get role info
    const roleResult = await pool.query(
      'SELECT * FROM roles WHERE id = $1',
      [roleId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get role permissions
    const permsResult = await pool.query(`
      SELECT p.id, p.code, p.description, p.module, p.resource_type, p.action
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.perm_id
      WHERE rp.role_id = $1
      ORDER BY p.code
    `, [roleId]);

    res.json({
      role: roleResult.rows[0],
      permissions: permsResult.rows
    });
  } catch (error) {
    console.error('Get role details error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Assign role to user (admin only)
app.post('/rbac/users/:userId/roles', authenticateToken, requirePermission('id.users.update'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId, justification, expiresAt } = req.body;

    if (!roleId) {
      return res.status(400).json({
        error: 'Missing required field',
        required: ['roleId']
      });
    }

    // Check if role exists
    const roleCheck = await pool.query('SELECT name FROM roles WHERE id = $1', [roleId]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Assign role
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id, granted_by, justification, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, role_id) DO UPDATE
      SET granted_by = $3, granted_at = NOW(), justification = $4, expires_at = $5
    `, [userId, roleId, req.user.userId, justification, expiresAt]);

    res.json({
      message: 'Role assigned successfully',
      userId: parseInt(userId),
      roleId: parseInt(roleId),
      roleName: roleCheck.rows[0].name
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Revoke role from user (admin only)
app.delete('/rbac/users/:userId/roles/:roleId', authenticateToken, requirePermission('id.users.update'), async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    const result = await pool.query(
      'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 RETURNING *',
      [userId, roleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Role assignment not found',
        message: 'This user does not have this role'
      });
    }

    res.json({
      message: 'Role revoked successfully',
      userId: parseInt(userId),
      roleId: parseInt(roleId)
    });
  } catch (error) {
    console.error('Revoke role error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get user roles and permissions
app.get('/rbac/users/:userId', authenticateToken, requirePermission('id.users.read'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user roles
    const rolesResult = await pool.query(`
      SELECT
        r.id,
        r.name,
        r.display_name,
        r.description,
        r.role_type,
        r.module_scope,
        r.priority,
        ur.granted_at,
        ur.expires_at,
        ur.justification,
        u.email as granted_by_email
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN users u ON ur.granted_by = u.id
      WHERE ur.user_id = $1
      ORDER BY r.priority DESC
    `, [userId]);

    // Get user permissions
    const permsResult = await pool.query(
      'SELECT * FROM get_user_permissions($1)',
      [userId]
    );

    res.json({
      userId: parseInt(userId),
      roles: rolesResult.rows,
      permissions: permsResult.rows
    });
  } catch (error) {
    console.error('Get user RBAC info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get audit log (auditor/admin only)
app.get('/rbac/audit', authenticateToken, requirePermission('id.audit.read'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId, result: auditResult } = req.query;

    let query = `
      SELECT
        al.id,
        al.user_id,
        u.email as user_email,
        al.action,
        al.permission_code,
        al.resource_type,
        al.resource_id,
        al.result,
        al.reason,
        al.ip_address,
        al.created_at
      FROM rbac_audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (userId) {
      query += ` AND al.user_id = $${paramCount++}`;
      params.push(userId);
    }

    if (auditResult) {
      query += ` AND al.result = $${paramCount++}`;
      params.push(auditResult);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const logsResult = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM rbac_audit_log WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (userId) {
      countQuery += ` AND user_id = $${countParamCount++}`;
      countParams.push(userId);
    }

    if (auditResult) {
      countQuery += ` AND result = $${countParamCount++}`;
      countParams.push(auditResult);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      logs: logsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// =============================================================================
// PROTECTED ROUTES
// =============================================================================

// Get Profile (protected route)
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, phone, email, first_name, last_name, profile_picture_url, created_at, updated_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      profilePictureUrl: user.profile_picture_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Update Profile (protected route)
app.put('/profile', authenticateToken, async (req, res) => {
  const { firstName, lastName, email, phone } = req.body;

  console.log('Update profile request:', { userId: req.user.userId, firstName, lastName, email, phone });

  try {
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (email !== undefined) {
      // Check if email already exists for another user
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.userId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Email already in use',
          message: 'This email is already registered to another account'
        });
      }
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      // Check if phone already exists for another user
      const phoneCheck = await pool.query(
        'SELECT id FROM users WHERE phone = $1 AND id != $2',
        [phone, req.user.userId]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Phone already in use',
          message: 'This phone number is already registered to another account'
        });
      }
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Please provide at least one field to update'
      });
    }

    // Add userId to values
    values.push(req.user.userId);

    // Execute update
    const query = `
      UPDATE users
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, phone, email, first_name, last_name, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        profilePictureUrl: user.profile_picture_url
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Upload Profile Picture (protected route)
app.post('/profile/picture', authenticateToken, upload.single('picture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please provide an image file'
      });
    }

    // Build the URL for the uploaded file
    const pictureUrl = `/uploads/profiles/${req.file.filename}`;

    // Update user's profile_picture_url in database
    const result = await pool.query(
      'UPDATE users SET profile_picture_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, phone, email, first_name, last_name, profile_picture_url, created_at, updated_at',
      [pictureUrl, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Delete old profile picture if exists
    if (user.profile_picture_url && user.profile_picture_url !== pictureUrl) {
      const oldFilePath = path.join(__dirname, user.profile_picture_url);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({
      message: 'Profile picture updated successfully',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePictureUrl: user.profile_picture_url,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);

    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(__dirname, 'uploads', 'profiles', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// =============================================================================
// SERVER START
// =============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 MOLAM-ID STANDALONE API');
  console.log('='.repeat(60));
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏳ Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

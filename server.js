const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = 5000;

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com', // Change to your email
    pass: 'your-app-password'     // Use App Password (not regular password)
  }
});

// Set to true for development (logs to console instead of sending email)
const useFakeEmail = true;

// Enhanced MySQL Database Connection with better error handling
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Your MySQL password
  database: 'healthmate_app',
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
});

// Connect to MySQL with retry logic
function connectToDatabase(retries = 5, delay = 3000) {
  db.connect((err) => {
    if (err) {
      console.error('❌ MySQL connection error:', err.message);
      
      if (retries > 0) {
        console.log(`🔄 Retrying connection... (${retries} attempts left)`);
        setTimeout(() => connectToDatabase(retries - 1, delay), delay);
      } else {
        console.error('💥 Failed to connect to MySQL after multiple attempts');
        console.log('💡 Please check:');
        console.log('   1. MySQL server is running');
        console.log('   2. Database "healthmate_app" exists');
        console.log('   3. MySQL credentials are correct');
        process.exit(1);
      }
      return;
    }
    
    console.log('✅ Connected to MySQL Database');
    ensureDatabaseCollation();
    createTablesIfNotExist();
  });
}

// Ensure database has correct collation
function ensureDatabaseCollation() {
  console.log('🔧 Ensuring database collation is correct...');
  const alterDbQuery = "ALTER DATABASE healthmate_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
  
  db.query(alterDbQuery, (err) => {
    if (err) {
      console.log('⚠️ Could not alter database collation:', err.message);
    } else {
      console.log('✅ Database collation set to utf8mb4_unicode_ci');
    }
  });
}

// Enhanced table creation function with fixed collation
function createTablesIfNotExist() {
  const tables = [
    // Users table first (this should exist for foreign keys)
    `CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      age INT,
      height_cm DECIMAL(5,2),
      weight_kg DECIMAL(5,2),
      blood_group VARCHAR(5),
      gender ENUM('male', 'female', 'other'),
      address TEXT,
      chronic_diseases JSON,
      account_status ENUM('Active', 'Inactive') DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Password reset tokens table (NEW TABLE)
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(255) NOT NULL,
      reset_token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      is_used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      INDEX idx_reset_token (reset_token),
      INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Family relationships table
    `CREATE TABLE IF NOT EXISTS family_relationships (
      relationship_id INT AUTO_INCREMENT PRIMARY KEY,
      owner_user_id INT NOT NULL,
      family_user_id INT,
      family_email VARCHAR(255) NOT NULL,
      relationship_type ENUM('parent', 'child', 'spouse', 'sibling', 'guardian', 'other') NOT NULL,
      access_level ENUM('view_only', 'manage', 'emergency') DEFAULT 'view_only',
      status ENUM('pending', 'accepted', 'declined', 'revoked') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (family_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      UNIQUE KEY unique_relationship (owner_user_id, family_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Family access logs table
    `CREATE TABLE IF NOT EXISTS family_access_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      relationship_id INT NOT NULL,
      user_id INT NOT NULL,
      action_type VARCHAR(100) NOT NULL,
      accessed_section VARCHAR(100),
      details JSON,
      access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (relationship_id) REFERENCES family_relationships(relationship_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Emergency access requests table
    `CREATE TABLE IF NOT EXISTS emergency_access_requests (
      request_id INT AUTO_INCREMENT PRIMARY KEY,
      requester_user_id INT NOT NULL,
      target_user_id INT NOT NULL,
      reason TEXT,
      status ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL,
      FOREIGN KEY (requester_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Reports table
    `CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      report_name VARCHAR(255) NOT NULL,
      storage_path VARCHAR(500) NOT NULL,
      download_url VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Activity logs table
    `CREATE TABLE IF NOT EXISTS activity_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  let completed = 0;
  tables.forEach((tableSQL, index) => {
    db.query(tableSQL, (err) => {
      if (err) {
        console.log(`❌ Table ${index + 1} creation error:`, err.message);
      } else {
        console.log(`✅ Table ${index + 1} created/verified`);
      }
      
      completed++;
      if (completed === tables.length) {
        console.log('🎉 All database tables are ready!');
        createDemoUsers();
      }
    });
  });
}

// Create demo users for testing
function createDemoUsers() {
  const demoUsers = [
    {
      email: 'demo@example.com',
      name: 'Demo User',
      phone: '+880123456789',
      password: 'demo123',
      age: 30,
      height: 170.5,
      weight: 65.2,
      blood_group: 'O+',
      gender: 'male',
      address: 'Dhaka, Bangladesh',
      chronic_diseases: JSON.stringify(['Hypertension', 'Diabetes'])
    },
    {
      email: 'family1@example.com',
      name: 'Family Member 1',
      phone: '+880123456780',
      password: 'demo123',
      age: 28,
      height: 165.0,
      weight: 60.0,
      blood_group: 'A+',
      gender: 'female',
      address: 'Dhaka, Bangladesh',
      chronic_diseases: JSON.stringify(['Asthma'])
    },
    {
      email: 'family2@example.com',
      name: 'Family Member 2',
      phone: '+880123456781',
      password: 'demo123',
      age: 25,
      height: 175.0,
      weight: 70.0,
      blood_group: 'B+',
      gender: 'male',
      address: 'Dhaka, Bangladesh',
      chronic_diseases: JSON.stringify(['None'])
    }
  ];

  let usersCreated = 0;
  
  demoUsers.forEach(async (userData, index) => {
    const checkUserQuery = 'SELECT * FROM users WHERE email = ?';
    
    db.query(checkUserQuery, [userData.email], async (err, results) => {
      if (err) {
        console.log(`⚠️ Could not check for user ${userData.email}:`, err.message);
        return;
      }
      
      if (results.length === 0) {
        console.log(`👤 Creating demo user: ${userData.email}`);
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        const insertUserQuery = `
          INSERT INTO users (full_name, email, phone, password_hash, age, height_cm, weight_kg, blood_group, gender, address, chronic_diseases) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const userValues = [
          userData.name, userData.email, userData.phone, hashedPassword, 
          userData.age, userData.height, userData.weight, userData.blood_group, 
          userData.gender, userData.address, userData.chronic_diseases
        ];
        
        db.query(insertUserQuery, userValues, (err, result) => {
          if (err) {
            console.log(`⚠️ Could not create user ${userData.email}:`, err.message);
          } else {
            console.log(`✅ Demo user created: ${userData.email} / ${userData.password}`);
            
            if (userData.email === 'demo@example.com') {
              createDemoFamilyRelationships(result.insertId);
            }
          }
        });
      } else {
        console.log(`✅ Demo user already exists: ${userData.email}`);
        usersCreated++;
        
        if (usersCreated === demoUsers.length) {
          createDemoFamilyRelationships(results[0].user_id);
        }
      }
    });
  });
}

// Create demo family relationships
function createDemoFamilyRelationships(demoUserId) {
  console.log('👨‍👩‍👧‍👦 Creating demo family relationships...');
  
  const getUsersQuery = 'SELECT user_id, email FROM users WHERE email IN (?, ?, ?)';
  db.query(getUsersQuery, ['demo@example.com', 'family1@example.com', 'family2@example.com'], (err, users) => {
    if (err || users.length < 3) {
      console.log('⚠️ Could not create demo family relationships: missing users');
      return;
    }
    
    const demoUser = users.find(u => u.email === 'demo@example.com');
    const family1 = users.find(u => u.email === 'family1@example.com');
    const family2 = users.find(u => u.email === 'family2@example.com');
    
    const relationships = [
      {
        owner_user_id: demoUser.user_id,
        family_user_id: family1.user_id,
        family_email: family1.email,
        relationship_type: 'spouse',
        access_level: 'manage',
        status: 'accepted'
      },
      {
        owner_user_id: demoUser.user_id,
        family_user_id: family2.user_id,
        family_email: family2.email,
        relationship_type: 'sibling',
        access_level: 'view_only',
        status: 'accepted'
      },
      {
        owner_user_id: family1.user_id,
        family_user_id: demoUser.user_id,
        family_email: demoUser.email,
        relationship_type: 'spouse',
        access_level: 'manage',
        status: 'accepted'
      },
      {
        owner_user_id: family2.user_id,
        family_user_id: demoUser.user_id,
        family_email: demoUser.email,
        relationship_type: 'sibling',
        access_level: 'view_only',
        status: 'accepted'
      }
    ];
    
    let relationshipsCreated = 0;
    
    relationships.forEach(rel => {
      const checkRelQuery = 'SELECT * FROM family_relationships WHERE owner_user_id = ? AND family_email = ?';
      db.query(checkRelQuery, [rel.owner_user_id, rel.family_email], (err, results) => {
        if (err) {
          console.log('⚠️ Could not check family relationship:', err.message);
          return;
        }
        
        if (results.length === 0) {
          const insertRelQuery = `
            INSERT INTO family_relationships 
            (owner_user_id, family_user_id, family_email, relationship_type, access_level, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          db.query(insertRelQuery, [
            rel.owner_user_id, rel.family_user_id, rel.family_email, 
            rel.relationship_type, rel.access_level, rel.status
          ], (err, result) => {
            if (err) {
              console.log('⚠️ Could not create family relationship:', err.message);
            } else {
              console.log(`✅ Family relationship created: ${rel.owner_user_id} -> ${rel.family_email}`);
              
              const logQuery = `
                INSERT INTO family_access_logs (relationship_id, user_id, action_type, accessed_section)
                VALUES (?, ?, ?, ?)
              `;
              db.query(logQuery, [result.insertId, rel.owner_user_id, 'invite_sent', 'family_management']);
            }
          });
        } else {
          console.log(`✅ Family relationship already exists: ${rel.owner_user_id} -> ${rel.family_email}`);
        }
        
        relationshipsCreated++;
        if (relationshipsCreated === relationships.length) {
          console.log('🎉 All demo family relationships are ready!');
        }
      });
    });
  });
}

// Start database connection
connectToDatabase();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

console.log('📁 Serving static files from:', frontendPath);

// Enhanced authentication middleware
function authenticateToken(req, res, next) {
  const userEmail = req.headers['x-user-email'] || req.body.email || 'demo@example.com';
  
  const findUserQuery = 'SELECT * FROM users WHERE email = ? AND account_status = "Active"';
  
  db.query(findUserQuery, [userEmail], (err, results) => {
    if (err || results.length === 0) {
      const demoQuery = 'SELECT * FROM users WHERE email = "demo@example.com" AND account_status = "Active"';
      db.query(demoQuery, (err, demoResults) => {
        if (err || demoResults.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'Authentication failed'
          });
        }
        
        const user = demoResults[0];
        req.user = {
          userId: user.user_id,
          email: user.email,
          name: user.full_name
        };
        next();
      });
    } else {
      const user = results[0];
      req.user = {
        userId: user.user_id,
        email: user.email,
        name: user.full_name
      };
      next();
    }
  });
}

// ============================================================================
// BASIC API ENDPOINTS
// ============================================================================

app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'HealthMate backend is working!',
    timestamp: new Date().toISOString(),
    database: 'Connected',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  db.query('SELECT 1 as test', (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: err.message
      });
    }
    
    res.json({
      success: true,
      message: 'Server is healthy',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
});

// ============================================================================
// AUTHENTICATION & PASSWORD RESET ENDPOINTS
// ============================================================================

// User registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { 
      name, age, height, heightUnit, weight, bloodGroup, 
      gender, phone, email, address, password, chronicDiseases 
    } = req.body;

    console.log('👤 Registration attempt:', email);

    if (!name || !email || !password || !age || !height || !weight || !bloodGroup || !gender || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const checkUserQuery = 'SELECT * FROM users WHERE email = ? OR phone = ?';
    db.query(checkUserQuery, [email, phone], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (results.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      let heightInCm = height;
      if (heightUnit === 'ft') {
        heightInCm = (parseFloat(height) * 30.48).toFixed(2);
      }

      const insertUserQuery = `
        INSERT INTO users (
          full_name, email, phone, password_hash, age, height_cm, 
          weight_kg, blood_group, gender, address, chronic_diseases
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const userData = [
        name, email, phone, hashedPassword, parseInt(age), 
        parseFloat(heightInCm), parseFloat(weight), bloodGroup, 
        gender, address, JSON.stringify(chronicDiseases || [])
      ];

      db.query(insertUserQuery, userData, (err, result) => {
        if (err) {
          console.error('Error inserting user:', err);
          return res.status(500).json({
            success: false,
            message: 'Error creating user account'
          });
        }

        console.log('✅ User registered successfully:', email);
        
        try {
          const logQuery = 'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)';
          db.query(logQuery, [result.insertId, 'User registered']);
        } catch (logError) {
          console.log('Activity logging skipped');
        }

        res.json({
          success: true,
          message: 'Registration successful!',
          user: {
            id: result.insertId,
            name: name,
            email: email
          }
        });
      });
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// User login endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Login attempt:', email);

  if (!email || !password) {
    return res.json({
      success: false,
      message: 'Please provide both email and password'
    });
  }

  const findUserQuery = 'SELECT * FROM users WHERE email = ? AND account_status = "Active"';
  
  db.query(findUserQuery, [email], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error'
      });
    }

    if (results.length === 0) {
      return res.json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = results[0];

    try {
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isPasswordValid) {
        return res.json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      try {
        const logQuery = 'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)';
        db.query(logQuery, [user.user_id, 'User logged in']);
      } catch (logError) {
        console.log('Activity logging skipped');
      }

      console.log('✅ Login successful:', email);
      
      res.json({
        success: true,
        message: 'Login successful!',
        user: {
          id: user.user_id,
          name: user.full_name,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Password comparison error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
});

// ============================================================================
// PASSWORD RESET ENDPOINTS (NEW)
// ============================================================================

// Request password reset
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    console.log(`🔐 Password reset requested for: ${email}`);

    // Check if user exists
    const findUserQuery = 'SELECT user_id, email, full_name FROM users WHERE email = ?';
    
    db.query(findUserQuery, [email], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (results.length === 0) {
        // For security, don't reveal if user exists
        return res.json({
          success: true,
          message: 'If your email exists in our system, you will receive a password reset link'
        });
      }

      const user = results[0];
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Set expiry time (1 hour from now)
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      
      // Delete any existing tokens for this user
      const deleteOldTokensQuery = 'DELETE FROM password_reset_tokens WHERE user_id = ?';
      db.query(deleteOldTokensQuery, [user.user_id], (err) => {
        if (err) {
          console.error('Error deleting old tokens:', err);
        }
        
        // Store token in database
        const insertTokenQuery = `
          INSERT INTO password_reset_tokens (user_id, email, reset_token, expires_at)
          VALUES (?, ?, ?, ?)
        `;
        
        db.query(insertTokenQuery, [
          user.user_id,
          user.email,
          tokenHash,
          expiresAt
        ], async (err) => {
          if (err) {
            console.error('Error storing reset token:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to process password reset request'
            });
          }
          
          // Create reset URL
          const resetUrl = `http://localhost:3000/reset-password.html?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
          
          // Send email
          try {
            if (useFakeEmail) {
              // For development: log the URL instead of sending email
              console.log('📧 [DEV] Password reset link:', resetUrl);
              console.log(`   Token: ${resetToken}`);
              console.log(`   Email would be sent to: ${user.email}`);
              
              return res.json({
                success: true,
                message: 'Password reset email sent (development mode)',
                dev_mode: true,
                reset_url: resetUrl // Only include in development
              });
            } else {
              // For production: send actual email
              const mailOptions = {
                from: 'HealthMate <noreply@healthmate.com>',
                to: user.email,
                subject: 'Password Reset Request - HealthMate',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #10B981;">HealthMate Password Reset</h2>
                    <p>Hello ${user.full_name},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${resetUrl}" 
                         style="background-color: #10B981; color: white; padding: 12px 24px; 
                                text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Reset Your Password
                      </a>
                    </div>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6B7280; font-size: 12px;">
                      This is an automated message from HealthMate. Please do not reply to this email.
                    </p>
                  </div>
                `
              };
              
              await transporter.sendMail(mailOptions);
              
              console.log(`✅ Password reset email sent to: ${user.email}`);
              
              return res.json({
                success: true,
                message: 'Password reset email sent. Please check your inbox.'
              });
            }
          } catch (emailError) {
            console.error('Error sending email:', emailError);
            return res.status(500).json({
              success: false,
              message: 'Failed to send password reset email'
            });
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Error in /api/forgot-password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify reset token
app.post('/api/verify-reset-token', async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Token and email are required'
      });
    }

    // Hash the token for comparison
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const query = `
      SELECT prt.*, u.email as user_email 
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.user_id
      WHERE prt.reset_token = ? 
        AND prt.email = ?
        AND prt.expires_at > NOW()
        AND prt.is_used = FALSE
    `;
    
    db.query(query, [tokenHash, email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      res.json({
        success: true,
        message: 'Token is valid'
      });
    });
    
  } catch (error) {
    console.error('Error in /api/verify-reset-token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    if (!token || !email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Hash the token for comparison
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Verify token
    const verifyQuery = `
      SELECT prt.*, u.user_id
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.user_id
      WHERE prt.reset_token = ? 
        AND prt.email = ?
        AND prt.expires_at > NOW()
        AND prt.is_used = FALSE
    `;
    
    db.query(verifyQuery, [tokenHash, email], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      const tokenRecord = results[0];
      const userId = tokenRecord.user_id;

      try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update user's password
        const updatePasswordQuery = 'UPDATE users SET password_hash = ? WHERE user_id = ?';
        
        db.query(updatePasswordQuery, [hashedPassword, userId], (err, updateResult) => {
          if (err) {
            console.error('Error updating password:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to update password'
            });
          }
          
          // Mark token as used
          const markTokenUsedQuery = 'UPDATE password_reset_tokens SET is_used = TRUE WHERE token_id = ?';
          db.query(markTokenUsedQuery, [tokenRecord.token_id], (err) => {
            if (err) {
              console.error('Error marking token as used:', err);
            }
            
            // Log the activity
            try {
              const logQuery = 'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)';
              db.query(logQuery, [userId, 'Password reset via email']);
            } catch (logError) {
              console.log('Activity logging skipped');
            }
            
            console.log(`✅ Password reset successful for user: ${email}`);
            
            res.json({
              success: true,
              message: 'Password has been reset successfully! You can now login with your new password.'
            });
          });
        });
      } catch (hashError) {
        console.error('Error hashing password:', hashError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process password reset'
        });
      }
    });
    
  } catch (error) {
    console.error('Error in /api/reset-password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// PROFILE MANAGEMENT ENDPOINTS
// ============================================================================

// Get user profile endpoint
app.get('/api/profile/:email', (req, res) => {
  const email = req.params.email;

  console.log('🔍 Fetching profile for:', email);

  const query = `
    SELECT 
      user_id, 
      full_name, 
      email, 
      phone, 
      age, 
      height_cm, 
      weight_kg, 
      blood_group, 
      gender, 
      address, 
      chronic_diseases,
      created_at,
      updated_at
    FROM users 
    WHERE email = ?
  `;
  
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error'
      });
    }

    if (results.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = results[0];
    
    let chronicDiseases = [];
    try {
      if (user.chronic_diseases) {
        chronicDiseases = typeof user.chronic_diseases === 'string' 
          ? JSON.parse(user.chronic_diseases) 
          : user.chronic_diseases;
      }
    } catch (parseError) {
      console.error('Error parsing chronic diseases:', parseError);
      chronicDiseases = [];
    }

    const userProfile = {
      user_id: user.user_id,
      full_name: user.full_name || 'Not set',
      email: user.email,
      phone: user.phone || 'Not set',
      age: user.age,
      height_cm: user.height_cm,
      weight_kg: user.weight_kg,
      blood_group: user.blood_group || 'Not set',
      gender: user.gender || 'Not set',
      address: user.address || 'Not set',
      chronic_diseases: chronicDiseases,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    console.log('✅ Profile data fetched for:', email);
    
    res.json({
      success: true,
      user: userProfile
    });
  });
});

// Update user profile endpoint
app.put('/api/profile/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const { 
      full_name, 
      phone, 
      age, 
      height_cm, 
      weight_kg, 
      blood_group, 
      gender, 
      address 
    } = req.body;

    console.log('📝 Updating profile for:', email);
    console.log('Update data:', req.body);

    if (!full_name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Full name and phone are required'
      });
    }

    const checkUserQuery = 'SELECT user_id FROM users WHERE email = ?';
    db.query(checkUserQuery, [email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userId = results[0].user_id;

      const updateQuery = `
        UPDATE users 
        SET 
          full_name = ?,
          phone = ?,
          age = ?,
          height_cm = ?,
          weight_kg = ?,
          blood_group = ?,
          gender = ?,
          address = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE email = ?
      `;

      const updateData = [
        full_name,
        phone,
        age || null,
        height_cm || null,
        weight_kg || null,
        blood_group || null,
        gender || null,
        address || null,
        email
      ];

      db.query(updateQuery, updateData, (err, result) => {
        if (err) {
          console.error('Error updating user:', err);
          return res.status(500).json({
            success: false,
            message: 'Error updating profile'
          });
        }

        console.log('✅ Profile updated for:', email);
        
        try {
          const logQuery = 'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)';
          db.query(logQuery, [userId, 'Profile updated']);
        } catch (logError) {
          console.log('Activity logging skipped');
        }

        const getUpdatedQuery = `
          SELECT 
            user_id, 
            full_name, 
            email, 
            phone, 
            age, 
            height_cm, 
            weight_kg, 
            blood_group, 
            gender, 
            address, 
            chronic_diseases
          FROM users 
          WHERE email = ?
        `;
        
        db.query(getUpdatedQuery, [email], (err, updatedResults) => {
          if (err || updatedResults.length === 0) {
            return res.json({
              success: true,
              message: 'Profile updated successfully'
            });
          }

          const updatedUser = updatedResults[0];
          
          let chronicDiseases = [];
          try {
            if (updatedUser.chronic_diseases) {
              chronicDiseases = typeof updatedUser.chronic_diseases === 'string' 
                ? JSON.parse(updatedUser.chronic_diseases) 
                : updatedUser.chronic_diseases;
            }
          } catch (parseError) {
            console.error('Error parsing chronic diseases:', parseError);
            chronicDiseases = [];
          }

          const userProfile = {
            user_id: updatedUser.user_id,
            full_name: updatedUser.full_name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            age: updatedUser.age,
            height_cm: updatedUser.height_cm,
            weight_kg: updatedUser.weight_kg,
            blood_group: updatedUser.blood_group,
            gender: updatedUser.gender,
            address: updatedUser.address,
            chronic_diseases: chronicDiseases
          };

          res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userProfile
          });
        });
      });
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// FAMILY MANAGEMENT API ENDPOINTS
// ============================================================================

// Get family members who can access user's profile
app.get('/api/family/members', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const query = `
      SELECT 
        fr.relationship_id,
        fr.family_email,
        fr.relationship_type,
        fr.access_level,
        fr.status,
        fr.created_at,
        fr.updated_at,
        u.user_id as family_user_id,
        u.full_name as family_name
      FROM family_relationships fr
      LEFT JOIN users u ON fr.family_email COLLATE utf8mb4_unicode_ci = u.email
      WHERE fr.owner_user_id = ?
      ORDER BY fr.created_at DESC
    `;
    
    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch family members',
          error: err.message
        });
      }
      
      res.json({
        success: true,
        familyMembers: results || []
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/members:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get profiles that user can access
app.get('/api/family/accessible-profiles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    
    const query = `
      SELECT 
        fr.relationship_id,
        fr.owner_user_id,
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        fr.relationship_type,
        fr.access_level,
        fr.created_at,
        u.updated_at as profile_updated
      FROM family_relationships fr
      JOIN users u ON fr.owner_user_id = u.user_id
      WHERE (fr.family_user_id = ? OR fr.family_email COLLATE utf8mb4_unicode_ci = ?) 
      AND fr.status = 'accepted'
      ORDER BY u.full_name
    `;
    
    db.query(query, [userId, userEmail], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch accessible profiles'
        });
      }
      
      res.json({
        success: true,
        accessibleProfiles: results || []
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/accessible-profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Invite family member
app.post('/api/family/invite', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email, relationshipType, accessLevel } = req.body;
    
    if (!email || !relationshipType) {
      return res.status(400).json({
        success: false,
        message: 'Email and relationship type are required'
      });
    }
    
    const checkQuery = 'SELECT * FROM family_relationships WHERE owner_user_id = ? AND family_email = ?';
    db.query(checkQuery, [userId, email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }
      
      if (results.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invitation already sent to this email'
        });
      }
      
      const selfQuery = 'SELECT email FROM users WHERE user_id = ?';
      db.query(selfQuery, [userId], (err, userResults) => {
        if (err || userResults.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid user'
          });
        }
        
        if (userResults[0].email === email) {
          return res.status(400).json({
            success: false,
            message: 'You cannot invite yourself'
          });
        }
        
        const familyUserQuery = 'SELECT user_id FROM users WHERE email = ?';
        db.query(familyUserQuery, [email], (err, familyResults) => {
          let familyUserId = null;
          if (familyResults.length > 0) {
            familyUserId = familyResults[0].user_id;
          }
          
          const insertQuery = `
            INSERT INTO family_relationships 
            (owner_user_id, family_user_id, family_email, relationship_type, access_level, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
          `;
          
          db.query(insertQuery, [userId, familyUserId, email, relationshipType, accessLevel || 'view_only'], (err, result) => {
            if (err) {
              console.error('Error inserting invitation:', err);
              return res.status(500).json({
                success: false,
                message: 'Failed to send invitation'
              });
            }
            
            try {
              const logQuery = 'INSERT INTO family_access_logs (relationship_id, user_id, action_type, accessed_section) VALUES (?, ?, ?, ?)';
              db.query(logQuery, [result.insertId, userId, 'invite_sent', 'family_management']);
            } catch (logError) {
              console.log('Family access logging skipped');
            }
            
            res.json({
              success: true,
              message: 'Invitation sent successfully',
              invitationId: result.insertId
            });
          });
        });
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/invite:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update family member access level
app.put('/api/family/members/:relationshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { relationshipId } = req.params;
    const { accessLevel } = req.body;
    
    if (!accessLevel) {
      return res.status(400).json({
        success: false,
        message: 'Access level is required'
      });
    }
    
    const query = 'UPDATE family_relationships SET access_level = ? WHERE relationship_id = ? AND owner_user_id = ?';
    db.query(query, [accessLevel, relationshipId, userId], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to update access level'
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }
      
      try {
        const logQuery = 'INSERT INTO family_access_logs (relationship_id, user_id, action_type, accessed_section) VALUES (?, ?, ?, ?)';
        db.query(logQuery, [relationshipId, userId, 'access_updated', 'family_management']);
      } catch (logError) {
        console.log('Family access logging skipped');
      }
      
      res.json({
        success: true,
        message: 'Access level updated successfully'
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/members/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Remove family member
app.delete('/api/family/members/:relationshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { relationshipId } = req.params;
    
    const query = 'DELETE FROM family_relationships WHERE relationship_id = ? AND owner_user_id = ?';
    db.query(query, [relationshipId, userId], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to remove family member'
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Family member removed successfully'
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/members/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get pending invitations for current user
app.get('/api/family/invitations/pending', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    
    const query = `
      SELECT 
        fr.relationship_id,
        fr.owner_user_id,
        u.full_name as owner_name,
        u.email as owner_email,
        fr.relationship_type,
        fr.access_level,
        fr.created_at
      FROM family_relationships fr
      JOIN users u ON fr.owner_user_id = u.user_id
      WHERE fr.family_email COLLATE utf8mb4_unicode_ci = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `;
    
    db.query(query, [userEmail], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch pending invitations'
        });
      }
      
      res.json({
        success: true,
        pendingInvitations: results || []
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/invitations/pending:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Accept/decline family invitation
app.post('/api/family/invitations/:relationshipId/respond', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const { relationshipId } = req.params;
    const { action } = req.body;
    
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "accept" or "decline"'
      });
    }
    
    const status = action === 'accept' ? 'accepted' : 'declined';
    
    const updateQuery = `
      UPDATE family_relationships 
      SET status = ?, family_user_id = ?
      WHERE relationship_id = ? AND family_email COLLATE utf8mb4_unicode_ci = ? AND status = 'pending'
    `;
    
    db.query(updateQuery, [status, userId, relationshipId, userEmail], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to process invitation'
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found or already processed'
        });
      }
      
      try {
        const logQuery = 'INSERT INTO family_access_logs (relationship_id, user_id, action_type, accessed_section) VALUES (?, ?, ?, ?)';
        db.query(logQuery, [relationshipId, userId, `invitation_${action}ed`, 'family_management']);
      } catch (logError) {
        console.log('Family access logging skipped');
      }
      
      res.json({
        success: true,
        message: `Invitation ${action}ed successfully`
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/invitations/:id/respond:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get access logs
app.get('/api/family/access-logs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const query = `
      SELECT 
        fal.log_id,
        fal.action_type,
        fal.accessed_section,
        fal.details,
        fal.access_time,
        u.full_name as user_name,
        CASE 
          WHEN fal.user_id = ? THEN 'You'
          ELSE u.full_name 
        END as actor_name
      FROM family_access_logs fal
      JOIN family_relationships fr ON fal.relationship_id = fr.relationship_id
      JOIN users u ON fal.user_id = u.user_id
      WHERE fr.owner_user_id = ? OR fr.family_user_id = ?
      ORDER BY fal.access_time DESC
      LIMIT 20
    `;
    
    db.query(query, [userId, userId, userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch access logs'
        });
      }
      
      res.json({
        success: true,
        accessLogs: results || []
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/access-logs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Emergency access request
app.post('/api/family/emergency-access', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targetEmail, reason } = req.body;
    
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: 'Target email is required'
      });
    }
    
    const targetQuery = 'SELECT user_id FROM users WHERE email = ?';
    db.query(targetQuery, [targetEmail], (err, targetResults) => {
      if (err || targetResults.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const targetUserId = targetResults[0].user_id;
      
      const checkQuery = `
        SELECT * FROM emergency_access_requests 
        WHERE requester_user_id = ? AND target_user_id = ? AND status = 'pending'
      `;
      
      db.query(checkQuery, [userId, targetUserId], (err, checkResults) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({
            success: false,
            message: 'Database error'
          });
        }
        
        if (checkResults.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Emergency access request already pending'
          });
        }
        
        const insertQuery = `
          INSERT INTO emergency_access_requests 
          (requester_user_id, target_user_id, reason, expires_at)
          VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))
        `;
        
        db.query(insertQuery, [userId, targetUserId, reason || 'Emergency access requested'], (err, result) => {
          if (err) {
            console.error('Error creating emergency request:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to create emergency access request'
            });
          }
          
          res.json({
            success: true,
            message: 'Emergency access request sent successfully',
            requestId: result.insertId
          });
        });
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/emergency-access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get family member's profile data
app.get('/api/family/profile/:ownerUserId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const { ownerUserId } = req.params;
    
    const accessQuery = `
      SELECT fr.access_level 
      FROM family_relationships fr 
      WHERE fr.owner_user_id = ? 
      AND (fr.family_user_id = ? OR fr.family_email COLLATE utf8mb4_unicode_ci = ?) 
      AND fr.status = 'accepted'
    `;
    
    db.query(accessQuery, [ownerUserId, userId, userEmail], (err, accessResults) => {
      if (err || accessResults.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this profile'
        });
      }
      
      const accessLevel = accessResults[0].access_level;
      
      const profileQuery = `
        SELECT 
          user_id,
          full_name,
          email,
          phone,
          age,
          height_cm,
          weight_kg,
          blood_group,
          gender,
          address,
          chronic_diseases,
          created_at,
          updated_at
        FROM users 
        WHERE user_id = ?
      `;
      
      db.query(profileQuery, [ownerUserId], (err, profileResults) => {
        if (err || profileResults.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Profile not found'
          });
        }
        
        const user = profileResults[0];
        
        let chronicDiseases = [];
        try {
          if (user.chronic_diseases) {
            chronicDiseases = typeof user.chronic_diseases === 'string' 
              ? JSON.parse(user.chronic_diseases) 
              : user.chronic_diseases;
          }
        } catch (parseError) {
          console.error('Error parsing chronic diseases:', parseError);
          chronicDiseases = [];
        }
        
        const userProfile = {
          id: user.user_id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          age: user.age,
          height_cm: user.height_cm,
          weight_kg: user.weight_kg,
          blood_group: user.blood_group,
          gender: user.gender,
          address: user.address,
          chronic_diseases: chronicDiseases,
          access_level: accessLevel,
          last_updated: user.updated_at
        };
        
        try {
          const relationshipQuery = 'SELECT relationship_id FROM family_relationships WHERE owner_user_id = ? AND (family_user_id = ? OR family_email COLLATE utf8mb4_unicode_ci = ?)';
          db.query(relationshipQuery, [ownerUserId, userId, userEmail], (err, relResults) => {
            if (relResults.length > 0) {
              const logQuery = 'INSERT INTO family_access_logs (relationship_id, user_id, action_type, accessed_section) VALUES (?, ?, ?, ?)';
              db.query(logQuery, [relResults[0].relationship_id, userId, 'profile_view', 'family_profile']);
            }
          });
        } catch (logError) {
          console.log('Family access logging skipped');
        }
        
        res.json({
          success: true,
          profile: userProfile,
          access_level: accessLevel
        });
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/profile/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get family member basic info
app.get('/api/family/member-info/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    
    const query = `
      SELECT user_id, full_name, email 
      FROM users 
      WHERE email = ? AND account_status = 'Active'
    `;
    
    db.query(query, [email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }
      
      if (results.length === 0) {
        return res.json({
          success: true,
          user: null,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        user: {
          id: results[0].user_id,
          name: results[0].full_name,
          email: results[0].email
        }
      });
    });
    
  } catch (error) {
    console.error('Error in /api/family/member-info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// REPORTS MANAGEMENT API ENDPOINTS
// ============================================================================

// Get user reports
app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const query = 'SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC';
    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch reports'
        });
      }
      
      res.json({
        success: true,
        reports: results || []
      });
    });
    
  } catch (error) {
    console.error('Error in /api/reports:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Upload report
app.post('/api/reports', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { report_name, storage_path, download_url, file_name } = req.body;
    
    if (!report_name || !storage_path || !download_url || !file_name) {
      return res.status(400).json({
        success: false,
        message: 'All report fields are required'
      });
    }
    
    const query = `
      INSERT INTO reports (user_id, report_name, storage_path, download_url, file_name)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.query(query, [userId, report_name, storage_path, download_url, file_name], (err, result) => {
      if (err) {
        console.error('Error inserting report:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to save report'
        });
      }
      
      res.json({
        success: true,
        message: 'Report saved successfully',
        reportId: result.insertId
      });
    });
    
  } catch (error) {
    console.error('Error in /api/reports:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete report
app.delete('/api/reports/:reportId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reportId } = req.params;
    
    const query = 'DELETE FROM reports WHERE id = ? AND user_id = ?';
    db.query(query, [reportId, userId], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete report'
        });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    });
    
  } catch (error) {
    console.error('Error in /api/reports/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// DOCTOR SEARCH & APPOINTMENT ENDPOINTS
// ============================================================================

// Enhanced Doctor Search
app.get('/api/doctors', async (req, res) => {
  try {
    const { specialization, location = 'dhaka' } = req.query;
    
    if (!specialization) {
      return res.status(400).json({
        success: false,
        message: 'Specialization parameter is required'
      });
    }

    console.log(`🔍 Searching doctors for: ${specialization} in ${location}`);

    const doctors = getEnhancedSampleDoctors(specialization, location);

    res.json({
      success: true,
      doctors: doctors,
      source: 'enhanced_sample_data',
      count: doctors.length,
      specialization: specialization,
      location: location
    });

  } catch (error) {
    console.error('❌ Error in /api/doctors:', error);
    
    const sampleDoctors = getEnhancedSampleDoctors(req.query.specialization, req.query.location);
    
    res.json({
      success: true,
      doctors: sampleDoctors,
      source: 'sample_data_fallback'
    });
  }
});

// Enhanced sample data with realistic Bangladeshi doctors
function getEnhancedSampleDoctors(specialization, location) {
  const specializationMap = {
    'neurologist': {
      names: ['Dr. A.B.M. Abdullah', 'Dr. Md. Badrul Alam', 'Dr. Quazi Deen Mohammad', 'Dr. Md. Zahid Hossain', 'Dr. Prof. M.A. Salam', 'Dr. Nasreen Sultana'],
      hospitals: ['Bangabandhu Sheikh Mujib Medical University', 'National Institute of Neurosciences & Hospital', 'Dhaka Medical College Hospital', 'Square Hospitals Ltd.']
    },
    'cardiologist': {
      names: ['Dr. S.M. Mustafa Zaman', 'Dr. Sohel Reza Choudhury', 'Dr. Abu Siddique', 'Dr. Md. Hafizur Rahman', 'Dr. Prof. M. Amran Hossain', 'Dr. Fatema Begum'],
      hospitals: ['National Heart Foundation Hospital & Research Institute', 'Ibrahim Cardiac Hospital & Research Institute', 'United Hospital Limited', 'Evercare Hospital Dhaka']
    },
    'orthopedic': {
      names: ['Dr. Md. Jahangir Alam', 'Dr. A.K.M. Zahid Hossain', 'Dr. Mohammad Humayun Kabir', 'Dr. S.M. Ahsan Habib', 'Dr. Prof. Md. Anwar Hossain', 'Dr. Sabrina Yasmin'],
      hospitals: ['National Institute of Traumatology & Orthopaedic Rehabilitation', 'Dhaka Medical College Hospital', 'Square Hospitals Ltd.', 'Labaid Specialized Hospital']
    },
    'gastroenterologist': {
      names: ['Dr. Mohammad Ali', 'Dr. Ferdous Ahmed Sarker', 'Dr. S.M. Rafiqul Islam', 'Dr. Md. Anisur Rahman', 'Dr. Prof. Md. Faruque Pathan', 'Dr. Nasima Akter'],
      hospitals: ['Bangabandhu Sheikh Mujib Medical University', 'Apollo Hospitals Dhaka', 'Labaid Specialized Hospital', 'United Hospital Limited']
    }
  };

  const specKey = specialization.toLowerCase();
  const specData = specializationMap[specKey] || {
    names: ['Dr. Ahmed Rahman', 'Dr. Fatima Begum', 'Dr. Mohammad Ali', 'Dr. Sabrina Chowdhury', 'Dr. Rajib Hassan', 'Dr. Nasrin Akter'],
    hospitals: ['Evercare Hospital Dhaka', 'United Hospital Limited', 'Square Hospital', 'Labaid Specialized Hospital', 'Apollo Hospitals Dhaka']
  };

  return Array.from({ length: 6 }, (_, i) => {
    const name = specData.names[i % specData.names.length];
    const hospital = specData.hospitals[i % specData.hospitals.length];
    const experienceYears = 5 + Math.floor(Math.random() * 25);
    
    return {
      name: name,
      specialization: specialization,
      hospital: hospital,
      location: location.charAt(0).toUpperCase() + location.slice(1),
      experience: `${experienceYears} years experience`,
      contact: `+880-1${Math.floor(Math.random() * 90000000 + 10000000)}`,
      consultation_fee: `${500 + Math.floor(Math.random() * 1500)} BDT`,
      verified: Math.random() > 0.3,
      rating: (4 + Math.random()).toFixed(1),
      coordinates: {
        lat: 23.8103 + (Math.random() - 0.5) * 0.1,
        lng: 90.4125 + (Math.random() - 0.5) * 0.1
      }
    };
  });
}

// Doctor Profile Endpoint
app.get('/api/doctor-profile', async (req, res) => {
  try {
    const { name, specialization } = req.query;
    
    if (!name || !specialization) {
      return res.status(400).json({
        success: false,
        message: 'Doctor name and specialization are required'
      });
    }

    console.log(`🔍 Fetching profile for: ${name} - ${specialization}`);

    const profile = await getDoctorProfile(name, specialization);
    
    res.json({
      success: true,
      profile: profile
    });

  } catch (error) {
    console.error('❌ Error fetching doctor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor profile'
    });
  }
});

// Get Doctor Profile
async function getDoctorProfile(name, specialization) {
  const profileDatabase = {
    'Dr. A.B.M. Abdullah': {
      name: 'Dr. A.B.M. Abdullah',
      specialization: 'Neurologist',
      education: 'MBBS (DMC), FCPS (Medicine), MD (Neurology)',
      experience: '15 years of extensive experience',
      current_position: 'Professor of Neurology, BSMMU',
      hospital: 'Bangabandhu Sheikh Mujib Medical University',
      expertise: ['Stroke Management', 'Epilepsy', 'Headache Disorders', 'Movement Disorders'],
      languages: ['Bengali', 'English', 'Arabic'],
      rating: '4.8',
      review_count: '127',
      consultation_fee: '1200 BDT',
      availability: 'Monday, Wednesday, Friday: 9:00 AM - 5:00 PM',
      contact: '+880-2-9661065',
      address: 'Shahbag, Dhaka 1000, Bangladesh'
    },
    'Dr. S.M. Mustafa Zaman': {
      name: 'Dr. S.M. Mustafa Zaman',
      specialization: 'Cardiologist',
      education: 'MBBS (DMC), FCPS (Cardiology), FACC',
      experience: '18 years in cardiology',
      current_position: 'Senior Consultant Cardiologist',
      hospital: 'National Heart Foundation Hospital & Research Institute',
      expertise: ['Interventional Cardiology', 'Heart Failure', 'Hypertension', 'Coronary Artery Disease'],
      languages: ['Bengali', 'English'],
      rating: '4.7',
      review_count: '89',
      consultation_fee: '1000 BDT',
      availability: 'Saturday - Thursday: 9:00 AM - 3:00 PM',
      contact: '+880-2-8115857',
      address: 'Mirpur, Dhaka 1216, Bangladesh'
    }
  };

  return profileDatabase[name] || {
    name: name,
    specialization: specialization,
    education: 'MBBS, Specialization in ' + specialization,
    experience: '10+ years of experience',
    hospital: 'Leading Hospital in Dhaka',
    expertise: ['General ' + specialization + ' Services'],
    languages: ['Bengali', 'English'],
    rating: '4.5',
    consultation_fee: '800 BDT',
    availability: 'Monday - Friday: 9:00 AM - 5:00 PM',
    contact: 'Contact hospital for details',
    address: 'Dhaka, Bangladesh'
  };
}

// Book Appointment Endpoint
app.post('/api/book-appointment', async (req, res) => {
  try {
    const { doctorName, specialization, patientName, patientEmail, preferredDate, preferredTime, notes } = req.body;
    
    if (!doctorName || !specialization || !patientName || !patientEmail || !preferredDate || !preferredTime) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    console.log(`📅 Appointment booking request for: ${doctorName} by ${patientName}`);

    const appointmentId = 'APT' + Date.now();
    
    res.json({
      success: true,
      message: 'Appointment request submitted successfully!',
      appointment_id: appointmentId,
      details: {
        doctor: doctorName,
        specialization: specialization,
        patient: patientName,
        date: preferredDate,
        time: preferredTime,
        status: 'Pending Confirmation'
      },
      next_steps: 'The hospital will contact you within 24 hours to confirm your appointment.'
    });

  } catch (error) {
    console.error('❌ Error booking appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book appointment'
    });
  }
});

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

// Serve main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(frontendPath, 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

app.get('/family', (req, res) => {
  res.sendFile(path.join(frontendPath, 'family.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(frontendPath, 'profile.html'));
});

// NEW: Serve reset password page
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(frontendPath, 'reset-password.html'));
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${frontendPath}`);
  console.log(`🔧 Debug mode: ON`);
  console.log(`📧 Email mode: ${useFakeEmail ? 'FAKE (logs to console)' : 'REAL (sends actual emails)'}`);
  console.log(`📄 Available routes:`);
  console.log(`   http://localhost:${PORT}/ - Home page`);
  console.log(`   http://localhost:${PORT}/login - Login page`);
  console.log(`   http://localhost:${PORT}/register - Register page`);
  console.log(`   http://localhost:${PORT}/dashboard - Dashboard`);
  console.log(`   http://localhost:${PORT}/family - Family Management`);
  console.log(`   http://localhost:${PORT}/profile - Profile page`);
  console.log(`   http://localhost:${PORT}/reset-password - Reset Password page`);
  console.log(`   http://localhost:${PORT}/api/test - API test endpoint`);
  console.log(`   http://localhost:${PORT}/api/health - Health check`);
  console.log(`   http://localhost:${PORT}/api/register - User registration`);
  console.log(`   http://localhost:${PORT}/api/login - User login`);
  console.log(`   http://localhost:${PORT}/api/forgot-password - Request password reset`);
  console.log(`   http://localhost:${PORT}/api/reset-password - Reset password`);
  console.log(`   http://localhost:${PORT}/api/verify-reset-token - Verify reset token`);
  console.log(`   http://localhost:${PORT}/api/profile/:email - Get user profile`);
  console.log(`   http://localhost:${PORT}/api/profile/:email (PUT) - Update user profile`);
  console.log(`   http://localhost:${PORT}/api/family/members - Family members`);
  console.log(`   http://localhost:${PORT}/api/doctors?specialization=Neurologist - Doctor search`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please:`);
    console.log(`   1. Kill the process using port ${PORT}`);
    console.log(`   2. Or change the PORT variable in server.js`);
    console.log(`   3. Or wait a few minutes and try again`);
  } else {
    console.error('❌ Server error:', err);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server gracefully...');
  db.end((err) => {
    if (err) {
      console.error('Error closing database connection:', err);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});
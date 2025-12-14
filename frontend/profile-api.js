// profile-api.js
const express = require('express');
const mysql = require('mysql2');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'your_password', // Change this to your actual password
    database: 'healthmate_app'
});

// Test database connection
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// ---------------------------
// REGISTRATION ENDPOINT
// ---------------------------
app.post('/api/register', async (req, res) => {
    try {
        const {
            full_name,
            email,
            phone,
            password_hash,
            age,
            height_cm,
            weight_kg,
            blood_group,
            gender,
            address,
            chronic_diseases
        } = req.body;

        console.log('Registration attempt for:', email);

        // Validate required fields
        if (!full_name || !email || !phone || !password_hash || !age || 
            !height_cm || !weight_kg || !blood_group || !gender || !address) {
            return res.status(400).json({
                success: false,
                error: 'All required fields must be filled'
            });
        }

        // Insert into users table
        const [result] = await db.promise().query(
            `INSERT INTO users 
            (full_name, email, phone, password_hash, age, height_cm, weight_kg, 
             blood_group, gender, address, chronic_diseases) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                full_name,
                email.toLowerCase(),
                phone,
                password_hash,
                parseInt(age),
                parseFloat(height_cm),
                parseFloat(weight_kg),
                blood_group,
                gender,
                address,
                chronic_diseases
            ]
        );

        const userId = result.insertId;

        // Create default profile entry
        await db.promise().query(
            `INSERT INTO profiles (user_id) VALUES (?)`,
            [userId]
        );

        console.log('Registration successful for user ID:', userId);

        res.json({
            success: true,
            user_id: userId,
            message: 'Registration successful'
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle duplicate email/phone
        if (error.code === 'ER_DUP_ENTRY') {
            let field = 'Email or phone number';
            if (error.message.includes('email')) field = 'Email';
            if (error.message.includes('phone')) field = 'Phone number';
            
            return res.status(400).json({
                success: false,
                error: `${field} already registered`
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.'
        });
    }
});

// ---------------------------
// PROFILE ENDPOINTS
// ---------------------------

// API endpoint to get user profile
app.get('/api/profile/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Query to get user data with profile info
        const query = `
            SELECT 
                u.*,
                p.profile_picture,
                p.bio,
                p.health_goal,
                p.emergency_contact_name,
                p.emergency_contact_phone,
                p.emergency_relation
            FROM users u
            LEFT JOIN profiles p ON u.user_id = p.user_id
            WHERE u.user_id = ?
        `;
        
        const [userRows] = await db.promise().query(query, [userId]);
        
        if (userRows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }
        
        const user = userRows[0];
        
        // Parse chronic diseases if they exist
        let chronicDiseases = [];
        if (user.chronic_diseases) {
            try {
                chronicDiseases = JSON.parse(user.chronic_diseases);
            } catch (e) {
                console.error('Error parsing chronic diseases:', e);
            }
        }
        
        res.json({
            success: true,
            user: {
                user_id: user.user_id,
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
                account_status: user.account_status,
                created_at: user.created_at
            },
            profile: {
                profile_picture: user.profile_picture,
                bio: user.bio,
                health_goal: user.health_goal,
                emergency_contact_name: user.emergency_contact_name,
                emergency_contact_phone: user.emergency_contact_phone,
                emergency_relation: user.emergency_relation
            }
        });
        
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// API endpoint to get current user from session/token
app.get('/api/profile/me', async (req, res) => {
    try {
        // Get user ID from headers or query
        const userId = req.headers['x-user-id'] || req.query.user_id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                error: 'User not authenticated' 
            });
        }
        
        // Use the existing profile endpoint
        const [userRows] = await db.promise().query(
            'SELECT * FROM users WHERE user_id = ?',
            [userId]
        );
        
        if (userRows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }
        
        const user = userRows[0];
        
        // Get profile data
        const [profileRows] = await db.promise().query(
            'SELECT * FROM profiles WHERE user_id = ?',
            [userId]
        );
        
        // Parse chronic diseases
        let chronicDiseases = [];
        if (user.chronic_diseases) {
            try {
                chronicDiseases = JSON.parse(user.chronic_diseases);
            } catch (e) {
                console.error('Error parsing chronic diseases:', e);
            }
        }
        
        res.json({
            success: true,
            user: {
                user_id: user.user_id,
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
                account_status: user.account_status,
                created_at: user.created_at
            },
            profile: profileRows[0] || {}
        });
        
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// ---------------------------
// UPDATE PROFILE ENDPOINT
// ---------------------------
app.put('/api/profile/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const updateData = req.body;
        
        // Build dynamic update query
        const fields = [];
        const values = [];
        
        if (updateData.full_name) {
            fields.push('full_name = ?');
            values.push(updateData.full_name);
        }
        if (updateData.email) {
            fields.push('email = ?');
            values.push(updateData.email.toLowerCase());
        }
        if (updateData.phone) {
            fields.push('phone = ?');
            values.push(updateData.phone);
        }
        if (updateData.age) {
            fields.push('age = ?');
            values.push(parseInt(updateData.age));
        }
        if (updateData.height_cm) {
            fields.push('height_cm = ?');
            values.push(parseFloat(updateData.height_cm));
        }
        if (updateData.weight_kg) {
            fields.push('weight_kg = ?');
            values.push(parseFloat(updateData.weight_kg));
        }
        if (updateData.blood_group) {
            fields.push('blood_group = ?');
            values.push(updateData.blood_group);
        }
        if (updateData.gender) {
            fields.push('gender = ?');
            values.push(updateData.gender);
        }
        if (updateData.address) {
            fields.push('address = ?');
            values.push(updateData.address);
        }
        if (updateData.chronic_diseases) {
            fields.push('chronic_diseases = ?');
            values.push(JSON.stringify(updateData.chronic_diseases));
        }
        
        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }
        
        values.push(userId);
        
        const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;
        
        await db.promise().query(query, values);
        
        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating profile:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: 'Email or phone number already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to update profile'
        });
    }
});

// ---------------------------
// HEALTH STATUS CHECK
// ---------------------------
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'HealthMate API is running',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`HealthMate API server running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  POST   /api/register       - Register new user`);
    console.log(`  GET    /api/profile/:id    - Get user profile`);
    console.log(`  GET    /api/profile/me     - Get current user profile`);
    console.log(`  PUT    /api/profile/:id    - Update user profile`);
    console.log(`  GET    /api/health         - Health check`);
});
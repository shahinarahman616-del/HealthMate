CREATE TABLE IF NOT EXISTS family_relationships (
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
);

-- Family access logs table
CREATE TABLE IF NOT EXISTS family_access_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    relationship_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    accessed_section VARCHAR(100),
    details JSON,
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (relationship_id) REFERENCES family_relationships(relationship_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Emergency access requests table
CREATE TABLE IF NOT EXISTS emergency_access_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    requester_user_id INT NOT NULL,
    target_user_id INT NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (requester_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
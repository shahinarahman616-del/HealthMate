-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: healthmate_app
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `profiles`
--

DROP TABLE IF EXISTS `profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `profiles` (
  `profile_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `profile_picture` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'default_profile.png',
  `bio` text COLLATE utf8mb4_unicode_ci,
  `health_goal` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_contact_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_relation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`profile_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profiles`
--

LOCK TABLES `profiles` WRITE;
/*!40000 ALTER TABLE `profiles` DISABLE KEYS */;
INSERT INTO `profiles` (`user_id`, `profile_picture`, `bio`, `health_goal`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_relation`) VALUES
(1, 'default_profile.png', 'Health conscious individual focused on wellness', 'Weight Management', 'John Doe', '+8801712345678', 'Spouse'),
(2, 'default_profile.png', 'Family member with health tracking needs', 'Regular Exercise', 'Demo User', '+8801712345679', 'Spouse'),
(3, 'default_profile.png', 'Family health management', 'Balanced Diet', 'Demo User', '+8801712345680', 'Sibling');
/*!40000 ALTER TABLE `profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `health_goals`
--

DROP TABLE IF EXISTS `health_goals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `health_goals` (
  `goal_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `goal_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal_description` text COLLATE utf8mb4_unicode_ci,
  `target_date` date DEFAULT NULL,
  `status` enum('Not Started','In Progress','Completed','On Hold') COLLATE utf8mb4_unicode_ci DEFAULT 'Not Started',
  `progress` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`goal_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `health_goals_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `health_goals`
--

LOCK TABLES `health_goals` WRITE;
/*!40000 ALTER TABLE `health_goals` DISABLE KEYS */;
INSERT INTO `health_goals` (`user_id`, `goal_name`, `goal_description`, `target_date`, `status`, `progress`) VALUES
(1, 'Weight Management', 'Lose 5kg in 3 months', '2025-02-16', 'In Progress', 40),
(1, 'Regular Exercise', 'Exercise 30 minutes daily', '2025-12-31', 'Not Started', 0),
(1, 'Balanced Diet', 'Eat balanced meals with proper nutrition', '2025-01-31', 'Completed', 100),
(2, 'Regular Exercise', 'Daily morning walk', '2025-12-31', 'In Progress', 60),
(3, 'Balanced Diet', 'Reduce sugar intake', '2025-01-31', 'In Progress', 70);
/*!40000 ALTER TABLE `health_goals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recent_activities`
--

DROP TABLE IF EXISTS `recent_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recent_activities` (
  `activity_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `activity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_details` text COLLATE utf8mb4_unicode_ci,
  `activity_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`activity_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `recent_activities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recent_activities`
--

LOCK TABLES `recent_activities` WRITE;
/*!40000 ALTER TABLE `recent_activities` DISABLE KEYS */;
INSERT INTO `recent_activities` (`user_id`, `activity_type`, `activity_title`, `activity_details`, `activity_date`) VALUES
(1, 'report', 'Medical report uploaded', 'Uploaded annual checkup report', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, 'appointment', 'Appointment scheduled', 'Scheduled with Dr. Smith for next week', DATE_SUB(NOW(), INTERVAL 1 WEEK)),
(1, 'symptom', 'Symptom logged', 'Logged headache symptoms', DATE_SUB(NOW(), INTERVAL 2 WEEK)),
(1, 'goal', 'Health goal updated', 'Updated weight management goal', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(1, 'profile', 'Profile information updated', 'Updated emergency contact', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(2, 'report', 'Blood test uploaded', 'Uploaded recent blood test results', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(3, 'appointment', 'Dentist appointment', 'Scheduled dental checkup', DATE_SUB(NOW(), INTERVAL 3 DAY));
/*!40000 ALTER TABLE `recent_activities` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-16 23:12:04

-- Add profiles table
CREATE TABLE IF NOT EXISTS profiles (
  profile_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  profile_picture VARCHAR(255) DEFAULT 'default_profile.png',
  bio TEXT,
  health_goal VARCHAR(255),
  emergency_contact_name VARCHAR(150),
  emergency_contact_phone VARCHAR(20),
  emergency_relation VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add health_goals table
CREATE TABLE IF NOT EXISTS health_goals (
  goal_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  goal_name VARCHAR(255) NOT NULL,
  goal_description TEXT,
  target_date DATE,
  status ENUM('Not Started', 'In Progress', 'Completed', 'On Hold') DEFAULT 'Not Started',
  progress INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add recent_activities table
CREATE TABLE IF NOT EXISTS recent_activities (
  activity_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_details TEXT,
  activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NEW TABLES FOR INTERACTIVE FEATURES
-- ============================================

-- Health metrics tracking table
CREATE TABLE IF NOT EXISTS health_metrics (
  metric_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'weight', 'blood_pressure', 'blood_sugar', 'heart_rate', 'oxygen'
  value VARCHAR(50) NOT NULL,
  unit VARCHAR(20),
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_metric (user_id, metric_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily health goals tracking
CREATE TABLE IF NOT EXISTS daily_goals (
  goal_day_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  goal_date DATE NOT NULL,
  water_goal DECIMAL(5,2) DEFAULT 2.0, -- liters
  water_actual DECIMAL(5,2) DEFAULT 0,
  steps_goal INT DEFAULT 10000,
  steps_actual INT DEFAULT 0,
  sleep_goal DECIMAL(4,2) DEFAULT 8.0, -- hours
  sleep_actual DECIMAL(4,2) DEFAULT 0,
  calories_goal INT DEFAULT 2000,
  calories_actual INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (user_id, goal_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Allergies table
CREATE TABLE IF NOT EXISTS allergies (
  allergy_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  allergy_name VARCHAR(100) NOT NULL,
  severity ENUM('Mild', 'Moderate', 'Severe', 'Life-threatening') DEFAULT 'Moderate',
  notes TEXT,
  diagnosed_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Medications table
CREATE TABLE IF NOT EXISTS medications (
  medication_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  medication_name VARCHAR(100) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(50),
  start_date DATE,
  end_date DATE,
  prescribing_doctor VARCHAR(100),
  notes TEXT,
  status ENUM('Active', 'Completed', 'Stopped') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Medication log table (for tracking when meds are taken)
CREATE TABLE IF NOT EXISTS medication_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  medication_id INT NOT NULL,
  user_id INT NOT NULL,
  taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_medication (user_id, medication_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Health achievements table
CREATE TABLE IF NOT EXISTS health_achievements (
  achievement_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  achievement_type VARCHAR(50) NOT NULL, -- 'streak', 'goal_completion', 'milestone'
  achievement_name VARCHAR(100) NOT NULL,
  description TEXT,
  achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  icon VARCHAR(50),
  color VARCHAR(20),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_achievements (user_id, achievement_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Health tips table
CREATE TABLE IF NOT EXISTS health_tips (
  tip_id INT AUTO_INCREMENT PRIMARY KEY,
  tip_text TEXT NOT NULL,
  category VARCHAR(50),
  priority INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User health settings/preferences
CREATE TABLE IF NOT EXISTS user_health_settings (
  setting_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  setting_key VARCHAR(50) NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_setting (user_id, setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


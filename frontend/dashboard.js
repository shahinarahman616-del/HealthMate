// Base URL of your Render backend
const API_BASE_URL = 'https://healthmate-backend-m6xy.onrender.com';

// Global variables
let userLocation = null;
let userCity = 'Dhaka';
let userCoordinates = null;

function checkAuth() {
    const isLoggedIn = localStorage.getItem('healthmate_loggedIn');
    const userEmail = localStorage.getItem('healthmate_user');
    
    if (!isLoggedIn || !userEmail) {
        window.location.href = 'login.html';
        return;
    }
    
    loadUserData(userEmail);
}

function loadUserData(email) {
    document.getElementById('profileName').textContent = email.split('@')[0];
    document.getElementById('profileEmail').textContent = email;
    document.getElementById('profileAge').textContent = '25';
    document.getElementById('userName').textContent = email.split('@')[0] + ' (You)';
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
    
    // Auto-detect location when AI Health Insights section is opened
    if (sectionId === 'aiHealthInsights') {
        setTimeout(() => {
            detectLocation();
        }, 500);
    }
}

// Location Detection Functions
function detectLocation() {
    const locationStatus = document.getElementById('locationStatus');
    const locationDetails = document.getElementById('locationDetails');
    
    locationStatus.textContent = 'Detecting your location...';
    locationDetails.classList.add('hidden');
    
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation is not supported by this browser. Using default location (Dhaka).';
        userCity = 'Dhaka';
        updateLocationDisplay();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            userCoordinates = { latitude, longitude };
            
            locationStatus.textContent = 'Location detected! Getting address...';
            
            try {
                // For demo purposes, we'll use Dhaka as default
                userCity = 'Dhaka';
                userLocation = 'Dhaka, Bangladesh';
                
                locationStatus.textContent = `Location detected successfully!`;
                updateLocationDisplay();
                locationDetails.classList.remove('hidden');
                
            } catch (error) {
                console.error('Error getting address:', error);
                locationStatus.textContent = 'Location detected but could not get address. Using default search area.';
                userCity = 'Dhaka';
                updateLocationDisplay();
                locationDetails.classList.remove('hidden');
            }
        },
        (error) => {
            console.error('Error getting location:', error);
            let errorMessage = 'Unable to detect your location. ';
            
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Location access was denied. Using default location (Dhaka).';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable. Using default location (Dhaka).';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out. Using default location (Dhaka).';
                    break;
                default:
                    errorMessage += 'An unknown error occurred. Using default location (Dhaka).';
                    break;
            }
            
            locationStatus.textContent = errorMessage;
            userCity = 'Dhaka';
            updateLocationDisplay();
            locationDetails.classList.remove('hidden');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

function updateLocationDisplay() {
    document.getElementById('detectedLocation').textContent = userLocation || userCity;
    document.getElementById('searchArea').textContent = userCity;
    document.getElementById('distanceFilter').textContent = 'Within 5 km radius';
}

// Enhanced Doctor Functions with Backend Integration
async function fetchDoctorsFromBackend(doctorType) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/doctors?specialization=${encodeURIComponent(doctorType)}&location=${encodeURIComponent(userCity)}`);
        const data = await response.json();
        
        if (data.success && data.doctors) {
            console.log(`✅ Found ${data.doctors.length} doctors from backend`);
            return data.doctors;
        } else {
            throw new Error(data.message || 'Failed to fetch doctors');
        }
    } catch (error) {
        console.error('❌ Backend fetch failed:', error);
        // Fallback to local sample data
        return generateSampleDoctors(doctorType);
    }
}

async function viewDoctorProfile(name, specialization) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/doctor-profile?name=${encodeURIComponent(name)}&specialization=${encodeURIComponent(specialization)}`);
        const data = await response.json();
        
        if (data.success && data.profile) {
            showDoctorProfileModal(data.profile);
        } else {
            showDemoProfile(name, specialization);
        }
    } catch (error) {
        console.error('Error fetching doctor profile:', error);
        showDemoProfile(name, specialization);
    }
}

function showDoctorProfileModal(profile) {
    const modalHtml = `...`; // Keep your existing modal HTML here
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    modalContainer.id = 'doctorProfileModal';
    document.body.appendChild(modalContainer);
}

async function submitAppointment(event, doctorName, specialization) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const appointmentData = {
        doctorName: doctorName,
        specialization: specialization,
        patientName: formData.get('name') || form.querySelector('input[type="text"]').value,
        patientEmail: formData.get('email') || form.querySelector('input[type="email"]').value,
        preferredDate: formData.get('date') || form.querySelector('input[type="date"]').value,
        preferredTime: formData.get('time') || form.querySelector('select').value,
        notes: formData.get('notes') || form.querySelector('textarea').value
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/book-appointment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appointmentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ ' + result.message + '\nAppointment ID: ' + result.appointment_id);
            closeModal();
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
        alert('❌ Failed to book appointment. Please try again.');
    }
}

function closeModal() {
    const modal = document.getElementById('doctorProfileModal');
    if (modal) {
        modal.remove();
    }
}

// Keep your existing fallback and modal functions
function showDemoProfile(name, specialization) { /* ... keep your current code ... */ }
function bookAppointment(name, specialization, hospital) { /* ... keep your current code ... */ }
function showModal(html, id) { /* ... keep your current code ... */ }
function confirmAppointment() { /* ... keep your current code ... */ }

// Family, Reminder, Report modals
function openFamilyModal() { document.getElementById('familyModal').classList.remove('hidden'); }
function closeFamilyModal() { document.getElementById('familyModal').classList.add('hidden'); }
function openReminderModal() { document.getElementById('reminderModal').classList.remove('hidden'); }
function closeReminderModal() { document.getElementById('reminderModal').classList.add('hidden'); }
function openReportModal() { document.getElementById('reportModal').classList.remove('hidden'); }
function closeReportModal() { document.getElementById('reportModal').classList.add('hidden'); }
function saveFamilyMember() {
    const name = document.getElementById('familyName').value;
    if (name) {
        const familyList = document.getElementById('familyList');
        const li = document.createElement('li');
        li.textContent = name;
        familyList.appendChild(li);
        closeFamilyModal();
        document.getElementById('familyName').value = '';
    }
}

function logout() {
    localStorage.removeItem('healthmate_user');
    localStorage.removeItem('healthmate_loggedIn');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    showSection('dashboard');
    
    // Initialize body hotspots if they exist
    if (typeof initHotspots === 'function') {
        setTimeout(initHotspots, 1000);
    }
});

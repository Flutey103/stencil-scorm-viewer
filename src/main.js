import { ScormManager } from './scorm/ScormManager.js';
import { FileUploader } from './upload/FileUploader.js';
import { CourseLibrary } from './library/CourseLibrary.js';
import { ScormPlayer } from './player/ScormPlayer.js';

class ScormViewerApp {
    constructor() {
        this.scormManager = new ScormManager();
        this.fileUploader = new FileUploader();
        this.courseLibrary = new CourseLibrary();
        this.scormPlayer = new ScormPlayer();
        
        this.currentSection = 'upload';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showSection('upload');
        this.loadCourses();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.showSection('upload');
        });

        document.getElementById('library-btn').addEventListener('click', () => {
            this.showSection('library');
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            this.scormPlayer.stop();
            this.showSection('library');
        });

        // File upload
        this.fileUploader.onUploadComplete = (courseData) => {
            this.handleCourseUpload(courseData);
        };

        // Course selection
        this.courseLibrary.onCourseSelect = (courseId) => {
            this.playCourse(courseId);
        };

        // Fullscreen
        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });
    }

    showSection(sectionName) {
        // Hide all sections
        document.getElementById('upload-section').style.display = 'none';
        document.getElementById('library-section').style.display = 'none';
        document.getElementById('player-section').style.display = 'none';

        // Show selected section
        document.getElementById(`${sectionName}-section`).style.display = 'block';
        this.currentSection = sectionName;

        // Update navigation
        document.querySelectorAll('.nav .btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (sectionName !== 'player') {
            document.getElementById(`${sectionName}-btn`).classList.add('active');
        }
    }

    async handleCourseUpload(courseData) {
        try {
            // Save course to storage
            await this.scormManager.saveCourse(courseData);
            
            // Refresh library
            await this.loadCourses();
            
            // Show library
            this.showSection('library');
            
            // Show success message
            this.showNotification('Course uploaded successfully!', 'success');
        } catch (error) {
            console.error('Error saving course:', error);
            this.showNotification('Error uploading course', 'error');
        }
    }

    async loadCourses() {
        try {
            const courses = await this.scormManager.getCourses();
            this.courseLibrary.render(courses);
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    async playCourse(courseId) {
        try {
            const course = await this.scormManager.getCourse(courseId);
            if (course) {
                this.scormPlayer.load(course);
                this.showSection('player');
                document.getElementById('course-title').textContent = course.title;
            }
        } catch (error) {
            console.error('Error playing course:', error);
            this.showNotification('Error loading course', 'error');
        }
    }

    toggleFullscreen() {
        const playerSection = document.getElementById('player-section');
        if (!document.fullscreenElement) {
            playerSection.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        if (type === 'success') {
            notification.style.background = '#10b981';
        } else if (type === 'error') {
            notification.style.background = '#ef4444';
        } else {
            notification.style.background = '#3b82f6';
        }

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScormViewerApp();
});
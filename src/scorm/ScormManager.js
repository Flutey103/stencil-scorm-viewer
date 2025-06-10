export class ScormManager {
    constructor() {
        this.storageKey = 'scorm-courses';
        this.dataKey = 'scorm-data';
        this.dbName = 'scorm-files-db';
        this.dbVersion = 1;
        this.filesStoreName = 'course-files';
    }

    // Initialize IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.filesStoreName)) {
                    db.createObjectStore(this.filesStoreName, { keyPath: 'courseId' });
                }
            };
        });
    }

    // Store files in IndexedDB
    async storeFilesInIndexedDB(courseId, files) {
        const db = await this.initDB();
        const transaction = db.transaction([this.filesStoreName], 'readwrite');
        const store = transaction.objectStore(this.filesStoreName);
        
        return new Promise((resolve, reject) => {
            const request = store.put({ courseId, files });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Retrieve files from IndexedDB
    async getFilesFromIndexedDB(courseId) {
        const db = await this.initDB();
        const transaction = db.transaction([this.filesStoreName], 'readonly');
        const store = transaction.objectStore(this.filesStoreName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(courseId);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.files : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Delete files from IndexedDB
    async deleteFilesFromIndexedDB(courseId) {
        const db = await this.initDB();
        const transaction = db.transaction([this.filesStoreName], 'readwrite');
        const store = transaction.objectStore(this.filesStoreName);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(courseId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveCourse(courseData) {
        const courses = await this.getCourses();
        const courseId = this.generateId();
        
        // Store files in IndexedDB
        if (courseData.files) {
            await this.storeFilesInIndexedDB(courseId, courseData.files);
        }
        
        // Store only metadata in localStorage (without files)
        const course = {
            id: courseId,
            title: courseData.title || 'Untitled Course',
            description: courseData.description || '',
            manifest: courseData.manifest,
            entryPoint: courseData.entryPoint,
            uploadDate: new Date().toISOString(),
            lastAccessed: null,
            progress: {
                status: 'not attempted',
                score: null,
                completionStatus: 'incomplete',
                sessionTime: '00:00:00',
                totalTime: '00:00:00'
            }
        };

        courses[courseId] = course;
        localStorage.setItem(this.storageKey, JSON.stringify(courses));
        
        return course;
    }

    async getCourses() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : {};
    }

    async getCourse(courseId) {
        const courses = await this.getCourses();
        const course = courses[courseId];
        
        if (!course) {
            return null;
        }
        
        // Retrieve files from IndexedDB and add to course object
        const files = await this.getFilesFromIndexedDB(courseId);
        return {
            ...course,
            files: files
        };
    }

    async deleteCourse(courseId) {
        const courses = await this.getCourses();
        delete courses[courseId];
        localStorage.setItem(this.storageKey, JSON.stringify(courses));
        
        // Delete files from IndexedDB
        await this.deleteFilesFromIndexedDB(courseId);
        
        // Also delete course data
        const courseDataKey = `${this.dataKey}-${courseId}`;
        localStorage.removeItem(courseDataKey);
    }

    async updateCourseProgress(courseId, progressData) {
        const courses = await this.getCourses();
        if (courses[courseId]) {
            courses[courseId].progress = { ...courses[courseId].progress, ...progressData };
            courses[courseId].lastAccessed = new Date().toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(courses));
        }
    }

    async getCourseData(courseId) {
        const courseDataKey = `${this.dataKey}-${courseId}`;
        const stored = localStorage.getItem(courseDataKey);
        return stored ? JSON.parse(stored) : {};
    }

    async setCourseData(courseId, data) {
        const courseDataKey = `${this.dataKey}-${courseId}`;
        const existing = await this.getCourseData(courseId);
        const updated = { ...existing, ...data };
        localStorage.setItem(courseDataKey, JSON.stringify(updated));
        return updated;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    parseTime(timeString) {
        if (!timeString || timeString === '00:00:00') return 0;
        const parts = timeString.split(':');
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
}
export class ScormPlayer {
    constructor() {
        this.currentCourse = null;
        this.scormAPI = null;
        this.courseData = {};
        this.startTime = null;
        this.sessionTime = 0;
        this.init();
    }

    init() {
        this.setupScormAPI();
    }

    setupScormAPI() {
        // Create SCORM API that will be available to the course
        this.scormAPI = {
            // SCORM 1.2 API
            LMSInitialize: () => this.initialize(),
            LMSFinish: () => this.finish(),
            LMSGetValue: (element) => this.getValue(element),
            LMSSetValue: (element, value) => this.setValue(element, value),
            LMSCommit: () => this.commit(),
            LMSGetLastError: () => this.getLastError(),
            LMSGetErrorString: (errorCode) => this.getErrorString(errorCode),
            LMSGetDiagnostic: (errorCode) => this.getDiagnostic(errorCode),

            // SCORM 2004 API
            Initialize: () => this.initialize(),
            Terminate: () => this.finish(),
            GetValue: (element) => this.getValue(element),
            SetValue: (element, value) => this.setValue(element, value),
            Commit: () => this.commit(),
            GetLastError: () => this.getLastError(),
            GetErrorString: (errorCode) => this.getErrorString(errorCode),
            GetDiagnostic: (errorCode) => this.getDiagnostic(errorCode)
        };

        // Make API available globally
        window.API = this.scormAPI;
        window.API_1484_11 = this.scormAPI;
    }

    async load(course) {
        this.currentCourse = course;
        
        // Load existing course data
        const { ScormManager } = await import('../scorm/ScormManager.js');
        this.scormManager = new ScormManager();
        this.courseData = await this.scormManager.getCourseData(course.id);

        // Create blob URLs for course files
        const courseUrl = this.createCourseUrl(course);
        
        // Load course in iframe
        const iframe = document.getElementById('scorm-frame');
        iframe.src = courseUrl;

        // Update UI
        this.updateProgressDisplay();
        
        // Set up iframe load handler
        iframe.onload = () => {
            this.injectAPI(iframe);
        };
    }

    createCourseUrl(course) {
        if (!course.entryPoint) {
            throw new Error('No entry point found for course');
        }

        // Create a blob URL for the entry point
        const entryContent = course.files[course.entryPoint];
        let processedContent = entryContent;

        // Process HTML content to fix relative paths
        if (course.entryPoint.toLowerCase().endsWith('.html') || course.entryPoint.toLowerCase().endsWith('.htm')) {
            processedContent = this.processHtmlContent(entryContent, course.files);
        }

        const blob = new Blob([processedContent], { type: 'text/html' });
        return URL.createObjectURL(blob);
    }

    processHtmlContent(htmlContent, files) {
        // Replace relative file references with blob URLs
        let processed = htmlContent;

        // Find all src and href attributes
        const srcRegex = /(src|href)=["']([^"']+)["']/gi;
        
        processed = processed.replace(srcRegex, (match, attr, path) => {
            // Skip absolute URLs
            if (path.startsWith('http') || path.startsWith('//') || path.startsWith('data:')) {
                return match;
            }

            // Check if file exists in package
            if (files[path]) {
                const fileContent = files[path];
                let mimeType = this.getMimeType(path);
                
                // Handle base64 encoded files
                if (this.isBinaryFile(path)) {
                    const blob = this.base64ToBlob(fileContent, mimeType);
                    const blobUrl = URL.createObjectURL(blob);
                    return `${attr}="${blobUrl}"`;
                } else {
                    const blob = new Blob([fileContent], { type: mimeType });
                    const blobUrl = URL.createObjectURL(blob);
                    return `${attr}="${blobUrl}"`;
                }
            }

            return match;
        });

        return processed;
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    getMimeType(path) {
        const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
        const mimeTypes = {
            '.html': 'text/html',
            '.htm': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
            '.pdf': 'application/pdf'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    isBinaryFile(path) {
        const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', 
                                 '.mp3', '.mp4', '.wav', '.avi', '.mov', '.pdf', '.swf',
                                 '.woff', '.woff2', '.ttf', '.eot'];
        
        const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
        return binaryExtensions.includes(ext);
    }

    injectAPI(iframe) {
        try {
            // Try to inject API into iframe
            const iframeWindow = iframe.contentWindow;
            if (iframeWindow) {
                iframeWindow.API = this.scormAPI;
                iframeWindow.API_1484_11 = this.scormAPI;
            }
        } catch (error) {
            console.warn('Could not inject API into iframe (cross-origin):', error);
        }
    }

    // SCORM API Methods
    initialize() {
        console.log('SCORM: Initialize called');
        this.startTime = Date.now();
        this.updateCourseStatus('incomplete');
        return 'true';
    }

    finish() {
        console.log('SCORM: Finish called');
        this.calculateSessionTime();
        this.commit();
        return 'true';
    }

    getValue(element) {
        console.log('SCORM: GetValue called for', element);
        
        // Handle standard SCORM elements
        switch (element) {
            case 'cmi.core.lesson_status':
            case 'cmi.completion_status':
                return this.courseData.lesson_status || 'not attempted';
            
            case 'cmi.core.score.raw':
            case 'cmi.score.raw':
                return this.courseData.score_raw || '';
            
            case 'cmi.core.score.min':
            case 'cmi.score.min':
                return this.courseData.score_min || '0';
            
            case 'cmi.core.score.max':
            case 'cmi.score.max':
                return this.courseData.score_max || '100';
            
            case 'cmi.core.session_time':
            case 'cmi.session_time':
                return this.formatTime(this.sessionTime);
            
            case 'cmi.core.total_time':
            case 'cmi.total_time':
                return this.courseData.total_time || '00:00:00';
            
            case 'cmi.core.student_id':
            case 'cmi.learner_id':
                return 'student_001';
            
            case 'cmi.core.student_name':
            case 'cmi.learner_name':
                return 'Student';
            
            default:
                return this.courseData[element] || '';
        }
    }

    setValue(element, value) {
        console.log('SCORM: SetValue called for', element, '=', value);
        
        this.courseData[element] = value;
        
        // Handle standard elements
        switch (element) {
            case 'cmi.core.lesson_status':
            case 'cmi.completion_status':
                this.updateCourseStatus(value);
                break;
            
            case 'cmi.core.score.raw':
            case 'cmi.score.raw':
                this.updateCourseScore(value);
                break;
        }

        this.updateScormDataDisplay();
        return 'true';
    }

    commit() {
        console.log('SCORM: Commit called');
        this.saveCourseData();
        return 'true';
    }

    getLastError() {
        return '0';
    }

    getErrorString(errorCode) {
        return errorCode === '0' ? 'No Error' : 'Unknown Error';
    }

    getDiagnostic(errorCode) {
        return this.getErrorString(errorCode);
    }

    // Helper methods
    calculateSessionTime() {
        if (this.startTime) {
            this.sessionTime = Math.floor((Date.now() - this.startTime) / 1000);
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateCourseStatus(status) {
        document.getElementById('course-status').textContent = status;
    }

    updateCourseScore(score) {
        document.getElementById('course-score').textContent = score || '-';
    }

    updateProgressDisplay() {
        const status = this.courseData['cmi.core.lesson_status'] || 'not attempted';
        const score = this.courseData['cmi.core.score.raw'] || '-';
        const totalTime = this.courseData['cmi.core.total_time'] || '00:00:00';

        document.getElementById('course-status').textContent = status;
        document.getElementById('course-score').textContent = score;
        document.getElementById('course-time').textContent = totalTime;

        this.updateScormDataDisplay();
    }

    updateScormDataDisplay() {
        const dataContent = document.getElementById('scorm-data-content');
        const dataEntries = Object.entries(this.courseData)
            .filter(([key]) => key.startsWith('cmi.'))
            .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
            .join('');
        
        dataContent.innerHTML = dataEntries || '<div>No SCORM data yet</div>';
    }

    async saveCourseData() {
        // Capture current course and scorm manager before any await calls
        // to prevent race condition where stop() might set them to null
        const currentCourse = this.currentCourse;
        const scormManager = this.scormManager;
        
        if (currentCourse && scormManager) {
            const courseId = currentCourse.id;
            
            await scormManager.setCourseData(courseId, this.courseData);
            
            // Update course progress
            const progressData = {
                status: this.courseData['cmi.core.lesson_status'] || 'not attempted',
                score: this.courseData['cmi.core.score.raw'] || null,
                sessionTime: this.formatTime(this.sessionTime),
                totalTime: this.courseData['cmi.core.total_time'] || '00:00:00'
            };
            
            await scormManager.updateCourseProgress(courseId, progressData);
        }
    }

    stop() {
        // Clean up when stopping the player
        this.calculateSessionTime();
        this.commit();
        
        // Clear iframe
        const iframe = document.getElementById('scorm-frame');
        iframe.src = 'about:blank';
        
        // Reset state
        this.currentCourse = null;
        this.courseData = {};
        this.startTime = null;
        this.sessionTime = 0;
    }
}
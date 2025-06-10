export class CourseLibrary {
    constructor() {
        this.onCourseSelect = null;
    }

    render(courses) {
        const grid = document.getElementById('course-grid');
        grid.innerHTML = '';

        const courseArray = Object.values(courses);
        
        if (courseArray.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: #64748b;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                    <h3>No courses uploaded yet</h3>
                    <p>Upload your first SCORM package to get started</p>
                </div>
            `;
            return;
        }

        courseArray.forEach(course => {
            const card = this.createCourseCard(course);
            grid.appendChild(card);
        });
    }

    createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        const uploadDate = new Date(course.uploadDate).toLocaleDateString();
        const lastAccessed = course.lastAccessed 
            ? new Date(course.lastAccessed).toLocaleDateString()
            : 'Never';

        const statusColor = this.getStatusColor(course.progress.status);
        
        card.innerHTML = `
            <h3>${course.title}</h3>
            <p>${course.description || 'No description available'}</p>
            <div class="course-meta">
                <span>Uploaded: ${uploadDate}</span>
                <span style="color: ${statusColor}">●</span>
            </div>
            <div class="course-meta" style="margin-top: 0.5rem;">
                <span>Last accessed: ${lastAccessed}</span>
                <span>${course.progress.status}</span>
            </div>
            <div class="course-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button class="btn btn-primary btn-sm play-btn" data-course-id="${course.id}">
                    ▶ Launch Course
                </button>
                <button class="btn btn-secondary btn-sm delete-btn" data-course-id="${course.id}">
                    🗑 Delete
                </button>
            </div>
        `;

        // Add event listeners
        const playBtn = card.querySelector('.play-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onCourseSelect) {
                this.onCourseSelect(course.id);
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteCourse(course.id);
        });

        return card;
    }

    getStatusColor(status) {
        switch (status) {
            case 'completed': return '#10b981';
            case 'incomplete': return '#f59e0b';
            case 'failed': return '#ef4444';
            case 'passed': return '#10b981';
            default: return '#94a3b8';
        }
    }

    async deleteCourse(courseId) {
        if (confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
            try {
                // Import ScormManager dynamically to avoid circular dependencies
                const { ScormManager } = await import('../scorm/ScormManager.js');
                const scormManager = new ScormManager();
                await scormManager.deleteCourse(courseId);
                
                // Refresh the library
                const courses = await scormManager.getCourses();
                this.render(courses);
            } catch (error) {
                console.error('Error deleting course:', error);
                alert('Error deleting course');
            }
        }
    }
}

// Add button styles
const style = document.createElement('style');
style.textContent = `
    .btn-sm {
        padding: 0.5rem 1rem;
        font-size: 0.75rem;
    }
    
    .course-actions {
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    
    .course-card:hover .course-actions {
        opacity: 1;
    }
`;
document.head.appendChild(style);
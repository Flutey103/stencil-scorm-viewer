export class FileUploader {
    constructor() {
        this.onUploadComplete = null;
        this.init();
    }

    init() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        // File input
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }

    async handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            alert('Please select a ZIP file containing your SCORM package.');
            return;
        }

        this.showProgress();

        try {
            const courseData = await this.extractScormPackage(file);
            this.hideProgress();
            
            if (this.onUploadComplete) {
                this.onUploadComplete(courseData);
            }
        } catch (error) {
            console.error('Error processing SCORM package:', error);
            this.hideProgress();
            alert('Error processing SCORM package. Please ensure it\'s a valid SCORM file.');
        }
    }

    async extractScormPackage(file) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        this.updateProgress(10, 'Reading ZIP file...');
        const zipContent = await zip.loadAsync(file);
        
        this.updateProgress(30, 'Extracting files...');
        const files = {};
        let manifest = null;
        let entryPoint = null;

        // Extract all files
        for (const [path, zipEntry] of Object.entries(zipContent.files)) {
            if (!zipEntry.dir) {
                if (path.toLowerCase() === 'imsmanifest.xml') {
                    const content = await zipEntry.async('text');
                    manifest = this.parseManifest(content);
                    files[path] = content;
                } else {
                    // For binary files, store as base64
                    if (this.isBinaryFile(path)) {
                        files[path] = await zipEntry.async('base64');
                    } else {
                        files[path] = await zipEntry.async('text');
                    }
                }
            }
        }

        this.updateProgress(70, 'Processing manifest...');

        // Find entry point
        if (manifest) {
            entryPoint = this.findEntryPoint(manifest, files);
        } else {
            // Fallback: look for common entry points
            const commonEntryPoints = ['index.html', 'index.htm', 'launch.html', 'start.html'];
            for (const entry of commonEntryPoints) {
                if (files[entry]) {
                    entryPoint = entry;
                    break;
                }
            }
        }

        this.updateProgress(90, 'Finalizing...');

        const courseData = {
            title: manifest?.title || file.name.replace('.zip', ''),
            description: manifest?.description || '',
            files,
            manifest,
            entryPoint
        };

        this.updateProgress(100, 'Complete!');
        
        return courseData;
    }

    parseManifest(xmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Extract basic metadata
            const titleElement = doc.querySelector('title');
            const title = titleElement ? titleElement.textContent : null;
            
            // Find the launch URL
            const resourceElements = doc.querySelectorAll('resource');
            let launchUrl = null;
            
            for (const resource of resourceElements) {
                const type = resource.getAttribute('type');
                if (type && type.includes('webcontent')) {
                    launchUrl = resource.getAttribute('href');
                    break;
                }
            }

            return {
                title,
                launchUrl,
                description: '',
                version: doc.querySelector('manifest')?.getAttribute('version') || '1.2'
            };
        } catch (error) {
            console.warn('Error parsing manifest:', error);
            return null;
        }
    }

    findEntryPoint(manifest, files) {
        if (manifest?.launchUrl && files[manifest.launchUrl]) {
            return manifest.launchUrl;
        }

        // Common fallbacks
        const fallbacks = ['index.html', 'index.htm', 'launch.html', 'start.html'];
        for (const fallback of fallbacks) {
            if (files[fallback]) {
                return fallback;
            }
        }

        // Find any HTML file
        for (const path of Object.keys(files)) {
            if (path.toLowerCase().endsWith('.html') || path.toLowerCase().endsWith('.htm')) {
                return path;
            }
        }

        return null;
    }

    processHtmlContent(htmlContent, files) {
        // Replace relative file references with blob URLs
        let processed = htmlContent;

        // Inject SCORM API finder script at the beginning of the HTML
        const apiFinderScript = `
<script>
// SCORM API Finder - helps courses locate the API
(function() {
    function findAPI(win) {
        var attempts = 0;
        while ((win.API == null || win.API_1484_11 == null) && (win.parent != null) && (win.parent != win)) {
            attempts++;
            if (attempts > 7) {
                return null;
            }
            win = win.parent;
        }
        return win.API || win.API_1484_11;
    }
    
    // Make API available globally for courses that expect it
    if (!window.API && !window.API_1484_11) {
        var api = findAPI(window);
        if (api) {
            window.API = api;
            window.API_1484_11 = api;
            console.log('SCORM API found and attached to course window');
        } else {
            console.warn('SCORM API not found');
        }
    }
})();
</script>
        `;

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

        // Inject the API finder script after the <head> tag or at the beginning if no head tag
        if (processed.includes('<head>')) {
            processed = processed.replace('<head>', '<head>' + apiFinderScript);
        } else if (processed.includes('<html>')) {
            processed = processed.replace('<html>', '<html>' + apiFinderScript);
        } else {
            processed = apiFinderScript + processed;
        }

        return processed;
    }

    isBinaryFile(path) {
        const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', 
                                 '.mp3', '.mp4', '.wav', '.avi', '.mov', '.pdf', '.swf',
                                 '.woff', '.woff2', '.ttf', '.eot', '.zip', '.exe'];
        
        const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
        return binaryExtensions.includes(ext);
    }

    showProgress() {
        document.querySelector('.upload-content').style.display = 'none';
        document.getElementById('upload-progress').style.display = 'block';
    }

    hideProgress() {
        document.querySelector('.upload-content').style.display = 'block';
        document.getElementById('upload-progress').style.display = 'none';
        this.updateProgress(0, '');
    }

    updateProgress(percent, text) {
        document.getElementById('progress-fill').style.width = `${percent}%`;
        document.getElementById('progress-text').textContent = text;
    }
}
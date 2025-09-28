// Enhanced PDF Reader with Download Prevention
class SecurePDFReader {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentPage = 1;
        this.totalPages = 0;
        this.pdfDoc = null;
    }

    async loadPDF(url, bookTitle) {
        try {
            // Load PDF.js library if not already loaded
            if (!window.pdfjsLib) {
                await this.loadPDFJS();
            }

            // Set worker path
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            // Load PDF document
            const loadingTask = pdfjsLib.getDocument(url);
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;

            // Create reader interface
            this.createReaderInterface(bookTitle);

            // Render first page
            await this.renderPage(1);

            // Add protection measures
            this.addProtectionMeasures();

        } catch (error) {
            console.error('Error loading PDF:', error);
            this.container.innerHTML = '<p class="error">Failed to load book content.</p>';
        }
    }

    async loadPDFJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    createReaderInterface(bookTitle) {
        this.container.innerHTML = `
            <div class="pdf-reader-container">
                <div class="reader-header">
                    <h3>${bookTitle}</h3>
                    <div class="reader-controls">
                        <button id="prevPage" disabled>← Previous</button>
                        <span id="pageInfo">Page 1 of ${this.totalPages}</span>
                        <button id="nextPage" ${this.totalPages <= 1 ? 'disabled' : ''}>Next →</button>
                    </div>
                </div>
                <div class="pdf-canvas-container">
                    <canvas id="pdfCanvas"></canvas>
                    <div class="reading-overlay">
                        <div class="watermark">BookNook - Licensed Copy</div>
                    </div>
                </div>
                <div class="reader-footer">
                    <p class="small muted">🔒 Protected content - Reading only</p>
                </div>
            </div>
        `;

        // Add event listeners
        document.getElementById('prevPage').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());
    }

    async renderPage(pageNum) {
        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const canvas = document.getElementById('pdfCanvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render page
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Update UI
            document.getElementById('pageInfo').textContent = `Page ${pageNum} of ${this.totalPages}`;
            document.getElementById('prevPage').disabled = pageNum <= 1;
            document.getElementById('nextPage').disabled = pageNum >= this.totalPages;

        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    async previousPage() {
        if (this.currentPage <= 1) return;
        this.currentPage--;
        await this.renderPage(this.currentPage);
    }

    async nextPage() {
        if (this.currentPage >= this.totalPages) return;
        this.currentPage++;
        await this.renderPage(this.currentPage);
    }

    addProtectionMeasures() {
        const canvas = document.getElementById('pdfCanvas');
        const container = this.container;

        // Disable right-click context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showWarning('Right-click is disabled for content protection');
        });

        // Disable drag and drop
        canvas.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        // Disable text selection
        container.style.userSelect = 'none';
        container.style.webkitUserSelect = 'none';
        container.style.mozUserSelect = 'none';

        // Detect developer tools (basic)
        this.detectDevTools();

        // Disable common keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+S (Save), Ctrl+A (Select All), Ctrl+C (Copy), F12 (DevTools)
            if ((e.ctrlKey && (e.key === 's' || e.key === 'a' || e.key === 'c')) || e.key === 'F12') {
                e.preventDefault();
                this.showWarning('This action is not allowed for content protection');
            }
        });
    }

    detectDevTools() {
        // Basic dev tools detection
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
                document.getElementById('pdfCanvas').style.filter = 'blur(10px)';
                this.showWarning('Please close developer tools to continue reading');
            } else {
                document.getElementById('pdfCanvas').style.filter = 'none';
            }
        }, 1000);
    }

    showWarning(message) {
        // Create temporary warning toast
        const warning = document.createElement('div');
        warning.className = 'protection-warning';
        warning.textContent = message;
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
        `;

        document.body.appendChild(warning);

        setTimeout(() => {
            warning.remove();
        }, 3000);
    }
}

// CSS for the reader
const readerCSS = `
    .pdf-reader-container {
        max-width: 100%;
        margin: 0 auto;
        background: white;
        border-radius: 8px;
        overflow: hidden;
    }

    .reader-header {
        background: #f8f9fa;
        padding: 15px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
    }

    .reader-header h3 {
        margin: 0;
        color: #333;
    }

    .reader-controls {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .reader-controls button {
        padding: 8px 16px;
        border: 1px solid #007bff;
        background: #007bff;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }

    .reader-controls button:disabled {
        background: #6c757d;
        border-color: #6c757d;
        cursor: not-allowed;
    }

    .reader-controls button:hover:not(:disabled) {
        background: #0056b3;
        border-color: #0056b3;
    }

    .pdf-canvas-container {
        position: relative;
        text-align: center;
        background: #f8f9fa;
        padding: 20px;
        min-height: 500px;
    }

    #pdfCanvas {
        max-width: 100%;
        height: auto;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        border-radius: 4px;
    }

    .reading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
    }

    .watermark {
        position: absolute;
        top: 10px;
        right: 10px;
        color: rgba(0,0,0,0.1);
        font-size: 12px;
        font-weight: bold;
        transform: rotate(-15deg);
        pointer-events: none;
    }

    .reader-footer {
        padding: 10px 15px;
        background: #f8f9fa;
        border-top: 1px solid #dee2e6;
        text-align: center;
    }

    .protection-warning {
        animation: fadeInOut 3s ease-in-out;
    }

    @keyframes fadeInOut {
        0%, 100% { opacity: 0; }
        10%, 90% { opacity: 1; }
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .reader-header {
            flex-direction: column;
            gap: 10px;
        }
        
        .reader-controls {
            flex-wrap: wrap;
            justify-content: center;
        }
    }
`;

// Add CSS to document
if (!document.getElementById('pdf-reader-styles')) {
    const style = document.createElement('style');
    style.id = 'pdf-reader-styles';
    style.textContent = readerCSS;
    document.head.appendChild(style);
}

// Export for use
window.SecurePDFReader = SecurePDFReader;
// FormatFlip - Main Application Logic

class FormatFlip {
    constructor() {
        this.files = [];
        this.currentFileIndex = 0;
        this.currentStep = 1;
        this.canvas = null;
        this.ctx = null;
        this.originalImageData = null;
        this.currentImageData = null;
        this.history = [];
        this.historyIndex = -1;
        this.selectedFormat = 'png';
        this.quality = 0.92;
        this.cropRect = null;
        this.isCropping = false;
        this.bgTolerance = 30;

        this.init();
    }

    init() {
        this.canvas = document.getElementById('editCanvas');
        this.ctx = this.canvas?.getContext('2d', { willReadFrequently: true });
        this.setupEventListeners();
        this.updateStepIndicator();
    }

    setupEventListeners() {
        // Drop zone
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                this.handleFiles(e.dataTransfer.files);
            });

            dropZone.addEventListener('click', () => {
                document.getElementById('fileInput')?.click();
            });
        }

        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }

        // Navigation buttons
        document.getElementById('prevStepBtn')?.addEventListener('click', () => this.prevStep());
        document.getElementById('nextStepBtn')?.addEventListener('click', () => this.nextStep());
        document.getElementById('skipEditBtn')?.addEventListener('click', () => this.goToStep(3));
        document.getElementById('startOverBtn')?.addEventListener('click', () => this.startOver());

        // Edit tools
        document.querySelector('[data-tool="background"]')?.addEventListener('click', () => this.showRemoveBgPanel());
        document.querySelector('[data-tool="crop"]')?.addEventListener('click', () => this.showCropPanel());
        document.querySelector('[data-tool="rotate"]')?.addEventListener('click', () => this.showRotatePanel());
        document.querySelector('[data-tool="resize"]')?.addEventListener('click', () => this.showResizePanel());

        // Undo/Redo
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('redoBtn')?.addEventListener('click', () => this.redo());

        // Format options
        document.querySelectorAll('.format-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.format-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedFormat = option.dataset.format;
                this.updateQualitySlider();
            });
        });

        // Format tabs
        document.querySelectorAll('.format-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const category = tab.dataset.category;
                // Hide all format option panels
                document.getElementById('commonFormats')?.classList.add('hidden');
                document.getElementById('webFormats')?.classList.add('hidden');
                document.getElementById('specialFormats')?.classList.add('hidden');
                // Show selected panel
                if (category === 'common') document.getElementById('commonFormats')?.classList.remove('hidden');
                else if (category === 'web') document.getElementById('webFormats')?.classList.remove('hidden');
                else if (category === 'special') document.getElementById('specialFormats')?.classList.remove('hidden');
            });
        });

        // Quality slider
        const qualitySlider = document.getElementById('qualitySlider');
        if (qualitySlider) {
            qualitySlider.addEventListener('input', (e) => {
                this.quality = e.target.value / 100;
                document.getElementById('qualityValue').textContent = e.target.value + '%';
            });
        }

        // Download buttons
        document.getElementById('downloadAllBtn')?.addEventListener('click', () => this.downloadAll());
        document.getElementById('downloadZipBtn')?.addEventListener('click', () => this.downloadAsZip());

        // Help modal
        document.getElementById('helpBtn')?.addEventListener('click', () => this.showHelpModal());
        document.getElementById('closeHelpBtn')?.addEventListener('click', () => this.closeHelpModal());

        // Close help modal on background click
        document.getElementById('helpModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') this.closeHelpModal();
        });

        // Help tabs
        document.querySelectorAll('.help-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.help-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Hide all panels
                document.querySelectorAll('.help-panel').forEach(panel => {
                    panel.classList.add('hidden');
                });
                // Show selected panel
                const panelId = tab.dataset.tab + 'Panel';
                document.getElementById(panelId)?.classList.remove('hidden');
            });
        });

        // Canvas mouse events for crop
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.onCanvasMouseUp(e));
            this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        }

        // Image navigation
        document.getElementById('prevImageBtn')?.addEventListener('click', () => this.prevImage());
        document.getElementById('nextImageBtn')?.addEventListener('click', () => this.nextImage());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                }
            }
        });
    }

    // File Handling
    async handleFiles(fileList) {
        const files = Array.from(fileList);
        const imageFiles = files.filter(f =>
            f.type.startsWith('image/') ||
            f.name.toLowerCase().endsWith('.heic') ||
            f.name.toLowerCase().endsWith('.heif')
        );

        if (imageFiles.length === 0) {
            this.showToast('Please select image files', 'error');
            return;
        }

        this.showLoading('Processing files...');

        for (const file of imageFiles) {
            try {
                let processedFile = file;

                // Convert HEIC/HEIF to JPEG
                if (file.name.toLowerCase().endsWith('.heic') ||
                    file.name.toLowerCase().endsWith('.heif')) {
                    processedFile = await this.convertHeic(file);
                }

                const imageData = await this.loadImage(processedFile);
                this.files.push({
                    original: processedFile,
                    name: file.name.replace(/\.[^.]+$/, ''),
                    imageData: imageData,
                    edited: false
                });
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                this.showToast(`Error processing ${file.name}`, 'error');
            }
        }

        this.hideLoading();

        if (this.files.length > 0) {
            this.currentFileIndex = 0;
            this.loadCurrentFile();
            this.updateFileList();
            this.goToStep(2);
        }
    }

    async convertHeic(file) {
        // Check if heic2any is available
        if (typeof heic2any === 'undefined') {
            // Load heic2any dynamically
            await this.loadScript('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
        }

        const blob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.95
        });

        return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
            type: 'image/jpeg'
        });
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        width: img.width,
                        height: img.height,
                        element: img
                    });
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    loadCurrentFile() {
        if (this.files.length === 0) return;

        const file = this.files[this.currentFileIndex];
        const img = file.imageData.element;

        // Set canvas size
        this.canvas.width = img.width;
        this.canvas.height = img.height;

        // Draw image
        this.ctx.drawImage(img, 0, 0);

        // Store original
        this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Reset history
        this.history = [this.cloneImageData(this.originalImageData)];
        this.historyIndex = 0;

        // Update file counter
        const counter = document.getElementById('imageCounter');
        if (counter) {
            counter.textContent = `Image ${this.currentFileIndex + 1} of ${this.files.length}`;
        }

        // Update navigation buttons
        const prevBtn = document.getElementById('prevImageBtn');
        const nextBtn = document.getElementById('nextImageBtn');
        if (prevBtn) prevBtn.disabled = this.currentFileIndex === 0;
        if (nextBtn) nextBtn.disabled = this.currentFileIndex >= this.files.length - 1;

        // Show/hide image nav
        const imageNav = document.getElementById('imageNav');
        if (imageNav) {
            imageNav.style.display = this.files.length > 1 ? 'flex' : 'none';
        }

        this.updateUndoRedoButtons();
    }

    prevImage() {
        if (this.currentFileIndex > 0) {
            this.currentFileIndex--;
            this.loadCurrentFile();
            this.updateFileList();
        }
    }

    nextImage() {
        if (this.currentFileIndex < this.files.length - 1) {
            this.currentFileIndex++;
            this.loadCurrentFile();
            this.updateFileList();
        }
    }

    // Step Navigation
    goToStep(step) {
        this.currentStep = step;
        this.updateStepIndicator();
        this.updateStepContent();

        // Update preview when going to Step 3
        if (step === 3) {
            this.updatePreview();
        }
    }

    updatePreview() {
        const previewCanvas = document.getElementById('previewCanvas');
        const previewInfo = document.getElementById('previewInfo');

        if (previewCanvas && this.canvas) {
            const ctx = previewCanvas.getContext('2d');

            // Calculate thumbnail size (max 200x150)
            const maxW = 200, maxH = 150;
            const ratio = Math.min(maxW / this.canvas.width, maxH / this.canvas.height);
            const w = Math.round(this.canvas.width * ratio);
            const h = Math.round(this.canvas.height * ratio);

            previewCanvas.width = w;
            previewCanvas.height = h;
            ctx.drawImage(this.canvas, 0, 0, w, h);

            // Update info text
            if (previewInfo) {
                const file = this.files[this.currentFileIndex];
                previewInfo.textContent = `${file?.name || 'Image'} • ${this.canvas.width}×${this.canvas.height}px`;
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    }

    nextStep() {
        if (this.currentStep < 4) {
            if (this.currentStep === 1 && this.files.length === 0) {
                this.showToast('Please upload at least one image', 'error');
                return;
            }
            if (this.currentStep === 3) {
                this.prepareDownloads();
            }
            this.goToStep(this.currentStep + 1);
        }
    }

    updateStepIndicator() {
        document.querySelectorAll('.step').forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');
            if (stepNum === this.currentStep) {
                step.classList.add('active');
            } else if (stepNum < this.currentStep) {
                step.classList.add('completed');
            }
        });

        // Update navigation buttons
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        const skipBtn = document.getElementById('skipEditBtn');

        if (prevBtn) prevBtn.disabled = this.currentStep === 1;
        if (nextBtn) {
            nextBtn.disabled = (this.currentStep === 1 && this.files.length === 0) || this.currentStep === 4;
            // Update button text
            const svgHtml = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            if (this.currentStep === 3) {
                nextBtn.innerHTML = `Convert ${svgHtml}`;
            } else {
                nextBtn.innerHTML = `Next ${svgHtml}`;
            }
        }
        // Show skip button only on edit step
        if (skipBtn) {
            skipBtn.classList.toggle('hidden', this.currentStep !== 2);
        }
    }

    updateStepContent() {
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`step${this.currentStep}`)?.classList.add('active');
    }

    // Edit Tools
    showRemoveBgPanel() {
        this.hideAllPanels();
        document.getElementById('bgToolPanel')?.classList.remove('hidden');
        document.getElementById('bgToolPanel')?.classList.add('active');
        this.setupRemoveBgControls();

        // Immediately enable click mode
        this.showToast('Click on the background color to remove', 'info');
        this.canvas.style.cursor = 'crosshair';
        this.canvas.dataset.mode = 'removeBg';
    }

    setupRemoveBgControls() {
        const toleranceSlider = document.getElementById('toleranceSlider');
        const toleranceValue = document.getElementById('toleranceValue');
        const applyBtn = document.getElementById('applyBgBtn');
        const cancelBtn = document.getElementById('resetBgBtn');

        if (toleranceSlider) {
            // Default to higher tolerance for white backgrounds
            this.bgTolerance = 50;
            toleranceSlider.value = this.bgTolerance;
            toleranceValue.textContent = this.bgTolerance;

            toleranceSlider.oninput = (e) => {
                this.bgTolerance = parseInt(e.target.value);
                toleranceValue.textContent = this.bgTolerance;
            };
        }

        if (applyBtn) {
            applyBtn.onclick = () => {
                this.showToast('Click on the background color to remove', 'info');
                this.canvas.style.cursor = 'crosshair';
                this.canvas.dataset.mode = 'removeBg';
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => this.hideAllPanels();
        }
    }

    removeBackground(x, y) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Get target color at click position
        const pixelIndex = (y * this.canvas.width + x) * 4;
        const targetR = data[pixelIndex];
        const targetG = data[pixelIndex + 1];
        const targetB = data[pixelIndex + 2];

        // Flood fill algorithm with tolerance
        const tolerance = this.bgTolerance;
        const visited = new Set();
        const stack = [[x, y]];

        while (stack.length > 0) {
            const [px, py] = stack.pop();
            const key = `${px},${py}`;

            if (visited.has(key)) continue;
            if (px < 0 || px >= this.canvas.width || py < 0 || py >= this.canvas.height) continue;

            const i = (py * this.canvas.width + px) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Check if color is within tolerance
            const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
            if (diff > tolerance * 3) continue;

            visited.add(key);
            data[i + 3] = 0; // Set alpha to 0 (transparent)

            // Add neighbors
            stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.saveToHistory();
        this.canvas.style.cursor = 'default';
        this.canvas.dataset.mode = '';
        this.hideAllPanels();
        this.showToast('Background removed', 'success');
    }

    showCropPanel() {
        this.hideAllPanels();
        document.getElementById('cropToolPanel')?.classList.remove('hidden');
        document.getElementById('cropToolPanel')?.classList.add('active');
        this.setupCropControls();
    }

    setupCropControls() {
        const ratioBtns = document.querySelectorAll('#cropToolPanel .preset-btn');
        const applyBtn = document.getElementById('applyCropBtn');
        const cancelBtn = document.getElementById('resetCropBtn');

        ratioBtns.forEach(btn => {
            btn.onclick = () => {
                ratioBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.startCrop(btn.dataset.ratio);
            };
        });

        if (applyBtn) {
            applyBtn.onclick = () => this.applyCrop();
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                this.cropRect = null;
                this.redrawCanvas();
                this.hideAllPanels();
            };
        }
    }

    startCrop(ratio) {
        this.isCropping = true;
        this.cropAspect = ratio;
        this.canvas.style.cursor = 'crosshair';

        // Calculate default crop area based on aspect ratio
        const canvasAspect = this.canvas.width / this.canvas.height;
        let cropW, cropH;

        if (ratio === 'free' || ratio === 'a4') {
            cropW = this.canvas.width * 0.8;
            cropH = this.canvas.height * 0.8;
        } else {
            const [w, h] = aspect.split(':').map(Number);
            const targetAspect = w / h;

            if (targetAspect > canvasAspect) {
                cropW = this.canvas.width * 0.8;
                cropH = cropW / targetAspect;
            } else {
                cropH = this.canvas.height * 0.8;
                cropW = cropH * targetAspect;
            }
        }

        this.cropRect = {
            x: (this.canvas.width - cropW) / 2,
            y: (this.canvas.height - cropH) / 2,
            width: cropW,
            height: cropH
        };

        this.drawCropOverlay();
    }

    drawCropOverlay() {
        if (!this.cropRect) return;

        // Redraw image
        this.ctx.putImageData(this.currentImageData, 0, 0);

        // Draw dark overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Clear crop area
        this.ctx.clearRect(this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height);
        this.ctx.putImageData(
            this.currentImageData,
            0, 0,
            this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height
        );

        // Draw crop border
        this.ctx.strokeStyle = '#40916C';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.cropRect.x, this.cropRect.y, this.cropRect.width, this.cropRect.height);

        // Draw grid lines (rule of thirds)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        const thirdW = this.cropRect.width / 3;
        const thirdH = this.cropRect.height / 3;

        for (let i = 1; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.cropRect.x + thirdW * i, this.cropRect.y);
            this.ctx.lineTo(this.cropRect.x + thirdW * i, this.cropRect.y + this.cropRect.height);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(this.cropRect.x, this.cropRect.y + thirdH * i);
            this.ctx.lineTo(this.cropRect.x + this.cropRect.width, this.cropRect.y + thirdH * i);
            this.ctx.stroke();
        }
    }

    applyCrop() {
        if (!this.cropRect) return;

        // Get cropped image data
        const croppedData = this.ctx.getImageData(
            this.cropRect.x, this.cropRect.y,
            this.cropRect.width, this.cropRect.height
        );

        // Resize canvas
        this.canvas.width = this.cropRect.width;
        this.canvas.height = this.cropRect.height;

        // Put cropped image
        this.ctx.putImageData(croppedData, 0, 0);

        this.currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.cropRect = null;
        this.isCropping = false;
        this.saveToHistory();
        this.hideAllPanels();
        this.showToast('Image cropped', 'success');
    }

    showRotatePanel() {
        this.hideAllPanels();
        document.getElementById('rotateToolPanel')?.classList.remove('hidden');
        document.getElementById('rotateToolPanel')?.classList.add('active');
        this.setupRotateControls();
    }

    setupRotateControls() {
        document.querySelectorAll('#rotateToolPanel .rotate-btn').forEach(btn => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                if (action === 'rotate-left') this.rotate(-90);
                else if (action === 'rotate-right') this.rotate(90);
                else if (action === 'rotate-180') this.rotate(180);
                else if (action === 'flip-h') this.flip('horizontal');
                else if (action === 'flip-v') this.flip('vertical');
            };
        });

        const angleSlider = document.getElementById('angleSlider');
        const angleValue = document.getElementById('angleValue');
        if (angleSlider) {
            angleSlider.oninput = (e) => {
                angleValue.textContent = e.target.value;
            };
        }

        document.getElementById('applyRotateBtn')?.addEventListener('click', () => {
            const angle = parseInt(document.getElementById('angleSlider')?.value || 0);
            if (angle !== 0) this.rotate(angle);
            this.hideAllPanels();
        });
        document.getElementById('resetRotateBtn')?.addEventListener('click', () => this.hideAllPanels());
    }

    rotate(degrees) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        if (Math.abs(degrees) === 90) {
            tempCanvas.width = this.canvas.height;
            tempCanvas.height = this.canvas.width;
        } else {
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
        }

        tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        tempCtx.rotate(degrees * Math.PI / 180);
        tempCtx.drawImage(this.canvas, -this.canvas.width / 2, -this.canvas.height / 2);

        this.canvas.width = tempCanvas.width;
        this.canvas.height = tempCanvas.height;
        this.ctx.drawImage(tempCanvas, 0, 0);

        this.currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.saveToHistory();
        this.showToast(`Rotated ${degrees}°`, 'success');
    }

    flip(direction) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        if (direction === 'horizontal') {
            tempCtx.translate(tempCanvas.width, 0);
            tempCtx.scale(-1, 1);
        } else {
            tempCtx.translate(0, tempCanvas.height);
            tempCtx.scale(1, -1);
        }

        tempCtx.drawImage(this.canvas, 0, 0);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempCanvas, 0, 0);

        this.currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.saveToHistory();
        this.showToast(`Flipped ${direction}`, 'success');
    }

    showResizePanel() {
        this.hideAllPanels();
        document.getElementById('resizeToolPanel')?.classList.remove('hidden');
        document.getElementById('resizeToolPanel')?.classList.add('active');
        this.setupResizeControls();
    }

    setupResizeControls() {
        const widthInput = document.getElementById('resizeWidth');
        const heightInput = document.getElementById('resizeHeight');
        const lockAspectBtn = document.getElementById('lockAspectBtn');
        const applyBtn = document.getElementById('applyResizeBtn');
        const cancelBtn = document.getElementById('resetResizeBtn');
        let lockAspect = true;

        if (widthInput && heightInput) {
            widthInput.value = this.canvas.width;
            heightInput.value = this.canvas.height;
            const aspectRatio = this.canvas.width / this.canvas.height;

            if (lockAspectBtn) {
                lockAspectBtn.onclick = () => {
                    lockAspect = !lockAspect;
                    lockAspectBtn.classList.toggle('active', lockAspect);
                };
            }

            widthInput.oninput = () => {
                if (lockAspect) {
                    heightInput.value = Math.round(widthInput.value / aspectRatio);
                }
            };

            heightInput.oninput = () => {
                if (lockAspect) {
                    widthInput.value = Math.round(heightInput.value * aspectRatio);
                }
            };
        }

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.onclick = () => {
                const [w, h] = btn.dataset.size.split('x').map(Number);
                widthInput.value = w;
                heightInput.value = h;
            };
        });

        if (applyBtn) {
            applyBtn.onclick = () => {
                const newWidth = parseInt(widthInput.value);
                const newHeight = parseInt(heightInput.value);
                this.resize(newWidth, newHeight);
                this.hideAllPanels();
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => this.hideAllPanels();
        }
    }

    resize(newWidth, newHeight) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;

        // Use high quality scaling
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(this.canvas, 0, 0, newWidth, newHeight);

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.ctx.drawImage(tempCanvas, 0, 0);

        this.currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.saveToHistory();
        this.showToast(`Resized to ${newWidth}x${newHeight}`, 'success');
    }

    hideAllPanels() {
        document.querySelectorAll('.tool-panel').forEach(panel => {
            panel.classList.remove('active');
            panel.classList.add('hidden');
        });
        this.canvas.style.cursor = 'default';
        this.canvas.dataset.mode = '';
    }

    startOver() {
        this.files = [];
        this.currentFileIndex = 0;
        this.history = [];
        this.historyIndex = -1;
        this.cropRect = null;

        // Clear canvas
        if (this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Clear file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = '';

        // Clear download list
        const downloadList = document.getElementById('downloadList');
        if (downloadList) downloadList.innerHTML = '';

        // Go back to step 1
        this.goToStep(1);
        this.showToast('Ready for new files', 'info');
    }

    // Canvas Events
    onCanvasClick(e) {
        if (this.canvas.dataset.mode === 'removeBg') {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);
            this.removeBackground(x, y);
        }
    }

    onCanvasMouseDown(e) {
        if (this.isCropping && this.cropRect) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.cropStartX = (e.clientX - rect.left) * scaleX;
            this.cropStartY = (e.clientY - rect.top) * scaleY;
            this.isDraggingCrop = true;
        }
    }

    onCanvasMouseMove(e) {
        if (this.isDraggingCrop && this.cropRect) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            const dx = x - this.cropStartX;
            const dy = y - this.cropStartY;

            this.cropRect.x = Math.max(0, Math.min(this.canvas.width - this.cropRect.width, this.cropRect.x + dx));
            this.cropRect.y = Math.max(0, Math.min(this.canvas.height - this.cropRect.height, this.cropRect.y + dy));

            this.cropStartX = x;
            this.cropStartY = y;

            this.drawCropOverlay();
        }
    }

    onCanvasMouseUp() {
        this.isDraggingCrop = false;
    }

    // History (Undo/Redo)
    saveToHistory() {
        // Remove any redo history
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add current state
        this.history.push(this.cloneImageData(this.currentImageData));
        this.historyIndex++;

        // Limit history size
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }

        this.updateUndoRedoButtons();
        this.files[this.currentFileIndex].edited = true;
    }

    cloneImageData(imageData) {
        return new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.canvas.width = state.width;
            this.canvas.height = state.height;
            this.ctx.putImageData(state, 0, 0);
            this.currentImageData = this.cloneImageData(state);
            this.updateUndoRedoButtons();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.canvas.width = state.width;
            this.canvas.height = state.height;
            this.ctx.putImageData(state, 0, 0);
            this.currentImageData = this.cloneImageData(state);
            this.updateUndoRedoButtons();
        }
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    redrawCanvas() {
        this.ctx.putImageData(this.currentImageData, 0, 0);
    }

    // Format Conversion
    updateQualitySlider() {
        const qualityGroup = document.getElementById('qualityGroup');
        const supportsQuality = ['jpg', 'jpeg', 'webp', 'avif'].includes(this.selectedFormat);
        if (qualityGroup) {
            qualityGroup.style.display = supportsQuality ? 'block' : 'none';
        }
    }

    async convertToFormat(format, quality = this.quality) {
        return new Promise((resolve) => {
            const mimeTypes = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'webp': 'image/webp',
                'avif': 'image/avif',
                'gif': 'image/gif',
                'bmp': 'image/bmp'
            };

            const mime = mimeTypes[format] || 'image/png';

            if (format === 'ico') {
                resolve(this.convertToIco());
            } else if (format === 'pdf') {
                resolve(this.convertToPdf());
            } else if (format === 'tiff') {
                resolve(this.convertToTiff());
            } else {
                this.canvas.toBlob((blob) => {
                    resolve(blob);
                }, mime, quality);
            }
        });
    }

    async convertToIco() {
        // Create 16x16, 32x32, and 48x48 versions
        const sizes = [16, 32, 48];
        const images = [];

        for (const size of sizes) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            tempCtx.drawImage(this.canvas, 0, 0, size, size);
            images.push(tempCtx.getImageData(0, 0, size, size));
        }

        // Simple ICO format (just use 32x32 PNG for compatibility)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 32;
        tempCanvas.height = 32;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0, 32, 32);

        return new Promise((resolve) => {
            tempCanvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    async convertToPdf() {
        // Load jsPDF if not available
        if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }

        const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
        const pdf = new jsPDF({
            orientation: this.canvas.width > this.canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [this.canvas.width, this.canvas.height]
        });

        const imgData = this.canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, this.canvas.width, this.canvas.height);

        return pdf.output('blob');
    }

    async convertToTiff() {
        // For TIFF, we'll use PNG as a fallback since browser support is limited
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });
    }

    // Download
    async prepareDownloads() {
        const downloadList = document.getElementById('downloadList');
        if (!downloadList) return;

        downloadList.innerHTML = '';

        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            const item = document.createElement('div');
            item.className = 'download-item';
            item.innerHTML = `
                <div class="download-info">
                    <span class="download-name">${file.name}.${this.selectedFormat}</span>
                    <span class="download-size">Processing...</span>
                </div>
                <button class="download-btn" data-index="${i}">Download</button>
            `;
            downloadList.appendChild(item);
        }

        // Add download button listeners
        downloadList.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.downloadSingle(parseInt(btn.dataset.index));
            });
        });
    }

    async downloadSingle(index) {
        const file = this.files[index];

        // Load file if not current
        if (index !== this.currentFileIndex) {
            this.currentFileIndex = index;
            this.loadCurrentFile();
        }

        const blob = await this.convertToFormat(this.selectedFormat);
        this.triggerDownload(blob, `${file.name}.${this.selectedFormat}`);
    }

    async downloadAll() {
        for (let i = 0; i < this.files.length; i++) {
            await this.downloadSingle(i);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between downloads
        }
    }

    async downloadAsZip() {
        // Load JSZip if not available
        if (typeof JSZip === 'undefined') {
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }

        this.showLoading('Creating ZIP file...');

        const zip = new JSZip();

        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];

            // Load file
            this.currentFileIndex = i;
            this.loadCurrentFile();

            const blob = await this.convertToFormat(this.selectedFormat);
            zip.file(`${file.name}.${this.selectedFormat}`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        this.hideLoading();

        this.triggerDownload(zipBlob, 'FormatFlip-converted.zip');
    }

    triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // File List
    updateFileList() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        fileList.innerHTML = '';

        this.files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = `file-item ${index === this.currentFileIndex ? 'active' : ''}`;
            item.innerHTML = `
                <span class="file-name">${file.name}</span>
                <button class="file-remove" data-index="${index}">&times;</button>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('file-remove')) {
                    this.currentFileIndex = index;
                    this.loadCurrentFile();
                    this.updateFileList();
                }
            });

            fileList.appendChild(item);
        });

        // Add remove listeners
        fileList.querySelectorAll('.file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.files.splice(index, 1);
                if (this.currentFileIndex >= this.files.length) {
                    this.currentFileIndex = Math.max(0, this.files.length - 1);
                }
                if (this.files.length > 0) {
                    this.loadCurrentFile();
                }
                this.updateFileList();
            });
        });
    }

    // Modals
    showHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Utilities
    showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p id="loadingMessage">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            document.getElementById('loadingMessage').textContent = message;
        }
        overlay.classList.add('active');
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.formatFlip = new FormatFlip();
});

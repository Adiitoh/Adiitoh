/**
 * Student Assessment Tracker - Common JavaScript
 * Academic Year 2026/27
 * 
 * This file contains common functionality used across all pages
 */

// Global application object
window.StudentTracker = {
    // Configuration
    config: {
        apiBaseUrl: '/api',
        refreshInterval: 300000, // 5 minutes
        toastDuration: 5000,
        animationDuration: 300
    },
    
    // Utility functions
    utils: {},
    
    // API functions
    api: {},
    
    // UI functions
    ui: {},
    
    // Chart functions
    charts: {},
    
    // Notification functions
    notifications: {}
};

// ===================================
// UTILITY FUNCTIONS
// ===================================

StudentTracker.utils = {
    /**
     * Format date to readable string
     */
    formatDate: function(dateString, options = {}) {
        const date = new Date(dateString);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
    },
    
    /**
     * Format time ago
     */
    timeAgo: function(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, seconds] of Object.entries(intervals)) {
            const interval = Math.floor(diffInSeconds / seconds);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        
        return 'Just now';
    },
    
    /**
     * Debounce function
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function
     */
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Generate random ID
     */
    generateId: function() {
        return Math.random().toString(36).substr(2, 9);
    },
    
    /**
     * Validate email
     */
    validateEmail: function(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    /**
     * Format file size
     */
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    /**
     * Get grade color
     */
    getGradeColor: function(score) {
        if (score >= 90) return 'success';
        if (score >= 80) return 'info';
        if (score >= 70) return 'warning';
        if (score >= 60) return 'secondary';
        return 'danger';
    },
    
    /**
     * Get grade letter
     */
    getGradeLetter: function(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    },
    
    /**
     * Calculate percentage
     */
    calculatePercentage: function(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    },
    
    /**
     * Sanitize HTML
     */
    sanitizeHtml: function(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};

// ===================================
// API FUNCTIONS
// ===================================

StudentTracker.api = {
    /**
     * Make API request
     */
    request: async function(endpoint, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const config = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(`${StudentTracker.config.apiBaseUrl}${endpoint}`, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            StudentTracker.ui.showToast('Network error occurred', 'error');
            throw error;
        }
    },
    
    /**
     * GET request
     */
    get: function(endpoint) {
        return this.request(endpoint);
    },
    
    /**
     * POST request
     */
    post: function(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * PUT request
     */
    put: function(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * DELETE request
     */
    delete: function(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    },
    
    /**
     * Upload file
     */
    uploadFile: function(endpoint, file, onProgress) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error(`Upload failed with status: ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });
            
            xhr.open('POST', `${StudentTracker.config.apiBaseUrl}${endpoint}`);
            xhr.send(formData);
        });
    }
};

// ===================================
// UI FUNCTIONS
// ===================================

StudentTracker.ui = {
    /**
     * Show toast notification
     */
    showToast: function(message, type = 'info', duration = null) {
        const toastId = StudentTracker.utils.generateId();
        const toastDuration = duration || StudentTracker.config.toastDuration;
                const toastHtml = `
            <div id="toast-${toastId}" class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0 position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi bi-${this.getToastIcon(type)} me-2"></i>
                        ${StudentTracker.utils.sanitizeHtml(message)}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', toastHtml);
        
        const toastElement = document.getElementById(`toast-${toastId}`);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: toastDuration
        });
        
        toast.show();
        
        // Remove element after hiding
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
        
        return toastId;
    },
    
    /**
     * Display flash messages from server
     */
    displayFlashMessages: function() {
        const flashMessages = document.getElementById('flash-messages');
        if (flashMessages) {
            const messages = JSON.parse(flashMessages.textContent);
            for (const type in messages) {
                messages[type].forEach(msg => {
                    StudentTracker.ui.showToast(msg, type);
                });
            }
            flashMessages.remove(); // Remove the script tag after displaying messages
        }
    }
};

// Initialize flash message display on document ready
document.addEventListener('DOMContentLoaded', () => {
    StudentTracker.ui.displayFlashMessages();
    
    /**
     * Get toast icon based on type
     */
    getToastIcon:function(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },
    
    /**
     * Show loading overlay
     */
    showLoading: function(message = 'Loading...') {
        const loadingHtml = `
            <div id="loading-overlay" class="loading-overlay">
                <div class="text-center">
                    <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted">${StudentTracker.utils.sanitizeHtml(message)}</p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loadingHtml);
    },
    
    /**
     * Hide loading overlay
     */
    hideLoading: function() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    },
    
    /**
     * Show confirmation dialog
     */
    confirm: function(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            const modalId = StudentTracker.utils.generateId();
            const modalHtml = `
                <div class="modal fade" id="modal-${modalId}" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${StudentTracker.utils.sanitizeHtml(title)}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>${StudentTracker.utils.sanitizeHtml(message)}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary confirm-btn">Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const modalElement = document.getElementById(`modal-${modalId}`);
            const modal = new bootstrap.Modal(modalElement);
            
            modalElement.querySelector('.confirm-btn').addEventListener('click', () => {
                modal.hide();
                resolve(true);
            });
            
            modalElement.addEventListener('hidden.bs.modal', () => {
                modalElement.remove();
                resolve(false);
            });
            
            modal.show();
        });
    },
    
    /**
     * Show alert dialog
     */
    alert: function(message, title = 'Alert', type = 'info') {
        return new Promise((resolve) => {
            const modalId = StudentTracker.utils.generateId();
            const modalHtml = `
                <div class="modal fade" id="modal-${modalId}" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-${type} text-white">
                                <h5 class="modal-title">
                                    <i class="bi bi-${this.getToastIcon(type)} me-2"></i>
                                    ${StudentTracker.utils.sanitizeHtml(title)}
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>${StudentTracker.utils.sanitizeHtml(message)}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const modalElement = document.getElementById(`modal-${modalId}`);
            const modal = new bootstrap.Modal(modalElement);
            
            modalElement.addEventListener('hidden.bs.modal', () => {
                modalElement.remove();
                resolve();
            });
            
            modal.show();
        });
    },
    
    /**
     * Animate element
     */
    animate: function(element, animation, duration = null) {
        return new Promise((resolve) => {
            const animationDuration = duration || StudentTracker.config.animationDuration;
            
            element.style.animationDuration = `${animationDuration}ms`;
            element.classList.add(animation);
            
            setTimeout(() => {
                element.classList.remove(animation);
                resolve();
            }, animationDuration);
        });
    },
    
    /**
     * Update progress bar
     */
    updateProgress: function(element, percentage, animated = true) {
        const progressBar = element.querySelector('.progress-bar');
        if (progressBar) {
            if (animated) {
                progressBar.style.transition = 'width 0.5s ease-in-out';
            }
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage);
        }
    },
    
    /**
     * Create skeleton loader
     */
    createSkeleton: function(container, rows = 3) {
        const skeletonHtml = Array(rows).fill(0).map(() => `
            <div class="loading-skeleton mb-2" style="height: 20px; width: ${Math.random() * 40 + 60}%;"></div>
        `).join('');
        
        container.innerHTML = skeletonHtml;
    },
    
    /**
     * Format number with commas
     */
    formatNumber: function(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
});

// ===================================
// CHART FUNCTIONS
// ===================================

StudentTracker.charts = {
    /**
     * Default chart options
     */
    defaultOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 20
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0,0,0,0.1)'
                }
            },
            x: {
                grid: {
                    color: 'rgba(0,0,0,0.1)'
                }
            }
        }
    },
    
    /**
     * Create line chart
     */
    createLineChart: function(ctx, data, options = {}) {
        const config = {
            type: 'line',
            data: data,
            options: { ...this.defaultOptions, ...options }
        };
        
        return new Chart(ctx, config);
    },
    
    /**
     * Create bar chart
     */
    createBarChart: function(ctx, data, options = {}) {
        const config = {
            type: 'bar',
            data: data,
            options: { ...this.defaultOptions, ...options }
        };
        
        return new Chart(ctx, config);
    },
    
    /**
     * Create pie chart
     */
    createPieChart: function(ctx, data, options = {}) {
        const pieOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            }
        };
        
        const config = {
            type: 'pie',
            data: data,
            options: { ...pieOptions, ...options }
        };
        
        return new Chart(ctx, config);
    },
    
    /**
     * Create doughnut chart
     */
    createDoughnutChart: function(ctx, data, options = {}) {
        const doughnutOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            }
        };
        
        const config = {
            type: 'doughnut',
            data: data,
            options: { ...doughnutOptions, ...options }
        };
        
        return new Chart(ctx, config);
    },
    
    /**
     * Update chart data
     */
    updateChart: function(chart, newData) {
        chart.data = newData;
        chart.update();
    },
    
    /**
     * Destroy chart
     */
    destroyChart: function(chart) {
        if (chart) {
            chart.destroy();
        }
    }
};

// ===================================
// NOTIFICATION FUNCTIONS
// ===================================

StudentTracker.notifications = {
    /**
     * Load notifications
     */
    load: async function() {
        try {
            const response = await StudentTracker.api.get('/notifications');
            if (response.success) {
                this.update(response.notifications);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    },
    
    /**
     * Update notification UI
     */
    update: function(notifications) {
        const badge = document.querySelector('.notification-badge');
        const list = document.querySelector('.notification-list');
        
        if (!badge || !list) return;
        
        if (notifications.length > 0) {
            badge.textContent = notifications.length;
            badge.classList.remove('d-none');
            
            list.innerHTML = notifications.map(notification => `
                <li>
                    <a class="dropdown-item py-2" href="${notification.link || '#'}">
                        <div class="d-flex align-items-start">
                            <i class="bi bi-${this.getIcon(notification.type)} me-2 mt-1 text-${this.getColor(notification.type)}"></i>
                            <div class="flex-grow-1">
                                <div class="fw-semibold small">${StudentTracker.utils.sanitizeHtml(notification.title)}</div>
                                <div class="text-muted small">${StudentTracker.utils.sanitizeHtml(notification.message)}</div>
                                <div class="text-muted small">${StudentTracker.utils.timeAgo(notification.created_at)}</div>
                            </div>
                            ${notification.count ? `<span class="badge bg-${this.getColor(notification.type)} rounded-pill">${notification.count}</span>` : ''}
                        </div>
                    </a>
                </li>
            `).join('');
        } else {
            badge.classList.add('d-none');
            list.innerHTML = `
                <li>
                    <div class="text-center p-3 text-muted">
                        <i class="bi bi-bell-slash"></i>
                        <p class="mb-0 small">No new notifications</p>
                    </div>
                </li>
            `;
        }
    },
    
    /**
     * Get notification icon
     */
    getIcon: function(type) {
        const icons = {
            success: 'check-circle',
            warning: 'exclamation-triangle',
            error: 'x-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },
    
    /**
     * Get notification color
     */
    getColor: function(type) {
        const colors = {
            success: 'success',
            warning: 'warning',
            error: 'danger',
            info: 'info'
        };
        return colors[type] || 'info';
    },
    
    /**
     * Mark notification as read
     */
    markAsRead: async function(notificationId) {
        try {
            await StudentTracker.api.post(`/notifications/${notificationId}/read`);
            this.load(); // Reload notifications
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    },
    
    /**
     * Clear all notifications
     */
    clearAll: async function() {
        try {
            await StudentTracker.api.post('/notifications/clear');
            this.load(); // Reload notifications
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    }
};

// ===================================
// FORM HANDLING
// ===================================

StudentTracker.forms = {
    /**
     * Serialize form data
     */
    serialize: function(form) {
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        return data;
    },
    
    /**
     * Validate form
     */
    validate: function(form) {
        const inputs = form.querySelectorAll('input, select, textarea');
        let isValid = true;
        
        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                this.showFieldError(input, 'This field is required');
                isValid = false;
            } else if (input.type === 'email' && input.value && !StudentTracker.utils.validateEmail(input.value)) {
                this.showFieldError(input, 'Please enter a valid email address');
                isValid = false;
            } else {
                this.clearFieldError(input);
            }
        });
        
        return isValid;
    },
    
    /**
     * Show field error
     */
    showFieldError: function(field, message) {
        field.classList.add('is-invalid');
        
        let feedback = field.parentNode.querySelector('.invalid-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            field.parentNode.appendChild(feedback);
        }
        
        feedback.textContent = message;
    },
    
    /**
     * Clear field error
     */
    clearFieldError: function(field) {
        field.classList.remove('is-invalid');
        const feedback = field.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.remove();
        }
    },
    
    /**
     * Set loading state
     */
    setLoading: function(button, loading = true) {
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            const text = button.querySelector('.btn-text');
            const loadingSpan = button.querySelector('.btn-loading');
            if (text) text.classList.add('d-none');
            if (loadingSpan) loadingSpan.classList.remove('d-none');
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            const text = button.querySelector('.btn-text');
            const loadingSpan = button.querySelector('.btn-loading');
            if (text) text.classList.remove('d-none');
            if (loadingSpan) loadingSpan.classList.add('d-none');
        }
    }
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
    
    // Load notifications for authenticated users
    if (document.querySelector('.notification-badge')) {
        StudentTracker.notifications.load();
        
        // Refresh notifications every 5 minutes
        setInterval(() => {
            StudentTracker.notifications.load();
        }, StudentTracker.config.refreshInterval);
    }
    
    // Auto-hide alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(function(alert) {
        setTimeout(function() {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, StudentTracker.config.toastDuration);
    });
    
    // Form validation
    const forms = document.querySelectorAll('form[data-validate]');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!StudentTracker.forms.validate(form)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Back to top button
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    backToTopBtn.className = 'btn btn-primary position-fixed d-none';
    backToTopBtn.style.cssText = 'bottom: 20px; right: 20px; z-index: 1000; border-radius: 50%; width: 50px; height: 50px;';
    backToTopBtn.setAttribute('title', 'Back to top');
    document.body.appendChild(backToTopBtn);
    
    // Show/hide back to top button
    window.addEventListener('scroll', StudentTracker.utils.throttle(() => {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.remove('d-none');
        } else {
            backToTopBtn.classList.add('d-none');
        }
    }, 100));
    
    // Back to top functionality
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Initialize file upload areas
    const fileUploadAreas = document.querySelectorAll('.file-upload-area');
    fileUploadAreas.forEach(area => {
        const input = area.querySelector('input[type="file"]');
        if (input) {
            area.addEventListener('click', () => input.click());
            
            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.classList.add('dragover');
            });
            
            area.addEventListener('dragleave', () => {
                area.classList.remove('dragover');
            });
            
            area.addEventListener('drop', (e) => {
                e.preventDefault();
                area.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    input.files = files;
                    input.dispatchEvent(new Event('change'));
                }
            });
        }
    });
    
    console.log('Student Assessment Tracker initialized successfully');
});

// ===================================
// GLOBAL ERROR HANDLING
// ===================================

window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    StudentTracker.ui.showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    StudentTracker.ui.showToast('An unexpected error occurred', 'error');
});

// Export for use in other scripts
window.ST = StudentTracker;


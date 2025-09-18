/**
 * Student Assessment Tracker - Student JavaScript
 * Academic Year 2026/27
 * 
 * This file contains student-specific functionality
 */

// Student module
window.StudentModule = {
    // Configuration
    config: {
        refreshInterval: 60000, // 1 minute for student data
        chartColors: [
            '#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0',
            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'
        ]
    },
    
    // Dashboard functions
    dashboard: {},
    
    // Results and analytics
    results: {},
    
    // Performance tracking
    performance: {},
    
    // Course management
    courses: {}
};

// ===================================
// DASHBOARD FUNCTIONS
// ===================================

StudentModule.dashboard = {
    /**
     * Initialize student dashboard
     */
    init: function() {
        this.loadOverview();
        this.loadRecentResults();
        this.loadUpcomingAssessments();
        this.loadPerformanceChart();
        this.setupAutoRefresh();
    },
    
    /**
     * Load dashboard overview
     */
    loadOverview: async function() {
        try {
            const response = await ST.api.get('/student/dashboard/overview');
            if (response.success) {
                this.updateOverview(response.overview);
            }
        } catch (error) {
            console.error('Failed to load overview:', error);
        }
    },
    
    /**
     * Update overview display
     */
    updateOverview: function(overview) {
        const elements = {
            totalCourses: document.getElementById('totalCourses'),
            completedAssessments: document.getElementById('completedAssessments'),
            averageGrade: document.getElementById('averageGrade'),
            currentRank: document.getElementById('currentRank'),
            improvementRate: document.getElementById('improvementRate'),
            attendanceRate: document.getElementById('attendanceRate')
        };
        
        Object.keys(elements).forEach(key => {
            if (elements[key] && overview[key] !== undefined) {
                if (key === 'averageGrade') {
                    elements[key].textContent = overview[key].toFixed(1) + '%';
                    elements[key].className = `fw-bold text-${ST.utils.getGradeColor(overview[key])}`;
                } else if (key.includes('Rate')) {
                    elements[key].textContent = overview[key] + '%';
                } else {
                    elements[key].textContent = ST.ui.formatNumber(overview[key]);
                }
                
                // Add animation
                ST.ui.animate(elements[key], 'bounce-in');
            }
        });
        
        // Update grade display
        const gradeDisplay = document.getElementById('gradeDisplay');
        if (gradeDisplay && overview.averageGrade !== undefined) {
            const gradeLetter = ST.utils.getGradeLetter(overview.averageGrade);
            gradeDisplay.textContent = gradeLetter;
            gradeDisplay.className = `grade-display grade-${gradeLetter.toLowerCase()}`;
        }
    },
    
    /**
     * Load recent results
     */
    loadRecentResults: async function() {
        try {
            const response = await ST.api.get('/student/dashboard/recent-results');
            if (response.success) {
                this.updateRecentResults(response.results);
            }
        } catch (error) {
            console.error('Failed to load recent results:', error);
        }
    },
    
    /**
     * Update recent results display
     */
    updateRecentResults: function(results) {
        const container = document.getElementById('recentResults');
        if (!container) return;
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-clipboard-data fs-1"></i>
                    <p class="mt-2 mb-0">No recent results</p>
                </div>
            `;
        } else {
            container.innerHTML = results.map(result => `
                <div class="result-item card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="fw-semibold mb-1">${ST.utils.sanitizeHtml(result.assessment_title)}</h6>
                                <p class="text-muted mb-2">${ST.utils.sanitizeHtml(result.course_name)}</p>
                                <small class="text-muted">${ST.utils.formatDate(result.completed_at)}</small>
                            </div>
                            <div class="text-end">
                                <div class="grade-display-sm bg-${ST.utils.getGradeColor(result.score)} text-white rounded px-2 py-1">
                                    ${result.score}%
                                </div>
                                <div class="performance-indicator ${this.getPerformanceClass(result.score)} mt-1">
                                    <i class="bi bi-${this.getPerformanceIcon(result.score)} me-1"></i>
                                    ${this.getPerformanceText(result.score)}
                                </div>
                            </div>
                        </div>
                        <div class="progress mt-2" style="height: 6px;">
                            <div class="progress-bar bg-${ST.utils.getGradeColor(result.score)}" 
                                 style="width: ${result.score}%"></div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },
    
    /**
     * Load upcoming assessments
     */
    loadUpcomingAssessments: async function() {
        try {
            const response = await ST.api.get('/student/dashboard/upcoming-assessments');
            if (response.success) {
                this.updateUpcomingAssessments(response.assessments);
            }
        } catch (error) {
            console.error('Failed to load upcoming assessments:', error);
        }
    },
    
    /**
     * Update upcoming assessments display
     */
    updateUpcomingAssessments: function(assessments) {
        const container = document.getElementById('upcomingAssessments');
        if (!container) return;
        
        if (assessments.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-calendar-check fs-1"></i>
                    <p class="mt-2 mb-0">No upcoming assessments</p>
                </div>
            `;
        } else {
            container.innerHTML = assessments.map(assessment => `
                <div class="assessment-item card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="fw-semibold mb-1">${ST.utils.sanitizeHtml(assessment.title)}</h6>
                                <p class="text-muted mb-2">${ST.utils.sanitizeHtml(assessment.course_name)}</p>
                                <div class="d-flex align-items-center text-muted">
                                    <i class="bi bi-calendar me-1"></i>
                                    <small>Due: ${ST.utils.formatDate(assessment.due_date)}</small>
                                </div>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-${this.getUrgencyColor(assessment.due_date)}">
                                    ${this.getTimeUntilDue(assessment.due_date)}
                                </span>
                                <div class="mt-2">
                                    <button class="btn btn-sm btn-primary" onclick="StudentModule.courses.startAssessment('${assessment.id}')">
                                        <i class="bi bi-play me-1"></i>Start
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },
    
    /**
     * Load performance chart
     */
    loadPerformanceChart: async function() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;
        
        try {
            const response = await ST.api.get('/student/dashboard/performance-chart');
            if (response.success) {
                const ctx = canvas.getContext('2d');
                
                this.performanceChart = ST.charts.createLineChart(ctx, {
                    labels: response.labels,
                    datasets: [{
                        label: 'Performance Trend',
                        data: response.data,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: response.data.map(score => {
                            if (score >= 90) return '#198754';
                            if (score >= 80) return '#0dcaf0';
                            if (score >= 70) return '#ffc107';
                            if (score >= 60) return '#fd7e14';
                            return '#dc3545';
                        }),
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 6
                    }]
                }, {
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Score: ${context.parsed.y}%`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load performance chart:', error);
        }
    },
    
    /**
     * Get performance class
     */
    getPerformanceClass: function(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'average';
        return 'poor';
    },
    
    /**
     * Get performance icon
     */
    getPerformanceIcon: function(score) {
        if (score >= 90) return 'trophy';
        if (score >= 80) return 'star';
        if (score >= 70) return 'check-circle';
        return 'exclamation-triangle';
    },
    
    /**
     * Get performance text
     */
    getPerformanceText: function(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 80) return 'Good';
        if (score >= 70) return 'Average';
        return 'Needs Improvement';
    },
    
    /**
     * Get urgency color based on due date
     */
    getUrgencyColor: function(dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 1) return 'danger';
        if (diffDays <= 3) return 'warning';
        if (diffDays <= 7) return 'info';
        return 'success';
    },
    
    /**
     * Get time until due
     */
    getTimeUntilDue: function(dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        const diffMs = due - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Due Today';
        if (diffDays === 1) return 'Due Tomorrow';
        return `${diffDays} days left`;
    },
    
    /**
     * Setup auto-refresh
     */
    setupAutoRefresh: function() {
        setInterval(() => {
            this.loadOverview();
            this.loadRecentResults();
            this.loadUpcomingAssessments();
        }, StudentModule.config.refreshInterval);
    },
    
    /**
     * Refresh dashboard manually
     */
    refresh: function() {
        this.loadOverview();
        this.loadRecentResults();
        this.loadUpcomingAssessments();
        this.loadPerformanceChart();
        ST.ui.showToast('Dashboard refreshed', 'success');
    }
};

// ===================================
// RESULTS AND ANALYTICS
// ===================================

StudentModule.results = {
    /**
     * Load all results
     */
    loadResults: async function(filters = {}) {
        try {
            ST.ui.showLoading('Loading results...');
            
            const queryParams = new URLSearchParams(filters).toString();
            const response = await ST.api.get(`/student/results?${queryParams}`);
            
            if (response.success) {
                this.updateResultsTable(response.results);
                this.updateResultsChart(response.chartData);
            }
        } catch (error) {
            console.error('Failed to load results:', error);
            ST.ui.showToast('Failed to load results', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    },
    
    /**
     * Update results table
     */
    updateResultsTable: function(results) {
        const tbody = document.querySelector('#resultsTable tbody');
        if (!tbody) return;
        
        if (results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-clipboard-data fs-1"></i>
                        <p class="mt-2 mb-0">No results found</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = results.map(result => `
                <tr data-result-id="${result.id}">
                    <td>
                        <div class="fw-semibold">${ST.utils.sanitizeHtml(result.assessment_title)}</div>
                        <small class="text-muted">${ST.utils.sanitizeHtml(result.course_name)}</small>
                    </td>
                    <td>
                        <div class="grade-display-sm bg-${ST.utils.getGradeColor(result.score)} text-white rounded px-2 py-1 d-inline-block">
                            ${result.score}%
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-${ST.utils.getGradeColor(result.score)}">
                            ${ST.utils.getGradeLetter(result.score)}
                        </span>
                    </td>
                    <td>
                        <div class="performance-indicator ${StudentModule.dashboard.getPerformanceClass(result.score)}">
                            <i class="bi bi-${StudentModule.dashboard.getPerformanceIcon(result.score)} me-1"></i>
                            ${StudentModule.dashboard.getPerformanceText(result.score)}
                        </div>
                    </td>
                    <td>
                        <small class="text-muted">${ST.utils.formatDate(result.completed_at)}</small>
                    </td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                Actions
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="StudentModule.results.viewResultDetails('${result.id}')">
                                    <i class="bi bi-eye me-2"></i>View Details
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="StudentModule.results.downloadResult('${result.id}')">
                                    <i class="bi bi-download me-2"></i>Download
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="StudentModule.results.shareResult('${result.id}')">
                                    <i class="bi bi-share me-2"></i>Share
                                </a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    },
    
    /**
     * Update results chart (pie chart showing performance distribution)
     */
    updateResultsChart: function(chartData) {
        const canvas = document.getElementById('resultsChart');
        if (!canvas || !chartData) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.resultsChart) {
            ST.charts.destroyChart(this.resultsChart);
        }
        
        this.resultsChart = ST.charts.createPieChart(ctx, {
            labels: chartData.labels,
            datasets: [{
                data: chartData.data,
                backgroundColor: [
                    '#198754', // A (Excellent)
                    '#0dcaf0', // B (Good)
                    '#ffc107', // C (Average)
                    '#fd7e14', // D (Below Average)
                    '#dc3545'  // F (Poor)
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        }, {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const dataset = data.datasets[0];
                                    const value = dataset.data[i];
                                    const percentage = ((value / dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                                    
                                    return {
                                        text: `${label}: ${value} (${percentage}%)`,
                                        fillStyle: dataset.backgroundColor[i],
                                        strokeStyle: dataset.borderColor,
                                        lineWidth: dataset.borderWidth,
                                        pointStyle: 'circle',
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} assessments (${percentage}%)`;
                        }
                    }
                }
            }
        });
    },
    
    /**
     * View result details
     */
    viewResultDetails: async function(resultId) {
        try {
            const response = await ST.api.get(`/student/results/${resultId}`);
            if (response.success) {
                this.showResultDetailsModal(response.result);
            }
        } catch (error) {
            console.error('Failed to load result details:', error);
            ST.ui.showToast('Failed to load result details', 'error');
        }
    },
    
    /**
     * Show result details modal
     */
    showResultDetailsModal: function(result) {
        const modalHtml = `
            <div class="modal fade" id="resultDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-${ST.utils.getGradeColor(result.score)} text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-clipboard-data me-2"></i>
                                Assessment Result Details
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <h6 class="fw-bold">${ST.utils.sanitizeHtml(result.assessment_title)}</h6>
                                    <p class="text-muted mb-3">${ST.utils.sanitizeHtml(result.course_name)}</p>
                                    
                                    <div class="row mb-3">
                                        <div class="col-sm-6">
                                            <strong>Score:</strong> ${result.score}%
                                        </div>
                                        <div class="col-sm-6">
                                            <strong>Grade:</strong> 
                                            <span class="badge bg-${ST.utils.getGradeColor(result.score)}">
                                                ${ST.utils.getGradeLetter(result.score)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div class="row mb-3">
                                        <div class="col-sm-6">
                                            <strong>Completed:</strong> ${ST.utils.formatDate(result.completed_at)}
                                        </div>
                                        <div class="col-sm-6">
                                            <strong>Time Taken:</strong> ${result.time_taken || 'N/A'}
                                        </div>
                                    </div>
                                    
                                    ${result.feedback ? `
                                        <div class="mb-3">
                                            <strong>Feedback:</strong>
                                            <div class="bg-light p-3 rounded mt-2">
                                                ${ST.utils.sanitizeHtml(result.feedback)}
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    ${result.questions && result.questions.length > 0 ? `
                                        <div class="mb-3">
                                            <strong>Question Breakdown:</strong>
                                            <div class="mt-2">
                                                ${result.questions.map((q, index) => `
                                                    <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                                                        <span>Question ${index + 1}</span>
                                                        <span class="badge bg-${q.correct ? 'success' : 'danger'}">
                                                            ${q.correct ? 'Correct' : 'Incorrect'}
                                                        </span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                                
                                <div class="col-md-4 text-center">
                                    <div class="grade-display grade-${ST.utils.getGradeLetter(result.score).toLowerCase()} mb-3">
                                        ${ST.utils.getGradeLetter(result.score)}
                                    </div>
                                    
                                    <div class="performance-indicator ${StudentModule.dashboard.getPerformanceClass(result.score)} mb-3">
                                        <i class="bi bi-${StudentModule.dashboard.getPerformanceIcon(result.score)} me-1"></i>
                                        ${StudentModule.dashboard.getPerformanceText(result.score)}
                                    </div>
                                    
                                    <div class="progress mb-3" style="height: 10px;">
                                        <div class="progress-bar bg-${ST.utils.getGradeColor(result.score)}" 
                                             style="width: ${result.score}%"></div>
                                    </div>
                                    
                                    <small class="text-muted">Score: ${result.score}%</small>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="StudentModule.results.downloadResult('${result.id}')">
                                <i class="bi bi-download me-1"></i>Download
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('resultDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('resultDetailsModal'));
        modal.show();
    },
    
    /**
     * Download result
     */
    downloadResult: async function(resultId) {
        try {
            ST.ui.showLoading('Preparing download...');
            
            const response = await fetch(`/student/results/${resultId}/download`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `result_${resultId}_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                ST.ui.showToast('Result downloaded successfully', 'success');
            } else {
                ST.ui.showToast('Failed to download result', 'error');
            }
        } catch (error) {
            console.error('Failed to download result:', error);
            ST.ui.showToast('Failed to download result', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    },
    
    /**
     * Share result
     */
    shareResult: function(resultId) {
        if (navigator.share) {
            navigator.share({
                title: 'Assessment Result',
                text: 'Check out my assessment result!',
                url: `${window.location.origin}/student/results/${resultId}/share`
            }).catch(console.error);
        } else {
            // Fallback: copy link to clipboard
            const shareUrl = `${window.location.origin}/student/results/${resultId}/share`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                ST.ui.showToast('Share link copied to clipboard', 'success');
            }).catch(() => {
                ST.ui.showToast('Failed to copy share link', 'error');
            });
        }
    },
    
    /**
     * Export all results
     */
    exportResults: async function(format = 'pdf') {
        try {
            ST.ui.showLoading('Preparing export...');
            
            const response = await fetch(`/student/results/export?format=${format}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `my_results_${new Date().toISOString().split('T')[0]}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                ST.ui.showToast('Results exported successfully', 'success');
            } else {
                ST.ui.showToast('Failed to export results', 'error');
            }
        } catch (error) {
            console.error('Failed to export results:', error);
            ST.ui.showToast('Failed to export results', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    }
};

// ===================================
// PERFORMANCE TRACKING
// ===================================

StudentModule.performance = {
    /**
     * Load performance analytics
     */
    loadAnalytics: async function() {
        try {
            const response = await ST.api.get('/student/performance/analytics');
            if (response.success) {
                this.updateAnalytics(response.analytics);
                this.loadPerformanceCharts(response.chartData);
            }
        } catch (error) {
            console.error('Failed to load performance analytics:', error);
        }
    },
    
    /**
     * Update analytics display
     */
    updateAnalytics: function(analytics) {
        // Update performance metrics
        const metrics = {
            overallGPA: document.getElementById('overallGPA'),
            improvementTrend: document.getElementById('improvementTrend'),
            strongestSubject: document.getElementById('strongestSubject'),
            weakestSubject: document.getElementById('weakestSubject'),
            studyStreak: document.getElementById('studyStreak'),
            totalStudyTime: document.getElementById('totalStudyTime')
        };
        
        Object.keys(metrics).forEach(key => {
            if (metrics[key] && analytics[key] !== undefined) {
                metrics[key].textContent = analytics[key];
                ST.ui.animate(metrics[key], 'bounce-in');
            }
        });
    },
    
    /**
     * Load performance charts
     */
    loadPerformanceCharts: function(chartData) {
        this.loadSubjectPerformanceChart(chartData.subjectPerformance);
        this.loadProgressTrendChart(chartData.progressTrend);
        this.loadTimeDistributionChart(chartData.timeDistribution);
    },
    
    /**
     * Load subject performance chart (pie chart)
     */
    loadSubjectPerformanceChart: function(data) {
        const canvas = document.getElementById('subjectPerformanceChart');
        if (!canvas || !data) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.subjectChart) {
            ST.charts.destroyChart(this.subjectChart);
        }
        
        this.subjectChart = ST.charts.createPieChart(ctx, {
            labels: data.labels,
            datasets: [{
                data: data.scores,
                backgroundColor: StudentModule.config.chartColors.slice(0, data.labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        }, {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const score = data.datasets[0].data[i];
                                    const color = data.datasets[0].backgroundColor[i];
                                    
                                    return {
                                        text: `${label}: ${score}%`,
                                        fillStyle: color,
                                        strokeStyle: '#ffffff',
                                        lineWidth: 2,
                                        pointStyle: 'circle',
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const score = context.parsed;
                            return `${label}: ${score}% average`;
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Load progress trend chart
     */
    loadProgressTrendChart: function(data) {
        const canvas = document.getElementById('progressTrendChart');
        if (!canvas || !data) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.progressChart) {
            ST.charts.destroyChart(this.progressChart);
        }
        
        this.progressChart = ST.charts.createLineChart(ctx, {
            labels: data.labels,
            datasets: [{
                label: 'Average Score',
                data: data.scores,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                tension: 0.4,
                fill: true
            }]
        }, {
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Load time distribution chart
     */
    loadTimeDistributionChart: function(data) {
        const canvas = document.getElementById('timeDistributionChart');
        if (!canvas || !data) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.timeChart) {
            ST.charts.destroyChart(this.timeChart);
        }
        
        this.timeChart = ST.charts.createDoughnutChart(ctx, {
            labels: data.labels,
            datasets: [{
                data: data.hours,
                backgroundColor: StudentModule.config.chartColors.slice(0, data.labels.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        }, {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            }
        });
    }
};

// ===================================
// COURSE MANAGEMENT
// ===================================

StudentModule.courses = {
    /**
     * Load enrolled courses
     */
    loadCourses: async function() {
        try {
            const response = await ST.api.get('/student/courses');
            if (response.success) {
                this.updateCoursesDisplay(response.courses);
            }
        } catch (error) {
            console.error('Failed to load courses:', error);
        }
    },
    
    /**
     * Update courses display
     */
    updateCoursesDisplay: function(courses) {
        const container = document.getElementById('coursesContainer');
        if (!container) return;
        
        if (courses.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-book fs-1"></i>
                    <p class="mt-2 mb-0">No courses enrolled</p>
                </div>
            `;
        } else {
            container.innerHTML = courses.map(course => `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="course-card card h-100 border-0 shadow-sm">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0">${ST.utils.sanitizeHtml(course.name)}</h6>
                            <small>${ST.utils.sanitizeHtml(course.code)}</small>
                        </div>
                        <div class="card-body">
                            <p class="text-muted mb-3">${ST.utils.sanitizeHtml(course.description || 'No description available')}</p>
                            
                            <div class="course-stats mb-3">
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="small text-muted">Progress:</span>
                                    <span class="small fw-semibold">${course.progress || 0}%</span>
                                </div>
                                <div class="progress mb-2" style="height: 6px;">
                                    <div class="progress-bar" style="width: ${course.progress || 0}%"></div>
                                </div>
                                
                                <div class="row text-center">
                                    <div class="col-4">
                                        <div class="small text-muted">Assessments</div>
                                        <div class="fw-semibold">${course.total_assessments || 0}</div>
                                    </div>
                                    <div class="col-4">
                                        <div class="small text-muted">Completed</div>
                                        <div class="fw-semibold">${course.completed_assessments || 0}</div>
                                    </div>
                                    <div class="col-4">
                                        <div class="small text-muted">Average</div>
                                        <div class="fw-semibold">${course.average_score || 0}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-footer bg-transparent">
                            <div class="d-flex gap-2">
                                <button class="btn btn-primary btn-sm flex-grow-1" onclick="StudentModule.courses.viewCourse('${course.id}')">
                                    <i class="bi bi-eye me-1"></i>View
                                </button>
                                <button class="btn btn-outline-primary btn-sm" onclick="StudentModule.courses.viewAssessments('${course.id}')">
                                    <i class="bi bi-clipboard-check me-1"></i>Assessments
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },
    
    /**
     * View course details
     */
    viewCourse: function(courseId) {
        window.location.href = `/student/courses/${courseId}`;
    },
    
    /**
     * View course assessments
     */
    viewAssessments: function(courseId) {
        window.location.href = `/student/courses/${courseId}/assessments`;
    },
    
    /**
     * Start assessment
     */
    startAssessment: async function(assessmentId) {
        try {
            const confirmed = await ST.ui.confirm(
                'Are you ready to start this assessment? Make sure you have enough time to complete it.',
                'Start Assessment'
            );
            if (!confirmed) return;
            
            window.location.href = `/student/assessments/${assessmentId}/start`;
        } catch (error) {
            console.error('Failed to start assessment:', error);
            ST.ui.showToast('Failed to start assessment', 'error');
        }
    }
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize student module based on current page
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('/student/dashboard')) {
        StudentModule.dashboard.init();
    } else if (currentPage.includes('/student/results')) {
        StudentModule.results.loadResults();
        
        // Setup search functionality
        const searchInput = document.getElementById('resultSearch');
        if (searchInput) {
            searchInput.addEventListener('input', ST.utils.debounce(function() {
                StudentModule.results.loadResults({ search: this.value });
            }, 300));
        }
        
        // Setup filter functionality
        const filterSelects = document.querySelectorAll('.result-filter');
        filterSelects.forEach(select => {
            select.addEventListener('change', function() {
                const filters = {};
                filterSelects.forEach(s => {
                    if (s.value) filters[s.name] = s.value;
                });
                StudentModule.results.loadResults(filters);
            });
        });
        
    } else if (currentPage.includes('/student/performance')) {
        StudentModule.performance.loadAnalytics();
    } else if (currentPage.includes('/student/courses')) {
        StudentModule.courses.loadCourses();
    }
    
    console.log('Student module initialized successfully');
});

// Export for global access
window.Student = StudentModule;


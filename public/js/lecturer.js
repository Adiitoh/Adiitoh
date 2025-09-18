/**
 * Student Assessment Tracker - Lecturer JavaScript
 * Academic Year 2026/27
 * 
 * This file contains lecturer-specific functionality
 */

// Lecturer module
window.LecturerModule = {
    // Configuration
    config: {
        refreshInterval: 45000, // 45 seconds for lecturer data
        maxQuestions: 50,
        questionTypes: ['multiple_choice', 'true_false', 'short_answer', 'essay']
    },
    
    // Dashboard functions
    dashboard: {},
    
    // Assessment management
    assessments: {},
    
    // Course management
    courses: {},
    
    // Results and analytics
    results: {},
    
    // Question management
    questions: {}
};

// ===================================
// DASHBOARD FUNCTIONS
// ===================================

LecturerModule.dashboard = {
    /**
     * Initialize lecturer dashboard
     */
    init: function() {
        this.loadOverview();
        this.loadRecentActivity();
        this.loadUpcomingDeadlines();
        this.loadPerformanceCharts();
        this.setupAutoRefresh();
    },
    
    /**
     * Load dashboard overview
     */
    loadOverview: async function() {
        try {
            const response = await ST.api.get('/lecturer/dashboard/overview');
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
            totalStudents: document.getElementById('totalStudents'),
            activeAssessments: document.getElementById('activeAssessments'),
            pendingGrading: document.getElementById('pendingGrading'),
            averageClassPerformance: document.getElementById('averageClassPerformance'),
            completionRate: document.getElementById('completionRate')
        };
        
        Object.keys(elements).forEach(key => {
            if (elements[key] && overview[key] !== undefined) {
                if (key.includes('Performance') || key.includes('Rate')) {
                    elements[key].textContent = overview[key] + '%';
                    elements[key].className = `fw-bold text-${ST.utils.getGradeColor(overview[key])}`;
                } else {
                    elements[key].textContent = ST.ui.formatNumber(overview[key]);
                }
                
                // Add animation
                ST.ui.animate(elements[key], 'bounce-in');
            }
        });
    },
    
    /**
     * Load recent activity
     */
    loadRecentActivity: async function() {
        try {
            const response = await ST.api.get('/lecturer/dashboard/recent-activity');
            if (response.success) {
                this.updateRecentActivity(response.activities);
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    },
    
    /**
     * Update recent activity display
     */
    updateRecentActivity: function(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-clock fs-1"></i>
                    <p class="mt-2 mb-0">No recent activity</p>
                </div>
            `;
        } else {
            container.innerHTML = activities.map(activity => `
                <div class="activity-item d-flex align-items-start mb-3">
                    <div class="activity-icon bg-${this.getActivityColor(activity.type)} rounded-circle p-2 me-3">
                        <i class="bi bi-${this.getActivityIcon(activity.type)} text-white"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="fw-semibold mb-1">${ST.utils.sanitizeHtml(activity.title)}</h6>
                        <p class="text-muted mb-1">${ST.utils.sanitizeHtml(activity.description)}</p>
                        <small class="text-muted">${ST.utils.timeAgo(activity.created_at)}</small>
                    </div>
                </div>
            `).join('');
        }
    },
    
    /**
     * Load upcoming deadlines
     */
    loadUpcomingDeadlines: async function() {
        try {
            const response = await ST.api.get('/lecturer/dashboard/upcoming-deadlines');
            if (response.success) {
                this.updateUpcomingDeadlines(response.deadlines);
            }
        } catch (error) {
            console.error('Failed to load upcoming deadlines:', error);
        }
    },
    
    /**
     * Update upcoming deadlines display
     */
    updateUpcomingDeadlines: function(deadlines) {
        const container = document.getElementById('upcomingDeadlines');
        if (!container) return;
        
        if (deadlines.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-calendar-check fs-1"></i>
                    <p class="mt-2 mb-0">No upcoming deadlines</p>
                </div>
            `;
        } else {
            container.innerHTML = deadlines.map(deadline => `
                <div class="deadline-item card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="fw-semibold mb-1">${ST.utils.sanitizeHtml(deadline.title)}</h6>
                                <p class="text-muted mb-2">${ST.utils.sanitizeHtml(deadline.course_name)}</p>
                                <div class="d-flex align-items-center text-muted">
                                    <i class="bi bi-calendar me-1"></i>
                                    <small>Due: ${ST.utils.formatDate(deadline.due_date)}</small>
                                </div>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-${this.getUrgencyColor(deadline.due_date)}">
                                    ${this.getTimeUntilDue(deadline.due_date)}
                                </span>
                                <div class="mt-2">
                                    <small class="text-muted">${deadline.submissions_count || 0} submissions</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },
    
    /**
     * Load performance charts
     */
    loadPerformanceCharts: async function() {
        try {
            const response = await ST.api.get('/lecturer/dashboard/performance-charts');
            if (response.success) {
                this.initClassPerformanceChart(response.classPerformance);
                this.initSubmissionTrendChart(response.submissionTrend);
            }
        } catch (error) {
            console.error('Failed to load performance charts:', error);
        }
    },
    
    /**
     * Initialize class performance chart
     */
    initClassPerformanceChart: function(data) {
        const canvas = document.getElementById('classPerformanceChart');
        if (!canvas || !data) return;
        
        const ctx = canvas.getContext('2d');
        
        this.classPerformanceChart = ST.charts.createBarChart(ctx, {
            labels: data.labels,
            datasets: [{
                label: 'Average Score',
                data: data.scores,
                backgroundColor: data.scores.map(score => {
                    if (score >= 90) return '#198754';
                    if (score >= 80) return '#0dcaf0';
                    if (score >= 70) return '#ffc107';
                    if (score >= 60) return '#fd7e14';
                    return '#dc3545';
                }),
                borderColor: '#ffffff',
                borderWidth: 1
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
     * Initialize submission trend chart
     */
    initSubmissionTrendChart: function(data) {
        const canvas = document.getElementById('submissionTrendChart');
        if (!canvas || !data) return;
        
        const ctx = canvas.getContext('2d');
        
        this.submissionTrendChart = ST.charts.createLineChart(ctx, {
            labels: data.labels,
            datasets: [{
                label: 'Submissions',
                data: data.submissions,
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
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        });
    },
    
    /**
     * Get activity color
     */
    getActivityColor: function(type) {
        const colors = {
            assessment_created: 'primary',
            assessment_submitted: 'success',
            assessment_graded: 'info',
            course_updated: 'warning',
            student_enrolled: 'secondary'
        };
        return colors[type] || 'secondary';
    },
    
    /**
     * Get activity icon
     */
    getActivityIcon: function(type) {
        const icons = {
            assessment_created: 'plus-circle',
            assessment_submitted: 'check-circle',
            assessment_graded: 'star',
            course_updated: 'pencil',
            student_enrolled: 'person-plus'
        };
        return icons[type] || 'info-circle';
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
            this.loadRecentActivity();
            this.loadUpcomingDeadlines();
        }, LecturerModule.config.refreshInterval);
    },
    
    /**
     * Refresh dashboard manually
     */
    refresh: function() {
        this.loadOverview();
        this.loadRecentActivity();
        this.loadUpcomingDeadlines();
        this.loadPerformanceCharts();
        ST.ui.showToast('Dashboard refreshed', 'success');
    }
};

// ===================================
// ASSESSMENT MANAGEMENT
// ===================================

LecturerModule.assessments = {
    /**
     * Load all assessments
     */
    loadAssessments: async function(filters = {}) {
        try {
            ST.ui.showLoading('Loading assessments...');
            
            const queryParams = new URLSearchParams(filters).toString();
            const response = await ST.api.get(`/lecturer/assessments?${queryParams}`);
            
            if (response.success) {
                this.updateAssessmentsTable(response.assessments);
            }
        } catch (error) {
            console.error('Failed to load assessments:', error);
            ST.ui.showToast('Failed to load assessments', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    },
    
    /**
     * Update assessments table
     */
    updateAssessmentsTable: function(assessments) {
        const tbody = document.querySelector('#assessmentsTable tbody');
        if (!tbody) return;
        
        if (assessments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-clipboard-check fs-1"></i>
                        <p class="mt-2 mb-0">No assessments found</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = assessments.map(assessment => `
                <tr data-assessment-id="${assessment.id}">
                    <td>
                        <div class="fw-semibold">${ST.utils.sanitizeHtml(assessment.title)}</div>
                        <small class="text-muted">${ST.utils.sanitizeHtml(assessment.course_name)}</small>
                    </td>
                    <td>
                        <span class="badge bg-${this.getStatusColor(assessment.status)}">
                            ${assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
                        </span>
                    </td>
                    <td>
                        <small class="text-muted">${ST.utils.formatDate(assessment.due_date)}</small>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <span class="me-2">${assessment.submissions_count || 0}/${assessment.total_students || 0}</span>
                            <div class="progress flex-grow-1" style="height: 6px;">
                                <div class="progress-bar" style="width: ${this.getSubmissionPercentage(assessment)}%"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="fw-semibold">${assessment.average_score || 0}%</span>
                    </td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                Actions
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="/lecturer/assessments/${assessment.id}">
                                    <i class="bi bi-eye me-2"></i>View Details
                                </a></li>
                                <li><a class="dropdown-item" href="/lecturer/assessments/${assessment.id}/edit">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </a></li>
                                <li><a class="dropdown-item" href="/lecturer/assessments/${assessment.id}/results">
                                    <i class="bi bi-clipboard-data me-2"></i>View Results
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="LecturerModule.assessments.duplicateAssessment('${assessment.id}')">
                                    <i class="bi bi-files me-2"></i>Duplicate
                                </a></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="LecturerModule.assessments.deleteAssessment('${assessment.id}')">
                                    <i class="bi bi-trash me-2"></i>Delete
                                </a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    },
    
    /**
     * Get status color
     */
    getStatusColor: function(status) {
        const colors = {
            draft: 'secondary',
            published: 'success',
            closed: 'danger',
            scheduled: 'warning'
        };
        return colors[status] || 'secondary';
    },
    
    /**
     * Get submission percentage
     */
    getSubmissionPercentage: function(assessment) {
        if (!assessment.total_students || assessment.total_students === 0) return 0;
        return Math.round((assessment.submissions_count / assessment.total_students) * 100);
    },
    
    /**
     * Create new assessment
     */
    createAssessment: function() {
        window.location.href = '/lecturer/assessments/create';
    },
    
    /**
     * Duplicate assessment
     */
    duplicateAssessment: async function(assessmentId) {
        try {
            const confirmed = await ST.ui.confirm(
                'Are you sure you want to duplicate this assessment?',
                'Duplicate Assessment'
            );
            if (!confirmed) return;
            
            const response = await ST.api.post(`/lecturer/assessments/${assessmentId}/duplicate`);
            if (response.success) {
                ST.ui.showToast('Assessment duplicated successfully', 'success');
                this.loadAssessments();
            } else {
                ST.ui.showToast(response.message || 'Failed to duplicate assessment', 'error');
            }
        } catch (error) {
            console.error('Failed to duplicate assessment:', error);
            ST.ui.showToast('Failed to duplicate assessment', 'error');
        }
    },
    
    /**
     * Delete assessment
     */
    deleteAssessment: async function(assessmentId) {
        try {
            const confirmed = await ST.ui.confirm(
                'Are you sure you want to delete this assessment? This action cannot be undone and will remove all associated results.',
                'Delete Assessment'
            );
            if (!confirmed) return;
            
            const response = await ST.api.delete(`/lecturer/assessments/${assessmentId}`);
            if (response.success) {
                ST.ui.showToast('Assessment deleted successfully', 'success');
                this.loadAssessments();
            } else {
                ST.ui.showToast(response.message || 'Failed to delete assessment', 'error');
            }
        } catch (error) {
            console.error('Failed to delete assessment:', error);
            ST.ui.showToast('Failed to delete assessment', 'error');
        }
    },
    
    /**
     * Initialize assessment form
     */
    initAssessmentForm: function() {
        const form = document.getElementById('assessmentForm');
        if (!form) return;
        
        // Setup form validation
        form.addEventListener('submit', this.handleAssessmentSubmit.bind(this));
        
        // Setup question management
        this.initQuestionManagement();
        
        // Setup auto-save
        this.setupAutoSave();
    },
    
    /**
     * Handle assessment form submission
     */
    handleAssessmentSubmit: async function(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        try {
            ST.forms.setLoading(submitBtn, true);
            
            if (!ST.forms.validate(form)) {
                return;
            }
            
            const formData = ST.forms.serialize(form);
            const questions = this.getQuestions();
            
            if (questions.length === 0) {
                ST.ui.showToast('Please add at least one question', 'warning');
                return;
            }
            
            formData.questions = questions;
            
            const isEdit = form.dataset.assessmentId;
            const endpoint = isEdit ? `/lecturer/assessments/${form.dataset.assessmentId}` : '/lecturer/assessments';
            const method = isEdit ? 'put' : 'post';
            
            const response = await ST.api[method](endpoint, formData);
            
            if (response.success) {
                ST.ui.showToast(`Assessment ${isEdit ? 'updated' : 'created'} successfully`, 'success');
                setTimeout(() => {
                    window.location.href = '/lecturer/assessments';
                }, 1500);
            } else {
                ST.ui.showToast(response.message || `Failed to ${isEdit ? 'update' : 'create'} assessment`, 'error');
            }
        } catch (error) {
            console.error('Failed to submit assessment:', error);
            ST.ui.showToast('Failed to submit assessment', 'error');
        } finally {
            ST.forms.setLoading(submitBtn, false);
        }
    },
    
    /**
     * Initialize question management
     */
    initQuestionManagement: function() {
        const addQuestionBtn = document.getElementById('addQuestionBtn');
        if (addQuestionBtn) {
            addQuestionBtn.addEventListener('click', () => {
                this.addQuestion();
            });
        }
        
        // Load existing questions if editing
        const questionsData = document.getElementById('questionsData');
        if (questionsData && questionsData.textContent) {
            try {
                const questions = JSON.parse(questionsData.textContent);
                questions.forEach(question => {
                    this.addQuestion(question);
                });
            } catch (error) {
                console.error('Failed to load existing questions:', error);
            }
        }
    },
    
    /**
     * Add question to form
     */
    addQuestion: function(questionData = null) {
        const questionsContainer = document.getElementById('questionsContainer');
        if (!questionsContainer) return;
        
        const questionIndex = questionsContainer.children.length;
        const questionId = questionData ? questionData.id : ST.utils.generateId();
        
        const questionHtml = `
            <div class="question-item card mb-3" data-question-id="${questionId}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Question ${questionIndex + 1}</h6>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-secondary" onclick="LecturerModule.assessments.moveQuestionUp(this)">
                            <i class="bi bi-arrow-up"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary" onclick="LecturerModule.assessments.moveQuestionDown(this)">
                            <i class="bi bi-arrow-down"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="LecturerModule.assessments.removeQuestion(this)">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <div class="mb-3">
                                <label class="form-label">Question Text *</label>
                                <textarea class="form-control" name="questions[${questionIndex}][text]" rows="3" required>${questionData ? ST.utils.sanitizeHtml(questionData.text) : ''}</textarea>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="mb-3">
                                <label class="form-label">Question Type *</label>
                                <select class="form-select" name="questions[${questionIndex}][type]" onchange="LecturerModule.assessments.updateQuestionOptions(this)" required>
                                    <option value="">Select Type</option>
                                    <option value="multiple_choice" ${questionData && questionData.type === 'multiple_choice' ? 'selected' : ''}>Multiple Choice</option>
                                    <option value="true_false" ${questionData && questionData.type === 'true_false' ? 'selected' : ''}>True/False</option>
                                    <option value="short_answer" ${questionData && questionData.type === 'short_answer' ? 'selected' : ''}>Short Answer</option>
                                    <option value="essay" ${questionData && questionData.type === 'essay' ? 'selected' : ''}>Essay</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Points *</label>
                                <input type="number" class="form-control" name="questions[${questionIndex}][points]" min="1" max="100" value="${questionData ? questionData.points : 1}" required>
                            </div>
                        </div>
                    </div>
                    
                    <div class="question-options" id="questionOptions${questionIndex}">
                        <!-- Options will be populated based on question type -->
                    </div>
                    
                    <input type="hidden" name="questions[${questionIndex}][id]" value="${questionId}">
                </div>
            </div>
        `;
        
        questionsContainer.insertAdjacentHTML('beforeend', questionHtml);
        
        // Update question options based on type
        if (questionData && questionData.type) {
            const typeSelect = questionsContainer.querySelector(`select[name="questions[${questionIndex}][type]"]`);
            this.updateQuestionOptions(typeSelect, questionData);
        }
        
        this.updateQuestionNumbers();
    },
    
    /**
     * Update question options based on type
     */
    updateQuestionOptions: function(selectElement, questionData = null) {
        const questionItem = selectElement.closest('.question-item');
        const questionIndex = Array.from(questionItem.parentNode.children).indexOf(questionItem);
        const optionsContainer = document.getElementById(`questionOptions${questionIndex}`);
        const questionType = selectElement.value;
        
        if (!optionsContainer) return;
        
        let optionsHtml = '';
        
        switch (questionType) {
            case 'multiple_choice':
                optionsHtml = `
                    <div class="mb-3">
                        <label class="form-label">Answer Options</label>
                        <div class="options-list" id="optionsList${questionIndex}">
                            ${this.generateMultipleChoiceOptions(questionIndex, questionData)}
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-primary" onclick="LecturerModule.assessments.addOption(${questionIndex})">
                            <i class="bi bi-plus me-1"></i>Add Option
                        </button>
                    </div>
                `;
                break;
                
            case 'true_false':
                optionsHtml = `
                    <div class="mb-3">
                        <label class="form-label">Correct Answer</label>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="questions[${questionIndex}][correct_answer]" value="true" ${questionData && questionData.correct_answer === 'true' ? 'checked' : ''} required>
                            <label class="form-check-label">True</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="questions[${questionIndex}][correct_answer]" value="false" ${questionData && questionData.correct_answer === 'false' ? 'checked' : ''} required>
                            <label class="form-check-label">False</label>
                        </div>
                    </div>
                `;
                break;
                
            case 'short_answer':
                optionsHtml = `
                    <div class="mb-3">
                        <label class="form-label">Sample Answer (for grading reference)</label>
                        <textarea class="form-control" name="questions[${questionIndex}][sample_answer]" rows="2" placeholder="Provide a sample answer for grading reference...">${questionData ? ST.utils.sanitizeHtml(questionData.sample_answer || '') : ''}</textarea>
                    </div>
                `;
                break;
                
            case 'essay':
                optionsHtml = `
                    <div class="mb-3">
                        <label class="form-label">Grading Rubric</label>
                        <textarea class="form-control" name="questions[${questionIndex}][rubric]" rows="3" placeholder="Provide grading criteria and rubric...">${questionData ? ST.utils.sanitizeHtml(questionData.rubric || '') : ''}</textarea>
                    </div>
                `;
                break;
        }
        
        optionsContainer.innerHTML = optionsHtml;
    },
    
    /**
     * Generate multiple choice options
     */
    generateMultipleChoiceOptions: function(questionIndex, questionData = null) {
        const options = questionData && questionData.options ? questionData.options : [
            { text: '', is_correct: false },
            { text: '', is_correct: false }
        ];
        
        return options.map((option, optionIndex) => `
            <div class="option-item d-flex align-items-center mb-2">
                <div class="form-check me-2">
                    <input class="form-check-input" type="radio" name="questions[${questionIndex}][correct_option]" value="${optionIndex}" ${option.is_correct ? 'checked' : ''} required>
                </div>
                <input type="text" class="form-control me-2" name="questions[${questionIndex}][options][${optionIndex}][text]" placeholder="Option ${optionIndex + 1}" value="${ST.utils.sanitizeHtml(option.text)}" required>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="LecturerModule.assessments.removeOption(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `).join('');
    },
    
    /**
     * Add option to multiple choice question
     */
    addOption: function(questionIndex) {
        const optionsList = document.getElementById(`optionsList${questionIndex}`);
        if (!optionsList) return;
        
        const optionIndex = optionsList.children.length;
        
        const optionHtml = `
            <div class="option-item d-flex align-items-center mb-2">
                <div class="form-check me-2">
                    <input class="form-check-input" type="radio" name="questions[${questionIndex}][correct_option]" value="${optionIndex}" required>
                </div>
                <input type="text" class="form-control me-2" name="questions[${questionIndex}][options][${optionIndex}][text]" placeholder="Option ${optionIndex + 1}" required>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="LecturerModule.assessments.removeOption(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        
        optionsList.insertAdjacentHTML('beforeend', optionHtml);
    },
    
    /**
     * Remove option from multiple choice question
     */
    removeOption: function(button) {
        const optionItem = button.closest('.option-item');
        const optionsList = optionItem.parentNode;
        
        if (optionsList.children.length <= 2) {
            ST.ui.showToast('Multiple choice questions must have at least 2 options', 'warning');
            return;
        }
        
        optionItem.remove();
        this.updateOptionIndexes(optionsList);
    },
    
    /**
     * Update option indexes after removal
     */
    updateOptionIndexes: function(optionsList) {
        Array.from(optionsList.children).forEach((optionItem, index) => {
            const radio = optionItem.querySelector('input[type="radio"]');
            const textInput = optionItem.querySelector('input[type="text"]');
            
            if (radio) {
                radio.value = index;
                radio.name = radio.name.replace(/\[\d+\]/, `[${index}]`);
            }
            
            if (textInput) {
                textInput.name = textInput.name.replace(/\[\d+\]/, `[${index}]`);
                textInput.placeholder = `Option ${index + 1}`;
            }
        });
    },
    
    /**
     * Remove question
     */
    removeQuestion: function(button) {
        const questionItem = button.closest('.question-item');
        const questionsContainer = questionItem.parentNode;
        
        if (questionsContainer.children.length <= 1) {
            ST.ui.showToast('Assessment must have at least one question', 'warning');
            return;
        }
        
        questionItem.remove();
        this.updateQuestionNumbers();
    },
    
    /**
     * Move question up
     */
    moveQuestionUp: function(button) {
        const questionItem = button.closest('.question-item');
        const previousSibling = questionItem.previousElementSibling;
        
        if (previousSibling) {
            questionItem.parentNode.insertBefore(questionItem, previousSibling);
            this.updateQuestionNumbers();
        }
    },
    
    /**
     * Move question down
     */
    moveQuestionDown: function(button) {
        const questionItem = button.closest('.question-item');
        const nextSibling = questionItem.nextElementSibling;
        
        if (nextSibling) {
            questionItem.parentNode.insertBefore(nextSibling, questionItem);
            this.updateQuestionNumbers();
        }
    },
    
    /**
     * Update question numbers
     */
    updateQuestionNumbers: function() {
        const questionsContainer = document.getElementById('questionsContainer');
        if (!questionsContainer) return;
        
        Array.from(questionsContainer.children).forEach((questionItem, index) => {
            const header = questionItem.querySelector('.card-header h6');
            if (header) {
                header.textContent = `Question ${index + 1}`;
            }
            
            // Update form field names
            const inputs = questionItem.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.name && input.name.includes('questions[')) {
                    input.name = input.name.replace(/questions\[\d+\]/, `questions[${index}]`);
                }
            });
        });
    },
    
    /**
     * Get questions data
     */
    getQuestions: function() {
        const questionsContainer = document.getElementById('questionsContainer');
        if (!questionsContainer) return [];
        
        const questions = [];
        
        Array.from(questionsContainer.children).forEach((questionItem, index) => {
            const question = {
                id: questionItem.dataset.questionId,
                text: questionItem.querySelector(`textarea[name="questions[${index}][text]"]`).value,
                type: questionItem.querySelector(`select[name="questions[${index}][type]"]`).value,
                points: parseInt(questionItem.querySelector(`input[name="questions[${index}][points]"]`).value)
            };
            
            // Add type-specific data
            switch (question.type) {
                case 'multiple_choice':
                    const options = [];
                    const correctOption = questionItem.querySelector(`input[name="questions[${index}][correct_option]"]:checked`);
                    const optionInputs = questionItem.querySelectorAll(`input[name^="questions[${index}][options]"]`);
                    
                    optionInputs.forEach((input, optionIndex) => {
                        options.push({
                            text: input.value,
                            is_correct: correctOption && parseInt(correctOption.value) === optionIndex
                        });
                    });
                    
                    question.options = options;
                    break;
                    
                case 'true_false':
                    const correctAnswer = questionItem.querySelector(`input[name="questions[${index}][correct_answer]"]:checked`);
                    question.correct_answer = correctAnswer ? correctAnswer.value : null;
                    break;
                    
                case 'short_answer':
                    const sampleAnswer = questionItem.querySelector(`textarea[name="questions[${index}][sample_answer]"]`);
                    question.sample_answer = sampleAnswer ? sampleAnswer.value : '';
                    break;
                    
                case 'essay':
                    const rubric = questionItem.querySelector(`textarea[name="questions[${index}][rubric]"]`);
                    question.rubric = rubric ? rubric.value : '';
                    break;
            }
            
            questions.push(question);
        });
        
        return questions;
    },
    
    /**
     * Setup auto-save
     */
    setupAutoSave: function() {
        const form = document.getElementById('assessmentForm');
        if (!form) return;
        
        let autoSaveTimeout;
        
        form.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                this.autoSave();
            }, 30000); // Auto-save every 30 seconds
        });
    },
    
    /**
     * Auto-save assessment
     */
    autoSave: async function() {
        const form = document.getElementById('assessmentForm');
        if (!form) return;
        
        try {
            const formData = ST.forms.serialize(form);
            const questions = this.getQuestions();
            formData.questions = questions;
            formData.is_draft = true;
            
            await ST.api.post('/lecturer/assessments/auto-save', formData);
            
            // Show subtle indication of auto-save
            const indicator = document.getElementById('autoSaveIndicator');
            if (indicator) {
                indicator.textContent = `Auto-saved at ${new Date().toLocaleTimeString()}`;
                indicator.classList.remove('d-none');
                
                setTimeout(() => {
                    indicator.classList.add('d-none');
                }, 3000);
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }
};

// ===================================
// RESULTS AND ANALYTICS
// ===================================

LecturerModule.results = {
    /**
     * Load assessment results
     */
    loadResults: async function(assessmentId, filters = {}) {
        try {
            ST.ui.showLoading('Loading results...');
            
            const queryParams = new URLSearchParams(filters).toString();
            const response = await ST.api.get(`/lecturer/assessments/${assessmentId}/results?${queryParams}`);
            
            if (response.success) {
                this.updateResultsTable(response.results);
                this.updateResultsAnalytics(response.analytics);
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
                        <div class="d-flex align-items-center">
                            <div class="user-avatar me-2">
                                <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                    <i class="bi bi-person-fill text-white small"></i>
                                </div>
                            </div>
                            <div>
                                <div class="fw-semibold">${ST.utils.sanitizeHtml(result.student_name)}</div>
                                <small class="text-muted">${ST.utils.sanitizeHtml(result.student_id)}</small>
                            </div>
                        </div>
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
                        <small class="text-muted">${ST.utils.formatDate(result.submitted_at)}</small>
                    </td>
                    <td>
                        <span class="badge bg-${result.needs_grading ? 'warning' : 'success'}">
                            ${result.needs_grading ? 'Pending' : 'Graded'}
                        </span>
                    </td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                Actions
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="LecturerModule.results.viewResult('${result.id}')">
                                    <i class="bi bi-eye me-2"></i>View Details
                                </a></li>
                                ${result.needs_grading ? `
                                    <li><a class="dropdown-item" href="#" onclick="LecturerModule.results.gradeResult('${result.id}')">
                                        <i class="bi bi-pencil me-2"></i>Grade
                                    </a></li>
                                ` : ''}
                                <li><a class="dropdown-item" href="#" onclick="LecturerModule.results.downloadResult('${result.id}')">
                                    <i class="bi bi-download me-2"></i>Download
                                </a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    },
    
    /**
     * Update results analytics
     */
    updateResultsAnalytics: function(analytics) {
        const elements = {
            totalSubmissions: document.getElementById('totalSubmissions'),
            averageScore: document.getElementById('averageScore'),
            highestScore: document.getElementById('highestScore'),
            lowestScore: document.getElementById('lowestScore'),
            passRate: document.getElementById('passRate'),
            pendingGrading: document.getElementById('pendingGrading')
        };
        
        Object.keys(elements).forEach(key => {
            if (elements[key] && analytics[key] !== undefined) {
                if (key.includes('Score') || key.includes('Rate')) {
                    elements[key].textContent = analytics[key] + '%';
                } else {
                    elements[key].textContent = ST.ui.formatNumber(analytics[key]);
                }
                
                ST.ui.animate(elements[key], 'bounce-in');
            }
        });
    },
    
    /**
     * Update results chart
     */
    updateResultsChart: function(chartData) {
        const canvas = document.getElementById('resultsDistributionChart');
        if (!canvas || !chartData) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.resultsChart) {
            ST.charts.destroyChart(this.resultsChart);
        }
        
        this.resultsChart = ST.charts.createBarChart(ctx, {
            labels: chartData.labels,
            datasets: [{
                label: 'Number of Students',
                data: chartData.data,
                backgroundColor: [
                    '#198754', // A
                    '#0dcaf0', // B
                    '#ffc107', // C
                    '#fd7e14', // D
                    '#dc3545'  // F
                ],
                borderColor: '#ffffff',
                borderWidth: 1
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
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        });
    },
    
    /**
     * View result details
     */
    viewResult: async function(resultId) {
        try {
            const response = await ST.api.get(`/lecturer/results/${resultId}`);
            if (response.success) {
                this.showResultModal(response.result);
            }
        } catch (error) {
            console.error('Failed to load result:', error);
            ST.ui.showToast('Failed to load result', 'error');
        }
    },
    
    /**
     * Show result modal
     */
    showResultModal: function(result) {
        // Implementation similar to student result modal but with lecturer perspective
        // Including grading interface for essay questions
        console.log('Show result modal:', result);
    },
    
    /**
     * Grade result
     */
    gradeResult: async function(resultId) {
        // Implementation for grading interface
        console.log('Grade result:', resultId);
    },
    
    /**
     * Download result
     */
    downloadResult: async function(resultId) {
        try {
            const response = await fetch(`/lecturer/results/${resultId}/download`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `result_${resultId}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                ST.ui.showToast('Result downloaded successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to download result:', error);
            ST.ui.showToast('Failed to download result', 'error');
        }
    },
    
    /**
     * Export all results
     */
    exportResults: async function(assessmentId, format = 'csv') {
        try {
            ST.ui.showLoading('Preparing export...');
            
            const response = await fetch(`/lecturer/assessments/${assessmentId}/results/export?format=${format}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `assessment_results_${assessmentId}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                ST.ui.showToast('Results exported successfully', 'success');
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
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize lecturer module based on current page
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('/lecturer/dashboard')) {
        LecturerModule.dashboard.init();
    } else if (currentPage.includes('/lecturer/assessments')) {
        if (currentPage.includes('/create') || currentPage.includes('/edit')) {
            LecturerModule.assessments.initAssessmentForm();
        } else if (currentPage.includes('/results')) {
            const assessmentId = currentPage.split('/')[3];
            LecturerModule.results.loadResults(assessmentId);
        } else {
            LecturerModule.assessments.loadAssessments();
            
            // Setup search functionality
            const searchInput = document.getElementById('assessmentSearch');
            if (searchInput) {
                searchInput.addEventListener('input', ST.utils.debounce(function() {
                    LecturerModule.assessments.loadAssessments({ search: this.value });
                }, 300));
            }
        }
    }
    
    console.log('Lecturer module initialized successfully');
});

// Export for global access
window.Lecturer = LecturerModule;


/**
 * Student Assessment Tracker - Admin JavaScript
 * Academic Year 2026/27
 * 
 * This file contains admin-specific functionality
 */

// Admin module
window.AdminModule = {
    // Configuration
    config: {
        refreshInterval: 30000, // 30 seconds for admin data
        maxBulkActions: 50
    },
    
    // Dashboard functions
    dashboard: {},
    
    // User management functions
    users: {},
    
    // Course management functions
    courses: {},
    
    // Reports and analytics
    reports: {},
    
    // System management
    system: {}
};

// ===================================
// DASHBOARD FUNCTIONS
// ===================================

AdminModule.dashboard = {
    /**
     * Initialize dashboard
     */
    init: function() {
        this.loadStatistics();
        this.loadPendingApprovals();
        this.loadRecentActivity();
        this.initializeCharts();
        this.setupAutoRefresh();
    },
    
    /**
     * Load dashboard statistics
     */
    loadStatistics: async function() {
        try {
            const response = await ST.api.get('/admin/dashboard/stats');
            if (response.success) {
                this.updateStatistics(response.stats);
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    },
    
    /**
     * Update statistics display
     */
    updateStatistics: function(stats) {
        const elements = {
            totalUsers: document.getElementById('totalUsers'),
            pendingApprovals: document.getElementById('pendingApprovals'),
            activeCourses: document.getElementById('activeCourses'),
            totalAssessments: document.getElementById('totalAssessments'),
            userGrowth: document.getElementById('userGrowth'),
            courseGrowth: document.getElementById('courseGrowth'),
            completedAssessments: document.getElementById('completedAssessments'),
            studentCount: document.getElementById('studentCount'),
            lecturerCount: document.getElementById('lecturerCount'),
            adminCount: document.getElementById('adminCount')
        };
        
        Object.keys(elements).forEach(key => {
            if (elements[key] && stats[key] !== undefined) {
                if (key.includes('Growth') && !key.includes('course')) {
                    elements[key].textContent = stats[key] + '%';
                } else {
                    elements[key].textContent = ST.ui.formatNumber(stats[key]);
                }
                
                // Add animation
                ST.ui.animate(elements[key], 'bounce-in');
            }
        });
    },
    
    /**
     * Load pending approvals
     */
    loadPendingApprovals: async function() {
        try {
            const response = await ST.api.get('/admin/pending-approvals?limit=5');
            if (response.success) {
                this.updatePendingApprovals(response.users);
            }
        } catch (error) {
            console.error('Failed to load pending approvals:', error);
        }
    },
    
    /**
     * Update pending approvals table
     */
    updatePendingApprovals: function(users) {
        const tbody = document.querySelector('#pendingApprovalsTable tbody');
        if (!tbody) return;
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-muted">
                        <i class="bi bi-check-circle fs-1 text-success"></i>
                        <p class="mt-2 mb-0">No pending approvals</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = users.map(user => `
                <tr data-user-id="${user.id}">
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar me-2">
                                <div class="bg-secondary rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                    <i class="bi bi-person-fill text-white small"></i>
                                </div>
                            </div>
                            <div>
                                <div class="fw-semibold">${ST.utils.sanitizeHtml(user.first_name)} ${ST.utils.sanitizeHtml(user.last_name)}</div>
                                <small class="text-muted">${ST.utils.sanitizeHtml(user.email)}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-${this.getRoleBadgeColor(user.role)}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                    </td>
                    <td>
                        <small class="text-muted">${ST.utils.formatDate(user.created_at)}</small>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-success btn-sm" onclick="AdminModule.users.approveUser('${user.id}')" title="Approve">
                                <i class="bi bi-check"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="AdminModule.users.rejectUser('${user.id}')" title="Reject">
                                <i class="bi bi-x"></i>
                            </button>
                            <button class="btn btn-info btn-sm" onclick="AdminModule.users.viewUserDetails('${user.id}')" title="View Details">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    },
    
    /**
     * Get role badge color
     */
    getRoleBadgeColor: function(role) {
        const colors = {
            admin: 'success',
            lecturer: 'info',
            student: 'primary'
        };
        return colors[role] || 'secondary';
    },
    
    /**
     * Load recent activity
     */
    loadRecentActivity: async function() {
        try {
            const response = await ST.api.get('/admin/dashboard/recent-activity');
            if (response.success) {
                this.updateRecentActivity(response.activities);
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    },
    
    /**
     * Update recent activity timeline
     */
    updateRecentActivity: function(activities) {
        const timeline = document.getElementById('activityTimeline');
        if (!timeline) return;
        
        if (activities.length === 0) {
            timeline.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-clock fs-1"></i>
                    <p class="mt-2 mb-0">No recent activity</p>
                </div>
            `;
        } else {
            timeline.innerHTML = activities.map(activity => `
                <div class="timeline-item ${activity.type}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="fw-semibold mb-1">${ST.utils.sanitizeHtml(activity.title)}</h6>
                            <p class="text-muted mb-1">${ST.utils.sanitizeHtml(activity.description)}</p>
                            <small class="text-muted">${ST.utils.formatDate(activity.created_at)}</small>
                        </div>
                        <span class="badge bg-${this.getActivityBadgeColor(activity.type)}">${activity.type}</span>
                    </div>
                </div>
            `).join('');
        }
    },
    
    /**
     * Get activity badge color
     */
    getActivityBadgeColor: function(type) {
        const colors = {
            success: 'success',
            warning: 'warning',
            danger: 'danger',
            info: 'info'
        };
        return colors[type] || 'secondary';
    },
    
    /**
     * Initialize charts
     */
    initializeCharts: function() {
        this.initRegistrationChart();
        this.initUserDistributionChart();
    },
    
    /**
     * Initialize registration chart
     */
    initRegistrationChart: async function() {
        const canvas = document.getElementById('registrationChart');
        if (!canvas) return;
        
        try {
            const response = await ST.api.get('/admin/dashboard/registration-chart?period=week');
            if (response.success) {
                const ctx = canvas.getContext('2d');
                
                this.registrationChart = ST.charts.createLineChart(ctx, {
                    labels: response.labels,
                    datasets: [{
                        label: 'New Registrations',
                        data: response.data,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                });
            }
        } catch (error) {
            console.error('Failed to load registration chart:', error);
        }
    },
    
    /**
     * Initialize user distribution chart
     */
    initUserDistributionChart: async function() {
        const canvas = document.getElementById('userDistributionChart');
        if (!canvas) return;
        
        try {
            const response = await ST.api.get('/admin/dashboard/user-distribution');
            if (response.success) {
                const ctx = canvas.getContext('2d');
                
                this.userDistributionChart = ST.charts.createDoughnutChart(ctx, {
                    labels: ['Students', 'Lecturers', 'Admins'],
                    datasets: [{
                        data: [response.students, response.lecturers, response.admins],
                        backgroundColor: ['#0d6efd', '#0dcaf0', '#198754'],
                        borderWidth: 0
                    }]
                });
            }
        } catch (error) {
            console.error('Failed to load user distribution chart:', error);
        }
    },
    
    /**
     * Update registration chart period
     */
    updateRegistrationChart: async function(period) {
        try {
            const response = await ST.api.get(`/admin/dashboard/registration-chart?period=${period}`);
            if (response.success && this.registrationChart) {
                ST.charts.updateChart(this.registrationChart, {
                    labels: response.labels,
                    datasets: [{
                        label: 'New Registrations',
                        data: response.data,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                });
            }
        } catch (error) {
            console.error('Failed to update registration chart:', error);
        }
    },
    
    /**
     * Setup auto-refresh
     */
    setupAutoRefresh: function() {
        setInterval(() => {
            this.loadStatistics();
            this.loadPendingApprovals();
            this.loadRecentActivity();
        }, AdminModule.config.refreshInterval);
    },
    
    /**
     * Refresh dashboard manually
     */
    refresh: function() {
        this.loadStatistics();
        this.loadPendingApprovals();
        this.loadRecentActivity();
        ST.ui.showToast('Dashboard refreshed', 'success');
    }
};

// ===================================
// USER MANAGEMENT FUNCTIONS
// ===================================

AdminModule.users = {
    /**
     * Load all users
     */
    loadUsers: async function(filters = {}) {
        try {
            ST.ui.showLoading('Loading users...');
            
            const queryParams = new URLSearchParams(filters).toString();
            const response = await ST.api.get(`/admin/users?${queryParams}`);
            
            if (response.success) {
                this.updateUsersTable(response.users);
                this.updatePagination(response.pagination);
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            ST.ui.showToast('Failed to load users', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    },
    
    /**
     * Update users table
     */
    updateUsersTable: function(users) {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-people fs-1"></i>
                        <p class="mt-2 mb-0">No users found</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = users.map(user => `
                <tr data-user-id="${user.id}">
                    <td>
                        <div class="form-check">
                            <input class="form-check-input user-checkbox" type="checkbox" value="${user.id}">
                        </div>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar me-2">
                                <div class="bg-${AdminModule.dashboard.getRoleBadgeColor(user.role)} rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                    <i class="bi bi-person-fill text-white"></i>
                                </div>
                            </div>
                            <div>
                                <div class="fw-semibold">${ST.utils.sanitizeHtml(user.first_name)} ${ST.utils.sanitizeHtml(user.last_name)}</div>
                                <small class="text-muted">${ST.utils.sanitizeHtml(user.email)}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-${AdminModule.dashboard.getRoleBadgeColor(user.role)}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                    </td>
                    <td>
                        <span class="status-badge ${user.approval_status}">${user.approval_status.charAt(0).toUpperCase() + user.approval_status.slice(1)}</span>
                    </td>
                    <td>
                        <small class="text-muted">${ST.utils.formatDate(user.created_at)}</small>
                    </td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                Actions
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="AdminModule.users.viewUserDetails('${user.id}')">
                                    <i class="bi bi-eye me-2"></i>View Details
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminModule.users.editUser('${user.id}')">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </a></li>
                                ${user.approval_status === 'pending' ? `
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-success" href="#" onclick="AdminModule.users.approveUser('${user.id}')">
                                        <i class="bi bi-check me-2"></i>Approve
                                    </a></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="AdminModule.users.rejectUser('${user.id}')">
                                        <i class="bi bi-x me-2"></i>Reject
                                    </a></li>
                                ` : ''}
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="AdminModule.users.deleteUser('${user.id}')">
                                    <i class="bi bi-trash me-2"></i>Delete
                                </a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        // Update select all checkbox
        this.updateSelectAllCheckbox();
    },
    
    /**
     * Approve user
     */
    approveUser: async function(userId) {
        try {
            const confirmed = await ST.ui.confirm('Are you sure you want to approve this user?', 'Approve User');
            if (!confirmed) return;
            
            const response = await ST.api.post(`/admin/users/${userId}/approve`);
            if (response.success) {
                ST.ui.showToast('User approved successfully', 'success');
                this.loadUsers();
                AdminModule.dashboard.loadStatistics();
                AdminModule.dashboard.loadPendingApprovals();
            } else {
                ST.ui.showToast(response.message || 'Failed to approve user', 'error');
            }
        } catch (error) {
            console.error('Failed to approve user:', error);
            ST.ui.showToast('Failed to approve user', 'error');
        }
    },
    
    /**
     * Reject user
     */
    rejectUser: async function(userId) {
        try {
            const reason = prompt('Please provide a reason for rejection:');
            if (!reason) return;
            
            const response = await ST.api.post(`/admin/users/${userId}/reject`, { reason });
            if (response.success) {
                ST.ui.showToast('User rejected', 'warning');
                this.loadUsers();
                AdminModule.dashboard.loadStatistics();
                AdminModule.dashboard.loadPendingApprovals();
            } else {
                ST.ui.showToast(response.message || 'Failed to reject user', 'error');
            }
        } catch (error) {
            console.error('Failed to reject user:', error);
            ST.ui.showToast('Failed to reject user', 'error');
        }
    },
    
    /**
     * View user details
     */
    viewUserDetails: async function(userId) {
        try {
            const response = await ST.api.get(`/admin/users/${userId}`);
            if (response.success) {
                this.showUserDetailsModal(response.user);
            }
        } catch (error) {
            console.error('Failed to load user details:', error);
            ST.ui.showToast('Failed to load user details', 'error');
        }
    },
    
    /**
     * Show user details modal
     */
    showUserDetailsModal: function(user) {
        const modalHtml = `
            <div class="modal fade" id="userDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">User Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-4 text-center">
                                    <div class="user-avatar mb-3">
                                        <div class="bg-${AdminModule.dashboard.getRoleBadgeColor(user.role)} rounded-circle d-flex align-items-center justify-content-center mx-auto" style="width: 80px; height: 80px;">
                                            <i class="bi bi-person-fill text-white fs-1"></i>
                                        </div>
                                    </div>
                                    <h5>${ST.utils.sanitizeHtml(user.first_name)} ${ST.utils.sanitizeHtml(user.last_name)}</h5>
                                    <span class="badge bg-${AdminModule.dashboard.getRoleBadgeColor(user.role)} mb-2">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                                    <br>
                                    <span class="status-badge ${user.approval_status}">${user.approval_status.charAt(0).toUpperCase() + user.approval_status.slice(1)}</span>
                                </div>
                                <div class="col-md-8">
                                    <table class="table table-borderless">
                                        <tr>
                                            <td class="fw-semibold">Email:</td>
                                            <td>${ST.utils.sanitizeHtml(user.email)}</td>
                                        </tr>
                                        <tr>
                                            <td class="fw-semibold">Student ID:</td>
                                            <td>${user.student_id || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td class="fw-semibold">Department:</td>
                                            <td>${user.department || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td class="fw-semibold">Registered:</td>
                                            <td>${ST.utils.formatDate(user.created_at)}</td>
                                        </tr>
                                        <tr>
                                            <td class="fw-semibold">Last Login:</td>
                                            <td>${user.last_login ? ST.utils.formatDate(user.last_login) : 'Never'}</td>
                                        </tr>
                                        ${user.approved_by ? `
                                            <tr>
                                                <td class="fw-semibold">Approved By:</td>
                                                <td>${ST.utils.sanitizeHtml(user.approved_by_name)}</td>
                                            </tr>
                                            <tr>
                                                <td class="fw-semibold">Approved At:</td>
                                                <td>${ST.utils.formatDate(user.approved_at)}</td>
                                            </tr>
                                        ` : ''}
                                        ${user.rejection_reason ? `
                                            <tr>
                                                <td class="fw-semibold">Rejection Reason:</td>
                                                <td class="text-danger">${ST.utils.sanitizeHtml(user.rejection_reason)}</td>
                                            </tr>
                                        ` : ''}
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${user.approval_status === 'pending' ? `
                                <button type="button" class="btn btn-success" onclick="AdminModule.users.approveUser('${user.id}'); bootstrap.Modal.getInstance(document.getElementById('userDetailsModal')).hide();">
                                    <i class="bi bi-check me-1"></i>Approve
                                </button>
                                <button type="button" class="btn btn-danger" onclick="AdminModule.users.rejectUser('${user.id}'); bootstrap.Modal.getInstance(document.getElementById('userDetailsModal')).hide();">
                                    <i class="bi bi-x me-1"></i>Reject
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('userDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
        modal.show();
    },
    
    /**
     * Delete user
     */
    deleteUser: async function(userId) {
        try {
            const confirmed = await ST.ui.confirm(
                'Are you sure you want to delete this user? This action cannot be undone.',
                'Delete User'
            );
            if (!confirmed) return;
            
            const response = await ST.api.delete(`/admin/users/${userId}`);
            if (response.success) {
                ST.ui.showToast('User deleted successfully', 'success');
                this.loadUsers();
                AdminModule.dashboard.loadStatistics();
            } else {
                ST.ui.showToast(response.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
            ST.ui.showToast('Failed to delete user', 'error');
        }
    },
    
    /**
     * Bulk approve users
     */
    bulkApprove: async function() {
        const selectedUsers = this.getSelectedUsers();
        if (selectedUsers.length === 0) {
            ST.ui.showToast('Please select users to approve', 'warning');
            return;
        }
        
        try {
            const confirmed = await ST.ui.confirm(
                `Are you sure you want to approve ${selectedUsers.length} user(s)?`,
                'Bulk Approve'
            );
            if (!confirmed) return;
            
            const response = await ST.api.post('/admin/users/bulk-approve', {
                userIds: selectedUsers
            });
            
            if (response.success) {
                ST.ui.showToast(`${selectedUsers.length} user(s) approved successfully`, 'success');
                this.loadUsers();
                AdminModule.dashboard.loadStatistics();
                AdminModule.dashboard.loadPendingApprovals();
            } else {
                ST.ui.showToast(response.message || 'Failed to approve users', 'error');
            }
        } catch (error) {
            console.error('Failed to bulk approve users:', error);
            ST.ui.showToast('Failed to approve users', 'error');
        }
    },
    
    /**
     * Get selected users
     */
    getSelectedUsers: function() {
        const checkboxes = document.querySelectorAll('.user-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    },
    
    /**
     * Update select all checkbox
     */
    updateSelectAllCheckbox: function() {
        const selectAllCheckbox = document.getElementById('selectAllUsers');
        const userCheckboxes = document.querySelectorAll('.user-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
        
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = userCheckboxes.length > 0 && userCheckboxes.length === checkedCheckboxes.length;
            selectAllCheckbox.indeterminate = checkedCheckboxes.length > 0 && checkedCheckboxes.length < userCheckboxes.length;
        }
        
        // Update bulk action buttons
        const bulkActionButtons = document.querySelectorAll('.bulk-action-btn');
        bulkActionButtons.forEach(btn => {
            btn.disabled = checkedCheckboxes.length === 0;
        });
    },
    
    /**
     * Toggle all users selection
     */
    toggleAllUsers: function(checked) {
        const userCheckboxes = document.querySelectorAll('.user-checkbox');
        userCheckboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
        this.updateSelectAllCheckbox();
    },
    
    /**
     * Export users data
     */
    exportUsers: async function(format = 'csv') {
        try {
            ST.ui.showLoading('Preparing export...');
            
            const response = await fetch(`/admin/users/export?format=${format}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                ST.ui.showToast('Users exported successfully', 'success');
            } else {
                ST.ui.showToast('Failed to export users', 'error');
            }
        } catch (error) {
            console.error('Failed to export users:', error);
            ST.ui.showToast('Failed to export users', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    }
};

// ===================================
// COURSE MANAGEMENT FUNCTIONS
// ===================================

AdminModule.courses = {
    /**
     * Load all courses
     */
    loadCourses: async function(filters = {}) {
        try {
            ST.ui.showLoading('Loading courses...');
            
            const queryParams = new URLSearchParams(filters).toString();
            const response = await ST.api.get(`/admin/courses?${queryParams}`);
            
            if (response.success) {
                this.updateCoursesTable(response.courses);
            }
        } catch (error) {
            console.error('Failed to load courses:', error);
            ST.ui.showToast('Failed to load courses', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    },
    
    /**
     * Update courses table
     */
    updateCoursesTable: function(courses) {
        const tbody = document.querySelector('#coursesTable tbody');
        if (!tbody) return;
        
        if (courses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-book fs-1"></i>
                        <p class="mt-2 mb-0">No courses found</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = courses.map(course => `
                <tr data-course-id="${course.id}">
                    <td>
                        <div class="fw-semibold">${ST.utils.sanitizeHtml(course.name)}</div>
                        <small class="text-muted">${ST.utils.sanitizeHtml(course.code)}</small>
                    </td>
                    <td>${ST.utils.sanitizeHtml(course.department)}</td>
                    <td>
                        <span class="badge bg-${course.is_active ? 'success' : 'secondary'}">
                            ${course.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${course.student_count || 0}</td>
                    <td>${course.assessment_count || 0}</td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                Actions
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="/admin/courses/${course.id}">
                                    <i class="bi bi-eye me-2"></i>View Details
                                </a></li>
                                <li><a class="dropdown-item" href="/admin/courses/${course.id}/edit">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminModule.courses.toggleCourseStatus('${course.id}', ${!course.is_active})">
                                    <i class="bi bi-${course.is_active ? 'pause' : 'play'} me-2"></i>${course.is_active ? 'Deactivate' : 'Activate'}
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="AdminModule.courses.deleteCourse('${course.id}')">
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
     * Toggle course status
     */
    toggleCourseStatus: async function(courseId, activate) {
        try {
            const action = activate ? 'activate' : 'deactivate';
            const confirmed = await ST.ui.confirm(
                `Are you sure you want to ${action} this course?`,
                `${action.charAt(0).toUpperCase() + action.slice(1)} Course`
            );
            if (!confirmed) return;
            
            const response = await ST.api.put(`/admin/courses/${courseId}/status`, {
                is_active: activate
            });
            
            if (response.success) {
                ST.ui.showToast(`Course ${action}d successfully`, 'success');
                this.loadCourses();
            } else {
                ST.ui.showToast(response.message || `Failed to ${action} course`, 'error');
            }
        } catch (error) {
            console.error('Failed to toggle course status:', error);
            ST.ui.showToast('Failed to update course status', 'error');
        }
    },
    
    /**
     * Delete course
     */
    deleteCourse: async function(courseId) {
        try {
            const confirmed = await ST.ui.confirm(
                'Are you sure you want to delete this course? This action cannot be undone and will remove all associated assessments and results.',
                'Delete Course'
            );
            if (!confirmed) return;
            
            const response = await ST.api.delete(`/admin/courses/${courseId}`);
            if (response.success) {
                ST.ui.showToast('Course deleted successfully', 'success');
                this.loadCourses();
                AdminModule.dashboard.loadStatistics();
            } else {
                ST.ui.showToast(response.message || 'Failed to delete course', 'error');
            }
        } catch (error) {
            console.error('Failed to delete course:', error);
            ST.ui.showToast('Failed to delete course', 'error');
        }
    }
};

// ===================================
// REPORTS AND ANALYTICS
// ===================================

AdminModule.reports = {
    /**
     * Generate system report
     */
    generateSystemReport: async function(type, dateRange) {
        try {
            ST.ui.showLoading('Generating report...');
            
            const response = await ST.api.post('/admin/reports/generate', {
                type: type,
                dateRange: dateRange
            });
            
            if (response.success) {
                this.downloadReport(response.reportUrl, response.filename);
                ST.ui.showToast('Report generated successfully', 'success');
            } else {
                ST.ui.showToast(response.message || 'Failed to generate report', 'error');
            }
        } catch (error) {
            console.error('Failed to generate report:', error);
            ST.ui.showToast('Failed to generate report', 'error');
        } finally {
            ST.ui.hideLoading();
        }
    },
    
    /**
     * Download report
     */
    downloadReport: function(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

// ===================================
// SYSTEM MANAGEMENT
// ===================================

AdminModule.system = {
    /**
     * Get system status
     */
    getSystemStatus: async function() {
        try {
            const response = await ST.api.get('/admin/system/status');
            if (response.success) {
                this.updateSystemStatus(response.status);
            }
        } catch (error) {
            console.error('Failed to get system status:', error);
        }
    },
    
    /**
     * Update system status display
     */
    updateSystemStatus: function(status) {
        // Update system status indicators
        Object.keys(status).forEach(service => {
            const indicator = document.querySelector(`[data-service="${service}"]`);
            if (indicator) {
                const statusClass = status[service] ? 'success' : 'danger';
                indicator.className = `status-indicator bg-${statusClass} rounded-circle me-2`;
            }
        });
    },
    
    /**
     * Clear system cache
     */
    clearCache: async function() {
        try {
            const confirmed = await ST.ui.confirm(
                'Are you sure you want to clear the system cache?',
                'Clear Cache'
            );
            if (!confirmed) return;
            
            const response = await ST.api.post('/admin/system/clear-cache');
            if (response.success) {
                ST.ui.showToast('Cache cleared successfully', 'success');
            } else {
                ST.ui.showToast('Failed to clear cache', 'error');
            }
        } catch (error) {
            console.error('Failed to clear cache:', error);
            ST.ui.showToast('Failed to clear cache', 'error');
        }
    }
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize admin module based on current page
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('/admin/dashboard')) {
        AdminModule.dashboard.init();
    } else if (currentPage.includes('/admin/users')) {
        AdminModule.users.loadUsers();
        
        // Setup user management event listeners
        const selectAllCheckbox = document.getElementById('selectAllUsers');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                AdminModule.users.toggleAllUsers(this.checked);
            });
        }
        
        // Setup user checkbox change listeners
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('user-checkbox')) {
                AdminModule.users.updateSelectAllCheckbox();
            }
        });
        
        // Setup search functionality
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', ST.utils.debounce(function() {
                AdminModule.users.loadUsers({ search: this.value });
            }, 300));
        }
        
        // Setup filter functionality
        const filterSelects = document.querySelectorAll('.user-filter');
        filterSelects.forEach(select => {
            select.addEventListener('change', function() {
                const filters = {};
                filterSelects.forEach(s => {
                    if (s.value) filters[s.name] = s.value;
                });
                AdminModule.users.loadUsers(filters);
            });
        });
        
    } else if (currentPage.includes('/admin/courses')) {
        AdminModule.courses.loadCourses();
        
        // Setup course search functionality
        const searchInput = document.getElementById('courseSearch');
        if (searchInput) {
            searchInput.addEventListener('input', ST.utils.debounce(function() {
                AdminModule.courses.loadCourses({ search: this.value });
            }, 300));
        }
    }
    
    // Setup chart period change handlers for dashboard
    document.querySelectorAll('input[name="chartPeriod"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked && AdminModule.dashboard.updateRegistrationChart) {
                AdminModule.dashboard.updateRegistrationChart(this.id);
            }
        });
    });
    
    console.log('Admin module initialized successfully');
});

// Export for global access
window.Admin = AdminModule;



// ===================================
// EXPORT FUNCTIONS
// ===================================

AdminModule.export = {
    /**
     * Export data based on type
     */
    exportData: function(type) {
        let url = `/admin/export?type=${type}`;
        
        // Add filters based on type if needed
        if (type === 'users') {
            const roleFilter = document.getElementById('userRoleFilter')?.value;
            const statusFilter = document.getElementById('userStatusFilter')?.value;
            if (roleFilter && roleFilter !== 'all') url += `&role=${roleFilter}`;
            if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`;
        } else if (type === 'assessments' || type === 'results') {
            const courseFilter = document.getElementById('courseFilter')?.value;
            const academicYearFilter = document.getElementById('academicYearFilter')?.value;
            const semesterFilter = document.getElementById('semesterFilter')?.value;
            if (courseFilter) url += `&courseId=${courseFilter}`;
            if (academicYearFilter) url += `&academicYear=${academicYearFilter}`;
            if (semesterFilter) url += `&semester=${semesterFilter}`;
        }

        window.location.href = url;
        ST.ui.showToast(`Exporting ${type} data...`, 'info');
    }
};



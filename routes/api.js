const express = require('express');
const { dbHelpers } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get user statistics (for admin dashboard)
router.get('/stats/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const users = await dbHelpers.getAllUsers();
    const pendingUsers = await dbHelpers.getPendingUsers();

    const stats = {
      total: users.length,
      pending: pendingUsers.length,
      approved: users.filter(u => u.approval_status === 'approved').length,
      rejected: users.filter(u => u.approval_status === 'rejected').length,
      students: users.filter(u => u.role === 'student').length,
      lecturers: users.filter(u => u.role === 'lecturer').length,
      admins: users.filter(u => u.role === 'admin').length,
      active: users.filter(u => u.is_active).length,
      inactive: users.filter(u => !u.is_active).length
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('User stats API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user statistics' });
  }
});

// Get course statistics
router.get('/stats/courses', requireAuth, requireRole(['admin', 'lecturer']), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    let courses;
    if (userRole === 'admin') {
      courses = await dbHelpers.getAllCourses();
    } else {
      courses = await dbHelpers.getAllCourses().then(allCourses => 
        allCourses.filter(course => course.lecturer_id === userId)
      );
    }

    const stats = {
      total: courses.length,
      active: courses.filter(c => c.is_active).length,
      inactive: courses.filter(c => !c.is_active).length
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Course stats API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch course statistics' });
  }
});

// Get assessment statistics
router.get('/stats/assessments', requireAuth, requireRole(['admin', 'lecturer']), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    let assessments;
    if (userRole === 'admin') {
      // For admin, we'd need a function to get all assessments
      assessments = [];
    } else {
      assessments = await dbHelpers.getAssessmentsByLecturer(userId);
    }

    const stats = {
      total: assessments.length,
      published: assessments.filter(a => a.is_published).length,
      draft: assessments.filter(a => !a.is_published).length,
      byType: {
        quiz: assessments.filter(a => a.type === 'quiz').length,
        assignment: assessments.filter(a => a.type === 'assignment').length,
        exam: assessments.filter(a => a.type === 'exam').length,
        project: assessments.filter(a => a.type === 'project').length,
        presentation: assessments.filter(a => a.type === 'presentation').length
      }
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Assessment stats API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assessment statistics' });
  }
});

// Get student performance data
router.get('/stats/performance/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const currentUserId = req.session.user.id;
    const userRole = req.session.user.role;

    // Check permissions
    if (userRole === 'student' && currentUserId !== studentId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const results = await dbHelpers.getResultsByStudent(studentId);

    // Prepare performance data
    const performanceData = {
      overall: {
        totalAssessments: results.length,
        averageScore: results.length > 0 ? 
          (results.reduce((sum, r) => sum + parseFloat(r.percentage || 0), 0) / results.length).toFixed(2) : 0,
        highestScore: results.length > 0 ? Math.max(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0,
        lowestScore: results.length > 0 ? Math.min(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0
      },
      byCourse: {},
      byAssessmentType: {},
      timeline: []
    };

    // Process results
    results.forEach(result => {
      const courseName = result.course?.name || 'Unknown Course';
      const assessmentType = result.assessment?.type || 'unknown';
      const percentage = parseFloat(result.percentage || 0);
      const date = new Date(result.created_at);

      // By course
      if (!performanceData.byCourse[courseName]) {
        performanceData.byCourse[courseName] = { scores: [], average: 0, count: 0 };
      }
      performanceData.byCourse[courseName].scores.push(percentage);
      performanceData.byCourse[courseName].count++;

      // By assessment type
      if (!performanceData.byAssessmentType[assessmentType]) {
        performanceData.byAssessmentType[assessmentType] = { scores: [], average: 0, count: 0 };
      }
      performanceData.byAssessmentType[assessmentType].scores.push(percentage);
      performanceData.byAssessmentType[assessmentType].count++;

      // Timeline
      performanceData.timeline.push({
        date: date.toISOString().split('T')[0],
        score: percentage,
        course: courseName,
        assessment: result.assessment?.title || 'Unknown Assessment'
      });
    });

    // Calculate averages
    Object.keys(performanceData.byCourse).forEach(course => {
      const data = performanceData.byCourse[course];
      data.average = (data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length).toFixed(2);
    });

    Object.keys(performanceData.byAssessmentType).forEach(type => {
      const data = performanceData.byAssessmentType[type];
      data.average = (data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length).toFixed(2);
    });

    // Sort timeline
    performanceData.timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ success: true, data: performanceData });
  } catch (error) {
    console.error('Performance stats API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch performance data' });
  }
});

// Get course enrollments
router.get('/courses/:courseId/enrollments', requireAuth, requireRole(['admin', 'lecturer']), async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Check course access
    if (userRole === 'lecturer') {
      const course = await dbHelpers.getCourseById(courseId);
      if (!course || course.lecturer_id !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const enrollments = await dbHelpers.getCourseEnrollments(courseId);
    res.json({ success: true, enrollments });
  } catch (error) {
    console.error('Course enrollments API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch course enrollments' });
  }
});

// Get assessment results summary
router.get('/assessments/:assessmentId/results-summary', requireAuth, requireRole(['admin', 'lecturer']), async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Check assessment access
    if (userRole === 'lecturer') {
      const assessment = await dbHelpers.getAssessmentById(assessmentId);
      if (!assessment || assessment.lecturer_id !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const results = await dbHelpers.getResultsByAssessment(assessmentId);
    const assessment = await dbHelpers.getAssessmentById(assessmentId);

    const summary = {
      totalSubmissions: results.length,
      averageScore: results.length > 0 ? 
        (results.reduce((sum, r) => sum + parseFloat(r.percentage || 0), 0) / results.length).toFixed(2) : 0,
      highestScore: results.length > 0 ? Math.max(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0,
      lowestScore: results.length > 0 ? Math.min(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0,
      passRate: results.length > 0 ? 
        ((results.filter(r => parseFloat(r.percentage || 0) >= assessment.passing_marks).length / results.length) * 100).toFixed(2) : 0,
      gradeDistribution: {
        A: results.filter(r => parseFloat(r.percentage || 0) >= 90).length,
        B: results.filter(r => parseFloat(r.percentage || 0) >= 80 && parseFloat(r.percentage || 0) < 90).length,
        C: results.filter(r => parseFloat(r.percentage || 0) >= 70 && parseFloat(r.percentage || 0) < 80).length,
        D: results.filter(r => parseFloat(r.percentage || 0) >= 60 && parseFloat(r.percentage || 0) < 70).length,
        F: results.filter(r => parseFloat(r.percentage || 0) < 60).length
      }
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Assessment results summary API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assessment results summary' });
  }
});

// Search users (for admin)
router.get('/search/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { q, role, status } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, users: [] });
    }

    let users = await dbHelpers.getAllUsers();

    // Apply search filter
    const searchLower = q.toLowerCase();
    users = users.filter(user => 
      user.first_name.toLowerCase().includes(searchLower) ||
      user.last_name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      (user.student_id && user.student_id.toLowerCase().includes(searchLower))
    );

    // Apply additional filters
    if (role && role !== 'all') {
      users = users.filter(user => user.role === role);
    }

    if (status && status !== 'all') {
      users = users.filter(user => user.approval_status === status);
    }

    // Limit results
    users = users.slice(0, 20);

    // Remove sensitive data
    const safeUsers = users.map(user => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      student_id: user.student_id,
      approval_status: user.approval_status,
      is_active: user.is_active,
      created_at: user.created_at
    }));

    res.json({ success: true, users: safeUsers });
  } catch (error) {
    console.error('Search users API error:', error);
    res.status(500).json({ success: false, error: 'Failed to search users' });
  }
});

// Get system health status
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Validate student ID availability
router.post('/validate/student-id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { studentId } = req.body;
    
    if (!studentId) {
      return res.json({ success: false, error: 'Student ID is required' });
    }

    const existingUser = await dbHelpers.getAllUsers().then(users => 
      users.find(user => user.student_id === studentId)
    );

    res.json({ 
      success: true, 
      available: !existingUser,
      message: existingUser ? 'Student ID already exists' : 'Student ID is available'
    });
  } catch (error) {
    console.error('Validate student ID API error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate student ID' });
  }
});

// Validate email availability
router.post('/validate/email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.json({ success: false, error: 'Email is required' });
    }

    const existingUser = await dbHelpers.getUserByEmail(email);

    res.json({ 
      success: true, 
      available: !existingUser,
      message: existingUser ? 'Email already exists' : 'Email is available'
    });
  } catch (error) {
    console.error('Validate email API error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate email' });
  }
});

// Get dashboard notifications
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const notifications = [];

    if (userRole === 'admin') {
      // Admin notifications
      const pendingUsers = await dbHelpers.getPendingUsers();
      if (pendingUsers.length > 0) {
        notifications.push({
          type: 'info',
          title: 'Pending Approvals',
          message: `${pendingUsers.length} user(s) waiting for approval`,
          link: '/admin/pending-approvals',
          count: pendingUsers.length
        });
      }
    } else if (userRole === 'lecturer') {
      // Lecturer notifications
      const assessments = await dbHelpers.getAssessmentsByLecturer(userId);
      const draftAssessments = assessments.filter(a => !a.is_published);
      
      if (draftAssessments.length > 0) {
        notifications.push({
          type: 'warning',
          title: 'Draft Assessments',
          message: `${draftAssessments.length} assessment(s) not yet published`,
          link: '/lecturer/assessments',
          count: draftAssessments.length
        });
      }
    } else if (userRole === 'student') {
      // Student notifications
      const results = await dbHelpers.getResultsByStudent(userId);
      const recentResults = results.filter(r => {
        const resultDate = new Date(r.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return resultDate > weekAgo;
      });

      if (recentResults.length > 0) {
        notifications.push({
          type: 'success',
          title: 'New Results',
          message: `${recentResults.length} new result(s) available`,
          link: '/student/results',
          count: recentResults.length
        });
      }
    }

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Notifications API error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

module.exports = router;



// Admin Settings API
router.get("/admin/settings", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    // In a real application, you would fetch these from a database or config file
    // For now, we'll use dummy data or environment variables
    const settings = {
      appName: process.env.APP_NAME || "Student Assessment Tracker",
      registrationOpen: process.env.REGISTRATION_OPEN === "true",
      smtpHost: process.env.SMTP_HOST || "",
      smtpPort: process.env.SMTP_PORT || "",
      smtpUser: process.env.SMTP_USER || "",
      smtpPass: process.env.SMTP_PASS || "",
    };
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error fetching admin settings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
});

router.post("/admin/settings/general", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { appName, registrationOpen } = req.body;
    // In a real application, you would save these to a database or update environment variables
    // For demonstration, we'll just log them
    console.log("Updating general settings:", { appName, registrationOpen });
    // Update environment variables (this is not persistent across restarts without a proper config management system)
    process.env.APP_NAME = appName;
    process.env.REGISTRATION_OPEN = registrationOpen ? "true" : "false";
    res.json({ success: true, message: "General settings updated" });
  } catch (error) {
    console.error("Error updating general settings:", error);
    res.status(500).json({ success: false, message: "Failed to update general settings" });
  }
});

router.post("/admin/settings/email", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;
    // In a real application, you would save these to a database or update environment variables
    console.log("Updating email settings:", { smtpHost, smtpPort, smtpUser: smtpUser ? "*****" : "", smtpPass: smtpPass ? "*****" : "" });
    // Update environment variables
    process.env.SMTP_HOST = smtpHost;
    process.env.SMTP_PORT = smtpPort;
    process.env.SMTP_USER = smtpUser;
    process.env.SMTP_PASS = smtpPass;
    res.json({ success: true, message: "Email settings updated" });
  } catch (error) {
    console.error("Error updating email settings:", error);
    res.status(500).json({ success: false, message: "Failed to update email settings" });
  }
});



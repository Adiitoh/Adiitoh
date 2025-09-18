const bcrypt = require('bcryptjs');
const { dbHelpers } = require('../config/database');

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.flash('error', 'Please log in to access this page');
    return res.redirect('/auth/login');
  }

  // Check if user is approved (except for admins who are auto-approved)
  if (req.session.user.role !== 'admin' && req.session.user.approval_status !== 'approved') {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ error: 'Account pending approval' });
    }
    req.flash('error', 'Your account is pending approval. Please wait for admin approval.');
    return res.redirect('/auth/pending-approval');
  }

  next();
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.flash('error', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    // Check if user is approved (except for admins who are auto-approved)
    if (req.session.user.role !== 'admin' && req.session.user.approval_status !== 'approved') {
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ error: 'Account pending approval' });
      }
      req.flash('error', 'Your account is pending approval. Please wait for admin approval.');
      return res.redirect('/auth/pending-approval');
    }

    if (!roles.includes(req.session.user.role)) {
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ error: 'Access denied' });
      }
      req.flash('error', 'You do not have permission to access this page');
      return res.redirect('/');
    }

    next();
  };
};

// Check if user is guest (not logged in)
const requireGuest = (req, res, next) => {
  if (req.session.user) {
    console.log('requireGuest: User already logged in, redirecting to home');
    return res.redirect('/');
  }
  next();
};

// Password validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Account lockout middleware
const checkAccountLockout = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next();
  }

  try {
    const user = await dbHelpers.getUserByEmail(email);
    
    if (user && user.locked_until && new Date() < new Date(user.locked_until)) {
      const lockoutTime = Math.ceil((new Date(user.locked_until) - new Date()) / (1000 * 60));
      req.flash('error', `Account is locked. Please try again in ${lockoutTime} minutes.`);
      return res.redirect('/auth/login');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error checking account lockout:', error);
    next();
  }
};

// Handle failed login attempts
const handleFailedLogin = async (userId) => {
  try {
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 15; // minutes

    const user = await dbHelpers.getUserById(userId);
    const loginAttempts = (user.login_attempts || 0) + 1;

    let updates = { login_attempts: loginAttempts };

    if (loginAttempts >= maxAttempts) {
      const lockoutUntil = new Date();
      lockoutUntil.setMinutes(lockoutUntil.getMinutes() + lockoutTime);
      updates.locked_until = lockoutUntil.toISOString();
    }

    await dbHelpers.updateUser(userId, updates);
  } catch (error) {
    console.error('Error handling failed login:', error);
  }
};

// Handle successful login
const handleSuccessfulLogin = async (userId) => {
  try {
    await dbHelpers.updateUser(userId, {
      login_attempts: 0,
      locked_until: null,
      last_login: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling successful login:', error);
  }
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate student ID
const generateStudentId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `STU${year}${random}`;
};

// Sanitize user data for session
const sanitizeUserForSession = (user) => {
  const { password_hash, login_attempts, locked_until, ...sanitizedUser } = user;
  return sanitizedUser;
};

// Check if user owns resource
const checkResourceOwnership = (resourceUserId) => {
  return (req, res, next) => {
    const currentUserId = req.session.user.id;
    const userRole = req.session.user.role;

    // Admins can access any resource
    if (userRole === 'admin') {
      return next();
    }

    // Users can only access their own resources
    if (currentUserId === resourceUserId) {
      return next();
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.flash('error', 'You can only access your own resources');
    return res.redirect('/');
  };
};

// Middleware to check if lecturer owns course
const checkCourseOwnership = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.courseId;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Admins can access any course
    if (userRole === 'admin') {
      return next();
    }

    if (userRole === 'lecturer') {
      const course = await dbHelpers.getCourseById(courseId);
      if (course && course.lecturer_id === userId) {
        return next();
      }
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.flash('error', 'You can only access your own courses');
    return res.redirect('/');
  } catch (error) {
    console.error('Error checking course ownership:', error);
    next(error);
  }
};

// Middleware to check if student is enrolled in course
const checkEnrollment = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.courseId;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Admins and lecturers can access any course
    if (['admin', 'lecturer'].includes(userRole)) {
      return next();
    }

    if (userRole === 'student') {
      const enrollments = await dbHelpers.getStudentEnrollments(userId);
      const isEnrolled = enrollments.some(enrollment => 
        enrollment.course_id === courseId && enrollment.status === 'active'
      );

      if (isEnrolled) {
        return next();
      }
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.flash('error', 'You must be enrolled in this course to access it');
    return res.redirect('/');
  } catch (error) {
    console.error('Error checking enrollment:', error);
    next(error);
  }
};

module.exports = {
  requireAuth,
  requireRole,
  requireGuest,
  validatePassword,
  hashPassword,
  comparePassword,
  checkAccountLockout,
  handleFailedLogin,
  handleSuccessfulLogin,
  validateEmail,
  generateStudentId,
  sanitizeUserForSession,
  checkResourceOwnership,
  checkCourseOwnership,
  checkEnrollment
};


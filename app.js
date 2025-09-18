const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const flash = require('express-flash');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import middleware
const { requireAuth, requireRole } = require('./middleware/auth');
const { auditLogger } = require('./middleware/audit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://cdn.plot.ly"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 4000, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);
app.use('/auth', authLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    ['https://yourdomain.com'] : 
    ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'sessionId'
}));

// Flash messages
app.use(flash());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global variables for templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = req.flash();
  res.locals.currentPath = req.path;
  res.locals.appName = process.env.APP_NAME || 'Student Assessment Tracker';
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// Audit logging middleware
app.use(auditLogger);

// Routes
const authRouter = express.Router();
const adminRouter = express.Router();
const studentRouter = express.Router();
const lecturerRouter = express.Router();
const apiRouter = express.Router();

app.use('/auth', authRouter);
app.use('/admin', requireAuth, requireRole(['admin']), adminRouter);
app.use('/student', requireAuth, requireRole(['student']), studentRouter);
app.use('/lecturer', requireAuth, requireRole(['lecturer']), lecturerRouter);
app.use('/api', apiRouter);

// Home route
app.get('/', (req, res) => {
  console.log('Home route - Session user:', req.session.user ? 'Present' : 'Not present');
  if (req.session.user) {
    console.log('User role:', req.session.user.role, 'Status:', req.session.user.approval_status);
    // Redirect based on user role
    switch (req.session.user.role) {
      case 'admin':
        return res.redirect('/admin/dashboard');
      case 'lecturer':
        return res.redirect('/lecturer/dashboard');
      case 'student':
        return res.redirect('/student/dashboard');
      default:
        return res.redirect('/auth/login');
    }
  }
  res.render('index', { 
    title: 'Welcome to Student Assessment Tracker',
    showNavbar: false 
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    error: {
      status: 404,
      message: 'The page you are looking for does not exist.'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).render('error', {
    title: 'Error',
    error: {
      status: err.status || 500,
      message: isDevelopment ? err.message : 'Something went wrong!',
      stack: isDevelopment ? err.stack : null
    }
  });
});


// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Student Assessment Tracker is running on port ${PORT}`);
  });
}

module.exports = app;



const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('./config/database');

// Test database connection on startup
console.log('Testing database connection...');
dbHelpers.getAllUsers().then(users => {
  console.log('Database connection successful. Found', users.length, 'users');
}).catch(err => {
  console.error('Database connection failed:', err.message);
});
const { 
  requireGuest, 
  validatePassword, 
  hashPassword, 
  comparePassword,
  checkAccountLockout,
  handleFailedLogin,
  handleSuccessfulLogin,
  validateEmail,
  generateStudentId,
  sanitizeUserForSession
} = require('./middleware/auth');
const { logAuthEvent, logAuditEvent, logExportEvent, getAuditLogs } = require('./middleware/audit');

// Login page
authRouter.get('/login', requireGuest, (req, res) => {
  res.render('login', { 
    title: 'Login',
    showNavbar: false 
  });
});

// Login POST
authRouter.post('/login', [
  requireGuest,
  checkAccountLockout,
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', req.body.email);
    console.log('Password length:', req.body.password ? req.body.password.length : 0);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/login');
    }

    const { email, password } = req.body;

    // Get user from database
    console.log('Looking up user in database...');
    const user = await dbHelpers.getUserByEmail(email);
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('User not found in database');
      await logAuthEvent(email, 'login', false, req, 'User not found');
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    
    console.log('User details:', {
      id: user.id,
      email: user.email,
      role: user.role,
      approval_status: user.approval_status,
      is_active: user.is_active
    });

    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const lockoutTime = Math.ceil((new Date(user.locked_until) - new Date()) / (1000 * 60));
      await logAuthEvent(email, 'login', false, req, 'Account locked');
      req.flash('error', `Account is locked. Please try again in ${lockoutTime} minutes.`);
      return res.redirect('/auth/login');
    }

    // Verify password
    console.log('Verifying password...');
    const isValidPassword = await comparePassword(password, user.password_hash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Password verification failed');
      await handleFailedLogin(user.id);
      await logAuthEvent(email, 'login', false, req, 'Invalid password');
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    // Check if user is active
    if (!user.is_active) {
      await logAuthEvent(email, 'login', false, req, 'Account deactivated');
      req.flash('error', 'Your account has been deactivated. Please contact the administrator.');
      return res.redirect('/auth/login');
    }

    // Handle successful login
    console.log('Login successful! Processing...');
    await handleSuccessfulLogin(user.id);
    await logAuthEvent(email, 'login', true, req);

    // Store user in session
    console.log('Storing user in session...');
    req.session.user = sanitizeUserForSession(user);
    console.log('Session user set:', req.session.user ? 'Yes' : 'No');
    
    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', 'Session error occurred. Please try again.');
        return res.redirect('/auth/login');
      }
      
      console.log('User logged in successfully:', user.email, 'Role:', user.role, 'Status:', user.approval_status);
      
      // Redirect based on approval status and role
      if (user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      } else if (user.approval_status === 'approved') {
        switch (user.role) {
          case 'lecturer':
            return res.redirect('/lecturer/dashboard');
          case 'student':
            return res.redirect('/student/dashboard');
          default:
            return res.redirect('/');
        }
      } else if (user.approval_status === 'pending') {
        return res.redirect('/auth/pending-approval');
      } else if (user.approval_status === 'rejected') {
        req.flash('error', `Your account has been rejected. Reason: ${user.rejection_reason || 'No reason provided'}`);
        return res.redirect('/auth/login');
      }

      res.redirect('/');
    });
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An error occurred during login. Please try again.');
    res.redirect('/auth/login');
  }
});

// Registration page
authRouter.get('/register', requireGuest, (req, res) => {
  res.render('register', { 
    title: 'Register',
    showNavbar: false 
  });
});

// Registration POST
authRouter.post('/register', [
  requireGuest,
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }
    return true;
  }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('firstName').trim().isLength({ min: 4 }).withMessage('First name must be at least 4 characters'),
  body('lastName').trim().isLength({ min: 4 }).withMessage('Last name must be at least 4 characters'),
  body('role').isIn(['student', 'lecturer']).withMessage('Please select a valid role'),
  body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please enter a valid date'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Please select a valid gender')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/register');
    }

    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      role, 
      phone, 
      dateOfBirth, 
      gender, 
      address 
    } = req.body;

    // Check if user already exists
    const existingUser = await dbHelpers.getUserByEmail(email);
    if (existingUser) {
      req.flash('error', 'An account with this email already exists');
      return res.redirect('/auth/register');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Prepare user data
    const userData = {
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role,
      phone: phone || null,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      address: address || null,
      approval_status: 'pending' // All new users need approval except admin
    };

    // Generate student ID for students
    if (role === 'student') {
      userData.student_id = generateStudentId();
    }

    // Create user
    const newUser = await dbHelpers.createUser(userData);

    // Create a notification for the admin
    await dbHelpers.createNotification({
      user_id: null, // For all admins
      type: 'new_user_pending',
      title: 'New User Registration',
      message: `A new user (${newUser.first_name} ${newUser.last_name}) has registered and is awaiting approval.`,
      link: '/admin/pending-approvals'
    });

    await logAuditEvent(newUser.id, 'USER_REGISTERED', 'users', newUser.id, null, userData, req);

    req.flash('success', 'Registration successful! Your account is pending approval. You will be notified once approved.');
    res.redirect('/auth/pending-approval');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'An error occurred during registration. Please try again.');
    res.redirect('/auth/register');
  }
});

// Pending approval page
authRouter.get('/pending-approval', requireGuest, (req, res) => {
  // If user is in session and pending, show their specific info
  if (req.session.user && req.session.user.approval_status === 'pending') {
    return res.render('pending-approval', {
      title: 'Pending Approval',
      user: req.session.user,
      showNavbar: false,
    });
  }
  // If no user in session or not pending, show generic pending page
  res.render('/pending-approval', {
    title: 'Pending Approval',
    user: null,
    showNavbar: false,
  });
});

// Logout
authRouter.post('/logout', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    await logAuditEvent(userId, 'USER_LOGOUT', 'users', userId, null, null, req);
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.clearCookie('sessionId');
      res.redirect('/');
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/');
  }
});

// Forgot password page
authRouter.get('/forgot-password', requireGuest, (req, res) => {
  res.render('forgot-password', { 
    title: 'Forgot Password',
    showNavbar: false 
  });
});

// Forgot password POST
authRouter.post('/forgot-password', [
  requireGuest,
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/forgot-password');
    }

    const { email } = req.body;

    // Check if user exists
    const user = await dbHelpers.getUserByEmail(email);
    
    // Always show success message for security (don't reveal if email exists)
    req.flash('success', 'If an account with this email exists, password reset instructions have been sent.');
    
    if (user) {
      // TODO: Implement email sending functionality
      // For now, just log the event
      await logAuditEvent(user.id, 'PASSWORD_RESET_REQUESTED', 'users', user.id, null, { email }, req);
    }

    res.redirect('/auth/login');
  } catch (error) {
    console.error('Forgot password error:', error);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/auth/forgot-password');
  }
});

// Profile update
authRouter.get('/profile', requireAuth, (req, res) => {
  res.render('profile', { 
    title: 'My Profile',
    user: req.session.user 
  });
});

// Profile update POST
authRouter.post('/profile', [
  requireAuth,
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please enter a valid date'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Please select a valid gender')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/profile');
    }

    const { firstName, lastName, phone, dateOfBirth, gender, address } = req.body;
    const userId = req.session.user.id;

    const updates = {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      address: address || null
    };

    const updatedUser = await dbHelpers.updateUser(userId, updates);
    
    // Update session
    req.session.user = sanitizeUserForSession(updatedUser);

    await logAuditEvent(userId, 'PROFILE_UPDATED', 'users', userId, null, updates, req);

    req.flash('success', 'Profile updated successfully');
    res.redirect('/auth/profile');
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error', 'An error occurred while updating your profile. Please try again.');
    res.redirect('/auth/profile');
  }
});

// Change password
authRouter.post('/change-password', [
  requireAuth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }
    return true;
  }),
  body('confirmNewPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('New passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/profile');
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    // Get current user data
    const user = await dbHelpers.getUserById(userId);
    
    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/auth/profile');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await dbHelpers.updateUser(userId, { password_hash: newPasswordHash });

    await logAuditEvent(userId, 'PASSWORD_CHANGED', 'users', userId, null, null, req);

    req.flash('success', 'Password changed successfully');
    res.redirect('/auth/profile');
  } catch (error) {
    console.error('Change password error:', error);
    req.flash('error', 'An error occurred while changing your password. Please try again.');
    res.redirect('/auth/profile');
  }
});

// Admin Dashboard
adminRouter.get("/dashboard", async (req, res) => {
  try {
    // Get statistics
    const [allUsers, pendingUsers, allCourses, allAssessments] = await Promise.all([
      dbHelpers.getAllUsers(),
      dbHelpers.getPendingUsers(),
      dbHelpers.getAllCourses(),
      dbHelpers.getAssessmentsByLecturer() // This will need to be modified to get all assessments
    ]);

    const stats = {
      totalUsers: allUsers.length,
      pendingApprovals: pendingUsers.length,
      totalStudents: allUsers.filter(u => u.role === "student").length,
      totalLecturers: allUsers.filter(u => u.role === "lecturer").length,
      totalAdmins: allUsers.filter(u => u.role === "admin").length,
      totalCourses: allCourses.length,
      activeCourses: allCourses.filter(c => c.is_active).length,
      totalAssessments: allAssessments?.length || 0
    };

    // Get recent activities (last 10)
    const recentLogs = await getAuditLogs(1, 10);

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats,
      pendingUsers: pendingUsers.slice(0, 5), // Show only first 5
      recentActivities: recentLogs.data || []
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    req.flash("error", "Error loading dashboard data");
    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats: {},
      pendingUsers: [],
      recentActivities: []
    });
  }
});

// Users Management
adminRouter.get("/users", async (req, res) => {
  try {
    const { role, status, search } = req.query;
    let users = await dbHelpers.getAllUsers();

    // Apply filters
    if (role && role !== "all") {
      users = users.filter(user => user.role === role);
    }

    if (status && status !== "all") {
      users = users.filter(user => user.approval_status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        user.first_name.toLowerCase().includes(searchLower) ||
        user.last_name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.student_id && user.student_id.toLowerCase().includes(searchLower))
      );
    }

    res.render("admin/users", {
      title: "User Management",
      users,
      filters: { role, status, search }
    });
  } catch (error) {
    console.error("Users management error:", error);
    req.flash("error", "Error loading users data");
    res.render("admin/users", {
      title: "User Management",
      users: [],
      filters: {}
    });
  }
});

// Pending Approvals
adminRouter.get("/pending-approvals", async (req, res) => {
  try {
    const pendingUsers = await dbHelpers.getPendingUsers();

    res.render("admin/pending-approvals", {
      title: "Pending Approvals",
      pendingUsers
    });
  } catch (error) {
    console.error("Pending approvals error:", error);
    req.flash("error", "Error loading pending approvals");
    res.render("admin/pending-approvals", {
      title: "Pending Approvals",
      pendingUsers: []
    });
  }
});

// Approve User
adminRouter.post("/approve-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const approvedBy = req.session.user.id;

    const approvedUser = await dbHelpers.approveUser(userId, approvedBy);

    await logAuditEvent(
      approvedBy, 
      "USER_APPROVED", 
      "users", 
      userId, 
      { approval_status: "pending" }, 
      { approval_status: "approved" }, 
      req
    );

    req.flash("success", `User ${approvedUser.first_name} ${approvedUser.last_name} has been approved`);
    
    if (req.xhr) {
      return res.json({ success: true, message: "User approved successfully" });
    }
    
    res.redirect("/admin/pending-approvals");
  } catch (error) {
    console.error("Approve user error:", error);
    req.flash("error", "Error approving user");
    
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Error approving user" });
    }
    
    res.redirect("/admin/pending-approvals");
  }
});

// Reject User
adminRouter.post("/reject-user/:userId", [
  body("rejectionReason").trim().isLength({ min: 10 }).withMessage("Rejection reason must be at least 10 characters")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/admin/pending-approvals");
    }

    const { userId } = req.params;
    const { rejectionReason } = req.body;
    const rejectedBy = req.session.user.id;

    const rejectedUser = await dbHelpers.rejectUser(userId, rejectionReason, rejectedBy);

    await logAuditEvent(
      rejectedBy, 
      "USER_REJECTED", 
      "users", 
      userId, 
      { approval_status: "pending" }, 
      { approval_status: "rejected", rejection_reason: rejectionReason }, 
      req
    );

    req.flash("success", `User ${rejectedUser.first_name} ${rejectedUser.last_name} has been rejected`);
    
    if (req.xhr) {
      return res.json({ success: true, message: "User rejected successfully" });
    }
    
    res.redirect("/admin/pending-approvals");
  } catch (error) {
    console.error("Reject user error:", error);
    req.flash("error", "Error rejecting user");
    
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Error rejecting user" });
    }
    
    res.redirect("/admin/pending-approvals");
  }
});

// Add Admin User
adminRouter.get("/add-administrator", (req, res) => {
  res.render("admin/add-administrator", {
    title: "Add Administrator"
  });
});

// Add Admin POST
adminRouter.post("/add-administrator", [
  body("email").isEmail().normalizeEmail().withMessage("Please enter a valid email"),
  body("password").custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }
    return true;
  }),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
  body("firstName").trim().isLength({ min: 4 }).withMessage("First name must be at least 4 characters"),
  body("lastName").trim().isLength({ min: 4 }).withMessage("Last name must be at least 4 characters"),
  body("phone").optional().isMobilePhone().withMessage("Please enter a valid phone number")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/admin/add-admin");
    }

    const { email, password, firstName, lastName, phone } = req.body;

    // Check if user already exists
    const existingUser = await dbHelpers.getUserByEmail(email);
    if (existingUser) {
      req.flash("error", "An account with this email already exists");
      return res.redirect("/admin/add-admin");
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Prepare admin user data
    const adminData = {
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: "admin",
      phone: phone || null,
      approval_status: "approved", // Admins are auto-approved
      approved_by: req.session.user.id,
      approved_at: new Date().toISOString()
    };

    // Create admin user
    const newAdmin = await dbHelpers.createUser(adminData);

    await logAuditEvent(
      req.session.user.id, 
      "ADMIN_CREATED", 
      "users", 
      newAdmin.id, 
      null, 
      adminData, 
      req
    );

    req.flash("success", `Administrator ${firstName} ${lastName} has been created successfully`);
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Add admin error:", error);
    req.flash("error", "An error occurred while creating the administrator. Please try again.");
    res.redirect("/admin/add-admin");
  }
});

// Deactivate/Activate User
adminRouter.post("/toggle-user-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await dbHelpers.getUserById(userId);
    
    if (!currentUser) {
      req.flash("error", "User not found");
      return res.redirect("/admin/users");
    }

    // Prevent deactivating the last admin
    if (currentUser.role === "admin" && currentUser.is_active) {
      const activeAdmins = await dbHelpers.getApprovedUsersByRole("admin");
      const activeAdminCount = activeAdmins.filter(admin => admin.is_active).length;
      
      if (activeAdminCount <= 1) {
        req.flash("error", "Cannot deactivate the last active administrator");
        return res.redirect("/admin/users");
      }
    }

    const newStatus = !currentUser.is_active;
    await dbHelpers.updateUser(userId, { is_active: newStatus });

    await logAuditEvent(
      req.session.user.id, 
      newStatus ? "USER_ACTIVATED" : "USER_DEACTIVATED", 
      "users", 
      userId, 
      { is_active: currentUser.is_active }, 
      { is_active: newStatus }, 
      req
    );

    req.flash("success", `User has been ${newStatus ? "activated" : "deactivated"} successfully`);
    
    if (req.xhr) {
      return res.json({ success: true, message: `User ${newStatus ? "activated" : "deactivated"} successfully` });
    }
    
    res.redirect("/admin/users");
  }
   catch (error) {
    console.error("Toggle user status error:", error);
    req.flash("error", "Error updating user status");
    
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Error updating user status" });
    }
    
    res.redirect("/admin/users");
  }
});

// Courses Management
adminRouter.get("/courses", async (req, res) => {
  try {
    const courses = await dbHelpers.getAllCourses();
    const lecturers = await dbHelpers.getApprovedUsersByRole("lecturer");

    res.render("admin/courses", {
      title: "Course Management",
      courses,
      lecturers
    });
  } catch (error) {
    console.error("Courses management error:", error);
    req.flash("error", "Error loading courses data");
    res.render("admin/courses", {
      title: "Course Management",
      courses: [],
      lecturers: []
    });
  }
});

// Add Course
adminRouter.post("/courses", [
  body("name").trim().isLength({ min: 3 }).withMessage("Course name must be at least 3 characters"),
  body("code").trim().isLength({ min: 2 }).withMessage("Course code must be at least 2 characters"),
  body("lecturerId").isUUID().withMessage("Please select a valid lecturer"),
  body("creditHours").isInt({ min: 1, max: 6 }).withMessage("Credit hours must be between 1 and 6"),
  body("semester").trim().notEmpty().withMessage("Semester is required"),
  body("academicYear").trim().notEmpty().withMessage("Academic year is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/admin/courses");
    }

    const { name, code, description, lecturerId, creditHours, semester, academicYear } = req.body;

    const courseData = {
      name,
      code: code.toUpperCase(),
      description: description || null,
      lecturer_id: lecturerId,
      credit_hours: parseInt(creditHours),
      semester,
      academic_year: academicYear
    };

    const newCourse = await dbHelpers.createCourse(courseData);

    await logAuditEvent(
      req.session.user.id, 
      "COURSE_CREATED", 
      "courses", 
      newCourse.id, 
      null, 
      courseData, 
      req
    );

    req.flash("success", "Course created successfully");
    res.redirect("/admin/courses");
  } catch (error) {
    console.error("Add course error:", error);
    if (error.code === "23505") { // Unique constraint violation
      req.flash("error", "A course with this code already exists");
    } else {
      req.flash("error", "Error creating course");
    }
    res.redirect("/admin/courses");
  }
});

// Edit Course
adminRouter.get("/edit-course/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await dbHelpers.getCourseById(courseId);
    const lecturers = await dbHelpers.getApprovedUsersByRole("lecturer");

    if (!course) {
      req.flash("error", "Course not found");
      return res.redirect("/admin/courses");
    }

    res.render("admin/edit-course", {
      title: "Edit Course",
      course,
      lecturers
    });
  } catch (error) {
    console.error("Edit course error:", error);
    req.flash("error", "Error loading course data");
    res.redirect("/admin/courses");
  }
});

// Update Course
adminRouter.post("/edit-course/:courseId", [
  body("name").trim().isLength({ min: 3 }).withMessage("Course name must be at least 3 characters"),
  body("code").trim().isLength({ min: 2 }).withMessage("Course code must be at least 2 characters"),
  body("lecturerId").isUUID().withMessage("Please select a valid lecturer"),
  body("creditHours").isInt({ min: 1, max: 6 }).withMessage("Credit hours must be between 1 and 6"),
  body("semester").trim().notEmpty().withMessage("Semester is required"),
  body("academicYear").trim().notEmpty().withMessage("Academic year is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/admin/edit-course/${req.params.courseId}`);
    }

    const { courseId } = req.params;
    const { name, code, description, lecturerId, creditHours, semester, academicYear, isActive } = req.body;

    const updates = {
      name,
      code: code.toUpperCase(),
      description: description || null,
      lecturer_id: lecturerId,
      credit_hours: parseInt(creditHours),
      semester,
      academic_year: academicYear,
      is_active: isActive === "on"
    };

    await dbHelpers.updateCourse(courseId, updates);

    await logAuditEvent(
      req.session.user.id, 
      "COURSE_UPDATED", 
      "courses", 
      courseId, 
      null, 
      updates, 
      req
    );

    req.flash("success", "Course updated successfully");
    res.redirect("/admin/courses");
  } catch (error) {
    console.error("Update course error:", error);
    if (error.code === "23505") { // Unique constraint violation
      req.flash("error", "A course with this code already exists");
    } else {
      req.flash("error", "Error updating course");
    }
    res.redirect(`/admin/edit-course/${req.params.courseId}`);
  }
});

// Reports
adminRouter.get("/reports", async (req, res) => {
  try {
    // Get summary statistics
    const [allUsers, allCourses, pendingUsers] = await Promise.all([
      dbHelpers.getAllUsers(),
      dbHelpers.getAllCourses(),
      dbHelpers.getPendingUsers()
    ]);

    const reportData = {
      totalUsers: allUsers.length,
      pendingApprovals: pendingUsers.length,
      totalStudents: allUsers.filter(u => u.role === "student").length,
      totalLecturers: allUsers.filter(u => u.role === "lecturer").length,
      totalCourses: allCourses.length,
      activeCourses: allCourses.filter(c => c.is_active).length,
      // Add more report data as needed
    };

    res.render("admin/reports", {
      title: "Admin Reports",
      reportData
    });
  } catch (error) {
    console.error("Admin reports error:", error);
    req.flash("error", "Error loading reports data");
    res.render("admin/reports", {
      title: "Admin Reports",
      reportData: {}
    });
  }
});

// Export Data (CSV)
adminRouter.get("/export/:type", async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    let filename = "";
    let fields = [];

    switch (type) {
      case "users":
        data = await dbHelpers.getAllUsers();
        filename = "users.csv";
        fields = ["id", "email", "first_name", "last_name", "role", "approval_status", "is_active"];
        break;
      case "courses":
        data = await dbHelpers.getAllCourses();
        filename = "courses.csv";
        fields = ["id", "name", "code", "description", "lecturer_id", "credit_hours", "semester", "academic_year"];
        break;
      case "assessments":
        data = await dbHelpers.getAllAssessments(); // Assuming this helper exists
        filename = "assessments.csv";
        fields = ["id", "title", "course_id", "lecturer_id", "type", "total_marks", "due_date"];
        break;
      case "results":
        data = await dbHelpers.getAllResults(); // Assuming this helper exists
        filename = "results.csv";
        fields = ["id", "student_id", "assessment_id", "score", "percentage", "grade"];
        break;
      case "audit_logs":
        data = await getAuditLogs(); // Assuming this returns all logs
        filename = "audit_logs.csv";
        fields = ["id", "user_id", "action", "table_name", "record_id", "created_at"];
        break;
      default:
        req.flash("error", "Invalid export type");
        return res.redirect("/admin/reports");
    }

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.status(200).send(csv);

    await logExportEvent(req.session.user.id, type, filename, req);

  } catch (error) {
    console.error("Export error:", error);
    req.flash("error", "Error exporting data");
    res.redirect("/admin/reports");
  }
});

// System Settings
adminRouter.get("/settings", async (req, res) => {
  try {
    const settings = await dbHelpers.getAllSystemSettings();
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    res.render("admin/settings", {
      title: "System Settings",
      settings: settingsMap
    });
  } catch (error) {
    console.error("System settings error:", error);
    req.flash("error", "Error loading system settings");
    res.render("admin/settings", {
      title: "System Settings",
      settings: {}
    });
  }
});

// Update System Settings
adminRouter.post("/settings", async (req, res) => {
  try {
    const updates = req.body;
    for (const key in updates) {
      await dbHelpers.updateSystemSetting(key, updates[key]);
    }

    await logAuditEvent(req.session.user.id, "SYSTEM_SETTINGS_UPDATED", "system_settings", null, null, updates, req);

    req.flash("success", "System settings updated successfully");
    res.redirect("/admin/settings");
  } catch (error) {
    console.error("Update system settings error:", error);
    req.flash("error", "Error updating system settings");
    res.redirect("/admin/settings");
  }
});

// Audit Logs
adminRouter.get("/logs", async (req, res) => {
  try {
    const { page = 1, limit = 20, user, action, table } = req.query;
    const logs = await getAuditLogs(parseInt(page), parseInt(limit), user, action, table);
    const totalLogs = await dbHelpers.getAuditLogsCount(user, action, table);

    res.render("admin/logs", {
      title: "Audit Logs",
      logs: logs.data,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalLogs / parseInt(limit)),
      filters: { user, action, table }
    });
  } catch (error) {
    console.error("Audit logs error:", error);
    req.flash("error", "Error loading audit logs");
    res.render("admin/logs", {
      title: "Audit Logs",
      logs: [],
      currentPage: 1,
      totalPages: 1,
      filters: {}
    });
  }
});

// Backup and Restore (Placeholder)
adminRouter.get("/backup-restore", (req, res) => {
  res.render("admin/backup-restore", {
    title: "Backup & Restore"
  });
});

// System Logs (Placeholder)
adminRouter.get("/system-logs", (req, res) => {
  res.render("admin/system-logs", {
    title: "System Logs"
  });
});





module.exports = authRouter;




// Admin Dashboard
adminRouter.get("/dashboard", async (req, res) => {
  try {
    // Get statistics
    const [allUsers, pendingUsers, allCourses, allAssessments] = await Promise.all([
      dbHelpers.getAllUsers(),
      dbHelpers.getPendingUsers(),
      dbHelpers.getAllCourses(),
      dbHelpers.getAllAssessments() // Corrected to get all assessments
    ]);

    const stats = {
      totalUsers: allUsers.length,
      pendingApprovals: pendingUsers.length,
      totalStudents: allUsers.filter(u => u.role === "student").length,
      totalLecturers: allUsers.filter(u => u.role === "lecturer").length,
      totalAdmins: allUsers.filter(u => u.role === "admin").length,
      totalCourses: allCourses.length,
      activeCourses: allCourses.filter(c => c.is_active).length,
      totalAssessments: allAssessments?.length || 0
    };

    // Get recent activities (last 10)
    const recentLogs = await getAuditLogs(1, 10);

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats,
      pendingUsers: pendingUsers.slice(0, 5), // Show only first 5
      recentActivities: recentLogs.data || []
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    req.flash("error", "Error loading dashboard data");
    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats: {},
      pendingUsers: [],
      recentActivities: []
    });
  }
});

// Users Management
adminRouter.get("/users", async (req, res) => {
  try {
    const { role, status, search } = req.query;
    let users = await dbHelpers.getAllUsers();

    // Apply filters
    if (role && role !== "all") {
      users = users.filter(user => user.role === role);
    }

    if (status && status !== "all") {
      users = users.filter(user => user.approval_status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        user.first_name.toLowerCase().includes(searchLower) ||
        user.last_name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.student_id && user.student_id.toLowerCase().includes(searchLower))
      );
    }

    res.render("admin/users", {
      title: "User Management",
      users,
      filters: { role, status, search }
    });
  } catch (error) {
    console.error("Users management error:", error);
    req.flash("error", "Error loading users data");
    res.render("admin/users", {
      title: "User Management",
      users: [],
      filters: {}
    });
  }
});

// Pending Approvals
adminRouter.get("/pending-approvals", async (req, res) => {
  try {
    const pendingUsers = await dbHelpers.getPendingUsers();

    res.render("admin/pending-approvals", {
      title: "Pending Approvals",
      pendingUsers
    });
  } catch (error) {
    console.error("Pending approvals error:", error);
    req.flash("error", "Error loading pending approvals");
    res.render("admin/pending-approvals", {
      title: "Pending Approvals",
      pendingUsers: []
    });
  }
});

// Approve User
adminRouter.post("/approve-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const approvedBy = req.session.user.id;

    const approvedUser = await dbHelpers.approveUser(userId, approvedBy);

    await logAuditEvent(
      approvedBy, 
      "USER_APPROVED", 
      "users", 
      userId, 
      { approval_status: "pending" }, 
      { approval_status: "approved" }, 
      req
    );

    req.flash("success", `User ${approvedUser.first_name} ${approvedUser.last_name} has been approved`);
    
    if (req.xhr) {
      return res.json({ success: true, message: "User approved successfully" });
    }
    
    res.redirect("/admin/pending-approvals");
  } catch (error) {
    console.error("Approve user error:", error);
    req.flash("error", "Error approving user");
    
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Error approving user" });
    }
    
    res.redirect("/admin/pending-approvals");
  }
});

// Reject User
adminRouter.post("/reject-user/:userId", [
  body("rejectionReason").trim().isLength({ min: 10 }).withMessage("Rejection reason must be at least 10 characters")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/admin/pending-approvals");
    }

    const { userId } = req.params;
    const { rejectionReason } = req.body;
    const rejectedBy = req.session.user.id;

    const rejectedUser = await dbHelpers.rejectUser(userId, rejectionReason, rejectedBy);

    await logAuditEvent(
      rejectedBy, 
      "USER_REJECTED", 
      "users", 
      userId, 
      { approval_status: "pending" }, 
      { approval_status: "rejected", rejection_reason: rejectionReason }, 
      req
    );

    req.flash("success", `User ${rejectedUser.first_name} ${rejectedUser.last_name} has been rejected`);
    
    if (req.xhr) {
      return res.json({ success: true, message: "User rejected successfully" });
    }
    
    res.redirect("/admin/pending-approvals");
  } catch (error) {
    console.error("Reject user error:", error);
    req.flash("error", "Error rejecting user");
    
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Error rejecting user" });
    }
    
    res.redirect("/admin/pending-approvals");
  }
});

// Add Admin User
adminRouter.get("/add-administrator", (req, res) => {
  res.render("admin/add-administrator", {
    title: "Add Administrator"
  });
});

// Add Admin POST
adminRouter.post("/add-administrator", [
  body("email").isEmail().normalizeEmail().withMessage("Please enter a valid email"),
  body("password").custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]);
    }
    return true;
  }),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
  body("firstName").trim().isLength({ min: 2 }).withMessage("First name must be at least 2 characters"),
  body("lastName").trim().isLength({ min: 2 }).withMessage("Last name must be at least 2 characters"),
  body("phone").optional().isMobilePhone().withMessage("Please enter a valid phone number")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/admin/add-admin");
    }

    const { email, password, firstName, lastName, phone } = req.body;

    // Check if user already exists
    const existingUser = await dbHelpers.getUserByEmail(email);
    if (existingUser) {
      req.flash("error", "An account with this email already exists");
      return res.redirect("/admin/add-admin");
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Prepare admin user data
    const adminData = {
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      role: "admin",
      phone: phone || null,
      approval_status: "approved", // Admins are auto-approved
      approved_by: req.session.user.id,
      approved_at: new Date().toISOString()
    };

    // Create admin user
    const newAdmin = await dbHelpers.createUser(adminData);

    await logAuditEvent(
      req.session.user.id, 
      "ADMIN_CREATED", 
      "users", 
      newAdmin.id, 
      null, 
      adminData, 
      req
    );

    req.flash("success", `Administrator ${firstName} ${lastName} has been created successfully`);
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Add admin error:", error);
    req.flash("error", "An error occurred while creating the administrator. Please try again.");
    res.redirect("/admin/add-admin");
  }
});

// Deactivate/Activate User
adminRouter.post("/toggle-user-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await dbHelpers.getUserById(userId);
    
    if (!currentUser) {
      req.flash("error", "User not found");
      return res.redirect("/admin/users");
    }

    // Prevent deactivating the last admin
    if (currentUser.role === "admin" && currentUser.is_active) {
      const activeAdmins = await dbHelpers.getApprovedUsersByRole("admin");
      const activeAdminCount = activeAdmins.filter(admin => admin.is_active).length;
      
      if (activeAdminCount <= 1) {
        req.flash("error", "Cannot deactivate the last active administrator");
        return res.redirect("/admin/users");
      }
    }

    const newStatus = !currentUser.is_active;
    await dbHelpers.updateUser(userId, { is_active: newStatus });

    await logAuditEvent(
      req.session.user.id, 
      newStatus ? "USER_ACTIVATED" : "USER_DEACTIVATED", 
      "users", 
      userId, 
      { is_active: currentUser.is_active }, 
      { is_active: newStatus }, 
      req
    );

    req.flash("success", `User has been ${newStatus ? "activated" : "deactivated"} successfully`);
    
    if (req.xhr) {
      return res.json({ success: true, message: `User ${newStatus ? "activated" : "deactivated"} successfully` });
    }
    
    res.redirect("/admin/users");
  }
   catch (error) {
    console.error("Toggle user status error:", error);
    req.flash("error", "Error updating user status");
    
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Error updating user status" });
    }
    
    res.redirect("/admin/users");
  }
});

// Courses Management
adminRouter.get("/courses", async (req, res) => {
  try {
    const courses = await dbHelpers.getAllCourses();
    const lecturers = await dbHelpers.getApprovedUsersByRole("lecturer");

    res.render("admin/courses", {
      title: "Course Management",
      courses,
      lecturers
    });
  } catch (error) {
    console.error("Courses management error:", error);
    req.flash("error", "Error loading courses data");
    res.render("admin/courses", {
      title: "Course Management",
      courses: [],
      lecturers: []
    });
  }
});

// Add Course
adminRouter.post("/courses", [
  body("name").trim().isLength({ min: 3 }).withMessage("Course name must be at least 3 characters"),
  body("code").trim().isLength({ min: 2 }).withMessage("Course code must be at least 2 characters"),
  body("lecturerId").isUUID().withMessage("Please select a valid lecturer"),
  body("creditHours").isInt({ min: 1, max: 6 }).withMessage("Credit hours must be between 1 and 6"),
  body("semester").trim().notEmpty().withMessage("Semester is required"),
  body("academicYear").trim().notEmpty().withMessage("Academic year is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/admin/courses");
    }

    const { name, code, description, lecturerId, creditHours, semester, academicYear } = req.body;

    const courseData = {
      name,
      code: code.toUpperCase(),
      description: description || null,
      lecturer_id: lecturerId,
      credit_hours: parseInt(creditHours),
      semester,
      academic_year: academicYear
    };

    const newCourse = await dbHelpers.createCourse(courseData);

    await logAuditEvent(
      req.session.user.id, 
      "COURSE_CREATED", 
      "courses", 
      newCourse.id, 
      null, 
      courseData, 
      req
    );

    req.flash("success", "Course created successfully");
    res.redirect("/admin/courses");
  } catch (error) {
    console.error("Add course error:", error);
    if (error.code === "23505") { // Unique constraint violation
      req.flash("error", "A course with this code already exists");
    } else {
      req.flash("error", "Error creating course");
    }
    res.redirect("/admin/courses");
  }
});

// Edit Course
adminRouter.get("/edit-course/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await dbHelpers.getCourseById(courseId);
    const lecturers = await dbHelpers.getApprovedUsersByRole("lecturer");

    if (!course) {
      req.flash("error", "Course not found");
      return res.redirect("/admin/courses");
    }

    res.render("admin/edit-course", {
      title: "Edit Course",
      course,
      lecturers
    });
  } catch (error) {
    console.error("Edit course error:", error);
    req.flash("error", "Error loading course data");
    res.redirect("/admin/courses");
  }
});

// Update Course
adminRouter.post("/edit-course/:courseId", [
  body("name").trim().isLength({ min: 3 }).withMessage("Course name must be at least 3 characters"),
  body("code").trim().isLength({ min: 2 }).withMessage("Course code must be at least 2 characters"),
  body("lecturerId").isUUID().withMessage("Please select a valid lecturer"),
  body("creditHours").isInt({ min: 1, max: 6 }).withMessage("Credit hours must be between 1 and 6"),
  body("semester").trim().notEmpty().withMessage("Semester is required"),
  body("academicYear").trim().notEmpty().withMessage("Academic year is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/admin/edit-course/${req.params.courseId}`);
    }

    const { courseId } = req.params;
    const { name, code, description, lecturerId, creditHours, semester, academicYear, isActive } = req.body;

    const updates = {
      name,
      code: code.toUpperCase(),
      description: description || null,
      lecturer_id: lecturerId,
      credit_hours: parseInt(creditHours),
      semester,
      academic_year: academicYear,
      is_active: isActive === "on"
    };

    await dbHelpers.updateCourse(courseId, updates);

    await logAuditEvent(
      req.session.user.id, 
      "COURSE_UPDATED", 
      "courses", 
      courseId, 
      null, 
      updates, 
      req
    );

    req.flash("success", "Course updated successfully");
    res.redirect("/admin/courses");
  } catch (error) {
    console.error("Update course error:", error);
    if (error.code === "23505") { // Unique constraint violation
      req.flash("error", "A course with this code already exists");
    } else {
      req.flash("error", "Error updating course");
    }
    res.redirect(`/admin/edit-course/${req.params.courseId}`);
  }
});

// Reports
adminRouter.get("/reports", async (req, res) => {
  try {
    // Get summary statistics
    const [allUsers, allCourses, pendingUsers] = await Promise.all([
      dbHelpers.getAllUsers(),
      dbHelpers.getAllCourses(),
      dbHelpers.getPendingUsers()
    ]);

    const reportData = {
      userStats: {
        total: allUsers.length,
        students: allUsers.filter(u => u.role === "student").length,
        lecturers: allUsers.filter(u => u.role === "lecturer").length,
        admins: allUsers.filter(u => u.role === "admin").length,
        pending: pendingUsers.length,
        approved: allUsers.filter(u => u.approval_status === "approved").length,
        rejected: allUsers.filter(u => u.approval_status === "rejected").length
      },
      courseStats: {
        total: allCourses.length,
        active: allCourses.filter(c => c.is_active).length,
        inactive: allCourses.filter(c => !c.is_active).length
      }
    };

    res.render("admin/reports", {
      title: "Admin Reports",
      reportData
    });
  } catch (error) {
    console.error("Admin reports error:", error);
    req.flash("error", "Error loading reports data");
    res.render("admin/reports", {
      title: "Admin Reports",
      reportData: {}
    });
  }
});

// Export Data (CSV)
adminRouter.get("/export/:type", async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    let filename = "";
    let fields = [];

    switch (type) {
      case "users":
        data = await dbHelpers.getAllUsers();
        filename = "users.csv";
        fields = ["id", "email", "first_name", "last_name", "role", "approval_status", "is_active"];
        break;
      case "courses":
        data = await dbHelpers.getAllCourses();
        filename = "courses.csv";
        fields = ["id", "name", "code", "description", "lecturer_id", "credit_hours", "semester", "academic_year"];
        break;
      case "assessments":
        data = await dbHelpers.getAllAssessments(); // Assuming this helper exists
        filename = "assessments.csv";
        fields = ["id", "title", "course_id", "lecturer_id", "type", "total_marks", "due_date"];
        break;
      case "results":
        data = await dbHelpers.getAllResults(); // Assuming this helper exists
        filename = "results.csv";
        fields = ["id", "student_id", "assessment_id", "score", "percentage", "grade"];
        break;
      case "audit_logs":
        data = await getAuditLogs(); // Assuming this returns all logs
        filename = "audit_logs.csv";
        fields = ["id", "user_id", "action", "table_name", "record_id", "created_at"];
        break;
      default:
        req.flash("error", "Invalid export type");
        return res.redirect("/admin/reports");
    }

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.status(200).send(csv);

    await logExportEvent(req.session.user.id, type, filename, req);

  } catch (error) {
    console.error("Export error:", error);
    req.flash("error", "Error exporting data");
    res.redirect("/admin/reports");
  }
});

// System Settings
adminRouter.get("/settings", async (req, res) => {
  try {
    const settings = await dbHelpers.getAllSystemSettings();
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    res.render("admin/settings", {
      title: "System Settings",
      settings: settingsMap
    });
  } catch (error) {
    console.error("System settings error:", error);
    req.flash("error", "Error loading system settings");
    res.render("admin/settings", {
      title: "System Settings",
      settings: {}
    });
  }
});

// Update System Settings
adminRouter.post("/settings", async (req, res) => {
  try {
    const updates = req.body;
    for (const key in updates) {
      await dbHelpers.updateSystemSetting(key, updates[key]);
    }

    await logAuditEvent(req.session.user.id, "SYSTEM_SETTINGS_UPDATED", "system_settings", null, null, updates, req);

    req.flash("success", "System settings updated successfully");
    res.redirect("/admin/settings");
  } catch (error) {
    console.error("Update system settings error:", error);
    req.flash("error", "Error updating system settings");
    res.redirect("/admin/settings");
  }
});

// Audit Logs
adminRouter.get("/logs", async (req, res) => {
  try {
    const { page = 1, limit = 20, user, action, table } = req.query;
    const logs = await getAuditLogs(parseInt(page), parseInt(limit), user, action, table);
    const totalLogs = await dbHelpers.getAuditLogsCount(user, action, table);

    res.render("admin/logs", {
      title: "Audit Logs",
      logs: logs.data,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalLogs / parseInt(limit)),
      filters: { user, action, table }
    });
  } catch (error) {
    console.error("Audit logs error:", error);
    req.flash("error", "Error loading audit logs");
    res.render("admin/logs", {
      title: "Audit Logs",
      logs: [],
      currentPage: 1,
      totalPages: 1,
      filters: {}
    });
  }
});

// Backup and Restore (Placeholder)
adminRouter.get("/backup-restore", (req, res) => {
  res.render("admin/backup-restore", {
    title: "Backup & Restore"
  });
});

// System Logs (Placeholder)
adminRouter.get("/system-logs", (req, res) => {
  res.render("admin/system-logs", {
    title: "System Logs"
  });
});





module.exports = adminRouter;




// Lecturer Dashboard
lecturerRouter.get("/dashboard", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    
    // Get lecturer's courses and assessments
    const [courses, assessments] = await Promise.all([
      dbHelpers.getAllCourses().then(allCourses => 
        allCourses.filter(course => course.lecturer_id === lecturerId)
      ),
      dbHelpers.getAssessmentsByLecturer(lecturerId)
    ]);

    // Get all results for lecturer's assessments
    const allResults = [];
    for (const assessment of assessments) {
      const results = await dbHelpers.getResultsByAssessment(assessment.id);
      allResults.push(...results);
    }

    // Calculate statistics
    const stats = {
      totalCourses: courses.length,
      activeCourses: courses.filter(c => c.is_active).length,
      totalAssessments: assessments.length,
      publishedAssessments: assessments.filter(a => a.is_published).length,
      totalStudents: allResults.length,
      averageScore: allResults.length > 0 ? 
        (allResults.reduce((sum, result) => sum + parseFloat(result.percentage || 0), 0) / allResults.length).toFixed(2) : 0
    };

    // Get recent assessments (last 5)
    const recentAssessments = assessments.slice(0, 5);

    // Get course enrollment counts
    const courseEnrollments = {};
    for (const course of courses) {
      const enrollments = await dbHelpers.getCourseEnrollments(course.id);
      courseEnrollments[course.id] = enrollments.length;
    }

    res.render("lecturer/dashboard", {
      title: "Lecturer Dashboard",
      stats,
      courses,
      recentAssessments,
      courseEnrollments
    });
  } catch (error) {
    console.error("Lecturer dashboard error:", error);
    req.flash("error", "Error loading dashboard data");
    res.render("lecturer/dashboard", {
      title: "Lecturer Dashboard",
      stats: {},
      courses: [],
      recentAssessments: [],
      courseEnrollments: {}
    });
  }
});

// Assessments Management
lecturerRouter.get("/assessments", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    const { courseId, type, status } = req.query;
    
    let assessments = await dbHelpers.getAssessmentsByLecturer(lecturerId);
    const courses = await dbHelpers.getAllCourses().then(allCourses => 
      allCourses.filter(course => course.lecturer_id === lecturerId)
    );

    // Apply filters
    if (courseId && courseId !== "all") {
      assessments = assessments.filter(assessment => assessment.course_id === courseId);
    }

    if (type && type !== "all") {
      assessments = assessments.filter(assessment => assessment.type === type);
    }

    if (status && status !== "all") {
      if (status === "published") {
        assessments = assessments.filter(assessment => assessment.is_published);
      } else if (status === "draft") {
        assessments = assessments.filter(assessment => !assessment.is_published);
      }
    }

    res.render("lecturer/assessments", {
      title: "My Assessments",
      assessments,
      courses,
      filters: { courseId, type, status }
    });
  } catch (error) {
    console.error("Assessments error:", error);
    req.flash("error", "Error loading assessments");
    res.render("lecturer/assessments", {
      title: "My Assessments",
      assessments: [],
      courses: [],
      filters: {}
    });
  }
});

// Create Assessment
lecturerRouter.get("/create-assessment", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    const courses = await dbHelpers.getAllCourses().then(allCourses => 
      allCourses.filter(course => course.lecturer_id === lecturerId && course.is_active)
    );

    res.render("lecturer/create-assessment", {
      title: "Create Assessment",
      courses
    });
  } catch (error) {
    console.error("Create assessment page error:", error);
    req.flash("error", "Error loading create assessment page");
    res.redirect("/lecturer/assessments");
  }
});

// Create Assessment POST
lecturerRouter.post("/create-assessment", [
  body("title").trim().isLength({ min: 3 }).withMessage("Assessment title must be at least 3 characters"),
  body("courseId").isUUID().withMessage("Please select a valid course"),
  body("type").isIn(["quiz", "assignment", "exam", "project", "presentation"]).withMessage("Please select a valid assessment type"),
  body("totalMarks").isInt({ min: 1 }).withMessage("Total marks must be at least 1"),
  body("passingMarks").isInt({ min: 0 }).withMessage("Passing marks must be a valid number"),
  body("dueDate").optional().isISO8601().withMessage("Please enter a valid due date"),
  body("duration").optional().isInt({ min: 1 }).withMessage("Duration must be at least 1 minute")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("/lecturer/create-assessment");
    }

    const lecturerId = req.session.user.id;
    const {
      title,
      description,
      courseId,
      type,
      totalMarks,
      passingMarks,
      dueDate,
      duration,
      instructions,
      allowLateSubmission,
      latePenalty
    } = req.body;

    // Verify course ownership
    const course = await dbHelpers.getCourseById(courseId);
    if (!course || course.lecturer_id !== lecturerId) {
      req.flash("error", "You can only create assessments for your own courses");
      return res.redirect("/lecturer/create-assessment");
    }

    const assessmentData = {
      title,
      description: description || null,
      course_id: courseId,
      lecturer_id: lecturerId,
      type,
      total_marks: parseInt(totalMarks),
      passing_marks: parseInt(passingMarks),
      due_date: dueDate || null,
      duration_minutes: duration ? parseInt(duration) : null,
      instructions: instructions || null,
      allow_late_submission: allowLateSubmission === "on",
      late_penalty_percent: latePenalty ? parseFloat(latePenalty) : 0,
      is_published: false // Start as draft
    };

    const newAssessment = await dbHelpers.createAssessment(assessmentData);

    await logAuditEvent(
      lecturerId,
      "ASSESSMENT_CREATED",
      "assessments",
      newAssessment.id,
      null,
      assessmentData,
      req
    );

    req.flash("success", "Assessment created successfully");
    res.redirect("/lecturer/assessments");
  } catch (error) {
    console.error("Create assessment error:", error);
    req.flash("error", "Error creating assessment");
    res.redirect("/lecturer/create-assessment");
  }
});

// Edit Assessment
lecturerRouter.get("/edit-assessment/:assessmentId", async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const lecturerId = req.session.user.id;

    const assessment = await dbHelpers.getAssessmentById(assessmentId);
    
    if (!assessment || assessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    const courses = await dbHelpers.getAllCourses().then(allCourses => 
      allCourses.filter(course => course.lecturer_id === lecturerId && course.is_active)
    );

    res.render("lecturer/edit-assessment", {
      title: "Edit Assessment",
      assessment,
      courses
    });
  } catch (error) {
    console.error("Edit assessment error:", error);
    req.flash("error", "Error loading assessment");
    res.redirect("/lecturer/assessments");
  }
});

// Update Assessment
lecturerRouter.post("/edit-assessment/:assessmentId", [
  body("title").trim().isLength({ min: 3 }).withMessage("Assessment title must be at least 3 characters"),
  body("courseId").isUUID().withMessage("Please select a valid course"),
  body("type").isIn(["quiz", "assignment", "exam", "project", "presentation"]).withMessage("Please select a valid assessment type"),
  body("totalMarks").isInt({ min: 1 }).withMessage("Total marks must be at least 1"),
  body("passingMarks").isInt({ min: 0 }).withMessage("Passing marks must be a valid number")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/lecturer/edit-assessment/${req.params.assessmentId}`);
    }

    const { assessmentId } = req.params;
    const lecturerId = req.session.user.id;

    // Verify ownership
    const existingAssessment = await dbHelpers.getAssessmentById(assessmentId);
    if (!existingAssessment || existingAssessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    const {
      title,
      description,
      courseId,
      type,
      totalMarks,
      passingMarks,
      dueDate,
      duration,
      instructions,
      allowLateSubmission,
      latePenalty,
      isPublished
    } = req.body;

    const updates = {
      title,
      description: description || null,
      course_id: courseId,
      type,
      total_marks: parseInt(totalMarks),
      passing_marks: parseInt(passingMarks),
      due_date: dueDate || null,
      duration_minutes: duration ? parseInt(duration) : null,
      instructions: instructions || null,
      allow_late_submission: allowLateSubmission === "on",
      late_penalty_percent: latePenalty ? parseFloat(latePenalty) : 0,
      is_published: isPublished === "on"
    };

    await dbHelpers.updateAssessment(assessmentId, updates);

    await logAuditEvent(
      lecturerId,
      "ASSESSMENT_UPDATED",
      "assessments",
      assessmentId,
      null,
      updates,
      req
    );

    req.flash("success", "Assessment updated successfully");
    res.redirect("/lecturer/assessments");
  } catch (error) {
    console.error("Update assessment error:", error);
    req.flash("error", "Error updating assessment");
    res.redirect(`/lecturer/edit-assessment/${req.params.assessmentId}`);
  }
});

// Publish/Unpublish Assessment
lecturerRouter.post("/toggle-assessment/:assessmentId", async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const lecturerId = req.session.user.id;

    const assessment = await dbHelpers.getAssessmentById(assessmentId);
    
    if (!assessment || assessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    const newStatus = !assessment.is_published;
    await dbHelpers.updateAssessment(assessmentId, { is_published: newStatus });

    await logAuditEvent(
      lecturerId,
      newStatus ? "ASSESSMENT_PUBLISHED" : "ASSESSMENT_UNPUBLISHED",
      "assessments",
      assessmentId,
      { is_published: assessment.is_published },
      { is_published: newStatus },
      req
    );

    req.flash("success", `Assessment ${newStatus ? "published" : "unpublished"} successfully`);
    
    if (req.xhr) {
      return res.json({ success: true, published: newStatus });
    }
    
    res.redirect("/lecturer/assessments");
  } catch (error) {
    console.error("Toggle assessment error:", error);
    req.flash("error", "Error updating assessment status");
    res.redirect("/lecturer/assessments");
  }
});

// Assessment Results
lecturerRouter.get("/assessment-results/:assessmentId", async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const lecturerId = req.session.user.id;

    const assessment = await dbHelpers.getAssessmentById(assessmentId);
    
    if (!assessment || assessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    const results = await dbHelpers.getResultsByAssessment(assessmentId);

    // Calculate statistics
    const stats = {
      totalSubmissions: results.length,
      averageScore: results.length > 0 ? 
        (results.reduce((sum, r) => sum + parseFloat(r.percentage || 0), 0) / results.length).toFixed(2) : 0,
      highestScore: results.length > 0 ? Math.max(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0,
      lowestScore: results.length > 0 ? Math.min(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0,
      passRate: results.length > 0 ? 
        ((results.filter(r => parseFloat(r.percentage || 0) >= assessment.passing_marks).length / results.length) * 100).toFixed(2) : 0
    };

    res.render("lecturer/assessment-results", {
      title: `Results: ${assessment.title}`,
      assessment,
      results,
      stats
    });
  } catch (error) {
    console.error("Assessment results error:", error);
    req.flash("error", "Error loading assessment results");
    res.redirect("/lecturer/assessments");
  }
});

// Add new result for an assessment
lecturerRouter.get("/edit-result/:assessmentId", async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const lecturerId = req.session.user.id;

    const assessment = await dbHelpers.getAssessmentById(assessmentId);
    
    if (!assessment || assessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    // Get enrolled students for this course
    const enrollments = await dbHelpers.getCourseEnrollments(assessment.course_id);
    
    res.render("lecturer/edit-result", {
      title: "Add Result",
      assessment,
      enrollments,
      existingResult: null,
      selectedStudentId: null
    });
  } catch (error) {
    console.error("Add result page error:", error);
    req.flash("error", "Error loading add result form");
    res.redirect("/lecturer/assessments");
  }
});

// Edit existing result for an assessment
lecturerRouter.get("/edit-result/:assessmentId/:studentId", async (req, res) => {
  try {
    const { assessmentId, studentId } = req.params;
    const lecturerId = req.session.user.id;

    const assessment = await dbHelpers.getAssessmentById(assessmentId);
    
    if (!assessment || assessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    // Get enrolled students for this course
    const enrollments = await dbHelpers.getCourseEnrollments(assessment.course_id);
    
    const results = await dbHelpers.getResultsByAssessment(assessmentId);
    const existingResult = results.find(r => r.student_id === studentId);

    if (!existingResult) {
      req.flash("error", "Result not found for this student and assessment.");
      return res.redirect("/lecturer/assessment-results/" + assessmentId);
    }

    res.render("lecturer/edit-result", {
      title: "Edit Result",
      assessment,
      enrollments,
      existingResult,
      selectedStudentId: studentId
    });
  } catch (error) {
    console.error("Edit result page error:", error);
    req.flash("error", "Error loading edit result form");
    res.redirect("/lecturer/assessments");
  }
});

// Save Result
lecturerRouter.post("/save-result", [
  body("assessmentId").isUUID().withMessage("Invalid assessment"),
  body("studentId").isUUID().withMessage("Please select a student"),
  body("score").isFloat({ min: 0 }).withMessage("Score must be a valid number"),
  body("feedback").optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect("back");
    }

    const { assessmentId, studentId, score, feedback, isLate } = req.body;
    const lecturerId = req.session.user.id;

    // Verify assessment ownership
    const assessment = await dbHelpers.getAssessmentById(assessmentId);
    if (!assessment || assessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    // Calculate grade based on percentage
    const percentage = (parseFloat(score) / assessment.total_marks) * 100;
    let grade = "F";
    if (percentage >= 90) grade = "A";
    else if (percentage >= 80) grade = "B";
    else if (percentage >= 70) grade = "C";
    else if (percentage >= 60) grade = "D";

    const resultData = {
      assessment_id: assessmentId,
      student_id: studentId,
      score: parseFloat(score),
      percentage: percentage.toFixed(2),
      grade,
      feedback: feedback || null,
      graded_by: lecturerId,
      is_late: isLate === "on"
    };

    // Check if result already exists
    const existingResults = await dbHelpers.getResultsByAssessment(assessmentId);
    const existingResult = existingResults.find(r => r.student_id === studentId);

    if (existingResult) {
      // Update existing result
      await dbHelpers.updateResult(existingResult.id, resultData);
      await logAuditEvent(lecturerId, "RESULT_UPDATED", "results", existingResult.id, null, resultData, req);
      req.flash("success", "Result updated successfully");
    } else {
      // Create new result
      const newResult = await dbHelpers.createResult(resultData);
      await logAuditEvent(lecturerId, "RESULT_CREATED", "results", newResult.id, null, resultData, req);
      req.flash("success", "Result added successfully");
    }

    res.redirect(`/lecturer/assessment-results/${assessmentId}`);
  } catch (error) {
    console.error("Save result error:", error);
    req.flash("error", "Error saving result");
    res.redirect("back");
  }
});

// All Results
lecturerRouter.get("/results", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    const { courseId, assessmentType } = req.query;

    // Get lecturer's assessments
    let assessments = await dbHelpers.getAssessmentsByLecturer(lecturerId);
    
    // Apply filters
    if (courseId && courseId !== "all") {
      assessments = assessments.filter(a => a.course_id === courseId);
    }

    if (assessmentType && assessmentType !== "all") {
      assessments = assessments.filter(a => a.type === assessmentType);
    }

    // Get all results for these assessments
    const allResults = [];
    for (const assessment of assessments) {
      const results = await dbHelpers.getResultsByAssessment(assessment.id);
      allResults.push(...results.map(r => ({ ...r, assessment })));
    }

    // Get lecturer's courses for filter
    const courses = await dbHelpers.getAllCourses().then(allCourses => 
      allCourses.filter(course => course.lecturer_id === lecturerId)
    );

    res.render("lecturer/results", {
      title: "All Results",
      results: allResults,
      courses,
      filters: { courseId, assessmentType }
    });
  } catch (error) {
    console.error("All results error:", error);
    req.flash("error", "Error loading results");
    res.render("lecturer/results", {
      title: "All Results",
      results: [],
      courses: [],
      filters: {}
    });
  }
});

// Export Results
lecturerRouter.get("/export-results/:assessmentId", async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { format = "csv" } = req.query;
    const lecturerId = req.session.user.id;

    const assessment = await dbHelpers.getAssessmentById(assessmentId);
    
    if (!assessment || assessment.lecturer_id !== lecturerId) {
      req.flash("error", "Assessment not found or access denied");
      return res.redirect("/lecturer/assessments");
    }

    const results = await dbHelpers.getResultsByAssessment(assessmentId);

    // Prepare export data
    const exportData = results.map(result => ({
      "Student ID": result.student?.student_id || "N/A",
      "Student Name": `${result.student?.first_name || ""} ${result.student?.last_name || ""}`.trim(),
      "Email": result.student?.email || "N/A",
      "Score": result.score || 0,
      "Total Marks": assessment.total_marks,
      "Percentage": `${result.percentage || 0}%`,
      "Grade": result.grade || "N/A",
      "Submitted": result.submitted_at ? new Date(result.submitted_at).toLocaleDateString() : "N/A",
      "Graded": result.graded_at ? new Date(result.graded_at).toLocaleDateString() : "N/A",
      "Late Submission": result.is_late ? "Yes" : "No",
      "Feedback": result.feedback || "No feedback"
    }));

    await logAuditEvent(lecturerId, "RESULTS_EXPORTED", "results", null, null, { assessmentId, format }, req);

    const filename = `${assessment.title.replace(/[^a-zA-Z0-9]/g, "_")}_results`;

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}.json`);
      return res.send(JSON.stringify(exportData, null, 2));
    }

    // Default to CSV
    const parser = new Parser();
    const csv = parser.parse(exportData);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export results error:", error);
    req.flash("error", "Error exporting results");
    res.redirect("/lecturer/assessments");
  }
});

// Lecturer Courses
lecturerRouter.get("/courses", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    const courses = await dbHelpers.getAllCourses().then(allCourses => 
      allCourses.filter(course => course.lecturer_id === lecturerId)
    );
    res.render("lecturer/courses", {
      title: "My Courses",
      courses
    });
  } catch (error) {
    console.error("Lecturer courses error:", error);
    req.flash("error", "Error loading courses");
    res.render("lecturer/courses", {
      title: "My Courses",
      courses: []
    });
  }
});

// Lecturer Students
lecturerRouter.get("/students", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    const students = await dbHelpers.getStudentsByLecturer(lecturerId);
    res.render("lecturer/students", {
      title: "My Students",
      students
    });
  } catch (error) {
    console.error("Lecturer students error:", error);
    req.flash("error", "Error loading students");
    res.render("lecturer/students", {
      title: "My Students",
      students: []
    });
  }
});

// Lecturer Analytics
lecturerRouter.get("/analytics", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    // Implement analytics data retrieval here
    res.render("lecturer/analytics", {
      title: "Class Analytics",
      // analyticsData: {}
    });
  } catch (error) {
    console.error("Lecturer analytics error:", error);
    req.flash("error", "Error loading analytics");
    res.render("lecturer/analytics", {
      title: "Class Analytics",
      // analyticsData: {}
    });
  }
});

// Lecturer Export
lecturerRouter.get("/export", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    res.render("lecturer/export", {
      title: "Export Results"
    });
  } catch (error) {
    console.error("Lecturer export error:", error);
    req.flash("error", "Error loading export page");
    res.render("lecturer/export", {
      title: "Export Results"
    });
  }
});

// Lecturer Attendance
lecturerRouter.get("/attendance", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    res.render("lecturer/attendance", {
      title: "Attendance"
    });
  } catch (error) {
    console.error("Lecturer attendance error:", error);
    req.flash("error", "Error loading attendance page");
    res.render("lecturer/attendance", {
      title: "Attendance"
    });
  }
});

// Lecturer Settings
lecturerRouter.get("/settings", async (req, res) => {
  try {
    const lecturerId = req.session.user.id;
    res.render("lecturer/settings", {
      title: "Settings"
    });
  } catch (error) {
    console.error("Lecturer settings error:", error);
    req.flash("error", "Error loading settings page");
    res.render("lecturer/settings", {
      title: "Settings"
    });
  }
});





// Student Dashboard
studentRouter.get("/dashboard", async (req, res) => {
  try {
    const studentId = req.session.user.id;
    
    // Get student's enrollments and results
    const [enrollments, results] = await Promise.all([
      dbHelpers.getStudentEnrollments(studentId),
      dbHelpers.getResultsByStudent(studentId)
    ]);

    // Calculate statistics
    const stats = {
      totalCourses: enrollments.length,
      totalAssessments: results.length,
      averageScore: results.length > 0 ? 
        (results.reduce((sum, result) => sum + parseFloat(result.percentage || 0), 0) / results.length).toFixed(2) : 0,
      passedAssessments: results.filter(result => parseFloat(result.percentage || 0) >= 40).length
    };

    // Get recent results (last 5)
    const recentResults = results.slice(0, 5);

    // Prepare course performance data for charts
    const coursePerformance = {};
    results.forEach(result => {
      const courseName = result.course?.name || "Unknown Course";
      if (!coursePerformance[courseName]) {
        coursePerformance[courseName] = {
          courseName,
          scores: [],
          averageScore: 0,
          totalAssessments: 0
        };
      }
      coursePerformance[courseName].scores.push(parseFloat(result.percentage || 0));
      coursePerformance[courseName].totalAssessments++;
    });

    // Calculate average scores for each course
    Object.keys(coursePerformance).forEach(courseName => {
      const course = coursePerformance[courseName];
      course.averageScore = course.scores.length > 0 ? 
        (course.scores.reduce((sum, score) => sum + score, 0) / course.scores.length).toFixed(2) : 0;
    });

    res.render("student/dashboard", {
      title: "Student Dashboard",
      stats,
      enrollments,
      recentResults,
      coursePerformance: Object.values(coursePerformance)
    });
  } catch (error) {
    console.error("Student dashboard error:", error);
    req.flash("error", "Error loading dashboard data");
    res.render("student/dashboard", {
      title: "Student Dashboard",
      stats: {},
      enrollments: [],
      recentResults: [],
      coursePerformance: []
    });
  }
});

// Student Results
studentRouter.get("/results", async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const { courseId, assessmentType } = req.query;
    
    let results = await dbHelpers.getResultsByStudent(studentId);

    // Apply filters
    if (courseId && courseId !== "all") {
      results = results.filter(result => result.course_id === courseId);
    }

    if (assessmentType && assessmentType !== "all") {
      results = results.filter(result => result.assessment?.type === assessmentType);
    }

    // Get student's courses for filter dropdown
    const enrollments = await dbHelpers.getStudentEnrollments(studentId);

    // Prepare data for charts
    const chartData = {
      coursePerformance: {},
      assessmentTypes: {},
      monthlyProgress: {}
    };

    results.forEach(result => {
      const courseName = result.course?.name || "Unknown Course";
      const assessmentType = result.assessment?.type || "unknown";
      const month = new Date(result.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short" });
      const score = parseFloat(result.percentage || 0);

      // Course performance data
      if (!chartData.coursePerformance[courseName]) {
        chartData.coursePerformance[courseName] = [];
      }
      chartData.coursePerformance[courseName].push(score);

      // Assessment type data
      if (!chartData.assessmentTypes[assessmentType]) {
        chartData.assessmentTypes[assessmentType] = [];
      }
      chartData.assessmentTypes[assessmentType].push(score);

      // Monthly progress data
      if (!chartData.monthlyProgress[month]) {
        chartData.monthlyProgress[month] = [];
      }
      chartData.monthlyProgress[month].push(score);
    });

    // Calculate averages for chart data
    Object.keys(chartData.coursePerformance).forEach(course => {
      const scores = chartData.coursePerformance[course];
      chartData.coursePerformance[course] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    });

    Object.keys(chartData.assessmentTypes).forEach(type => {
      const scores = chartData.assessmentTypes[type];
      chartData.assessmentTypes[type] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    });

    Object.keys(chartData.monthlyProgress).forEach(month => {
      const scores = chartData.monthlyProgress[month];
      chartData.monthlyProgress[month] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    });

    res.render("student/results", {
      title: "My Results",
      results,
      enrollments,
      chartData,
      filters: { courseId, assessmentType }
    });
  } catch (error) {
    console.error("Student results error:", error);
    req.flash("error", "Error loading results data");
    res.render("student/results", {
      title: "My Results",
      results: [],
      enrollments: [],
      chartData: {},
      filters: {}
    });
  }
});

// View Specific Result
studentRouter.get("/result/:resultId", async (req, res) => {
  try {
    const { resultId } = req.params;
    const studentId = req.session.user.id;

    // Get result details
    const result = await dbHelpers.getResultById ? 
      await dbHelpers.getResultById(resultId) : 
      null;

    if (!result || result.student_id !== studentId) {
      req.flash("error", "Result not found or access denied");
      return res.redirect("/student/results");
    }

    res.render("student/result-detail", {
      title: "Result Details",
      result
    });
  } catch (error) {
    console.error("View result error:", error);
    req.flash("error", "Error loading result details");
    res.redirect("/student/results");
  }
});

// Download Results
studentRouter.get("/download-results", async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const { format = "pdf", courseId } = req.query;
    
    let results = await dbHelpers.getResultsByStudent(studentId);

    // Apply course filter if specified
    if (courseId && courseId !== "all") {
      results = results.filter(result => result.course_id === courseId);
    }

    // Prepare data for export
    const exportData = results.map(result => ({
      "Course": result.course?.name || "Unknown Course",
      "Course Code": result.course?.code || "N/A",
      "Assessment": result.assessment?.title || "Unknown Assessment",
      "Assessment Type": result.assessment?.type || "N/A",
      "Score": result.score || 0,
      "Total Marks": result.assessment?.total_marks || 0,
      "Percentage": `${result.percentage || 0}%`,
      "Grade": result.grade || "N/A",
      "Date": new Date(result.created_at).toLocaleDateString(),
      "Feedback": result.feedback || "No feedback provided"
    }));

    await logAuditEvent(studentId, "RESULTS_DOWNLOADED", "results", null, null, { format, courseId }, req);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=${req.session.user.student_id}_results.json`);
      return res.send(JSON.stringify(exportData, null, 2));
    }

    if (format === "csv") {
      const parser = new Parser();
      const csv = parser.parse(exportData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${req.session.user.student_id}_results.csv`);
      return res.send(csv);
    }

    // Default to PDF (would need PDF generation library)
    req.flash("info", "PDF download feature will be implemented soon. Please use CSV or JSON format for now.");
    res.redirect("/student/results");
  } catch (error) {
    console.error("Download results error:", error);
    req.flash("error", "Error downloading results");
    res.redirect("/student/results");
  }
});

// Student Profile
studentRouter.get("/profile", (req, res) => {
  res.render("student/profile", {
    title: "My Profile",
    student: req.session.user
  });
});

// Update Profile
studentRouter.post("/profile", async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const { phone, address, dateOfBirth, gender } = req.body;

    const updates = {
      phone: phone || null,
      address: address || null,
      date_of_birth: dateOfBirth || null,
      gender: gender || null
    };

    const updatedUser = await dbHelpers.updateUser(studentId, updates);
    
    // Update session
    req.session.user = { ...req.session.user, ...updates };

    await logAuditEvent(studentId, "PROFILE_UPDATED", "users", studentId, null, updates, req);

    req.flash("success", "Profile updated successfully");
    res.redirect("/student/profile");
  } catch (error) {
    console.error("Update profile error:", error);
    req.flash("error", "Error updating profile");
    res.redirect("/student/profile");
  }
});

// View Course Details
studentRouter.get("/course/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.session.user.id;

    // Check if student is enrolled in the course
    const enrollments = await dbHelpers.getStudentEnrollments(studentId);
    const enrollment = enrollments.find(e => e.course_id === courseId);

    if (!enrollment) {
      req.flash("error", "You are not enrolled in this course");
      return res.redirect("/student/dashboard");
    }

    // Get course details
    const course = await dbHelpers.getCourseById(courseId);
    
    // Get student's results for this course
    const allResults = await dbHelpers.getResultsByStudent(studentId);
    const courseResults = allResults.filter(result => result.course_id === courseId);

    res.render("student/course-detail", {
      title: `Course: ${course.name}`,
      course,
      enrollment,
      results: courseResults
    });
  } catch (error) {
    console.error("View course error:", error);
    req.flash("error", "Error loading course details");
    res.redirect("/student/dashboard");
  }
});

// Student Courses
studentRouter.get("/courses", async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const enrollments = await dbHelpers.getStudentEnrollments(studentId);

    res.render("student/courses", {
      title: "My Courses",
      enrollments
    });
  } catch (error) {
    console.error("Student courses error:", error);
    req.flash("error", "Error loading courses");
    res.render("student/courses", {
      title: "My Courses",
      enrollments: []
    });
  }
});

// Performance Analytics
studentRouter.get("/analytics", async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const results = await dbHelpers.getResultsByStudent(studentId);

    // Prepare comprehensive analytics data
    const analytics = {
      overallPerformance: {
        totalAssessments: results.length,
        averageScore: results.length > 0 ? 
          (results.reduce((sum, r) => sum + parseFloat(r.percentage || 0), 0) / results.length).toFixed(2) : 0,
        highestScore: results.length > 0 ? Math.max(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0,
        lowestScore: results.length > 0 ? Math.min(...results.map(r => parseFloat(r.percentage || 0))).toFixed(2) : 0
      },
      courseBreakdown: {},
      assessmentTypeBreakdown: {},
      performanceTrend: [],
      gradeDistribution: { A: 0, B: 0, C: 0}
    };

    // Process results for analytics
    results.forEach(result => {
      const courseName = result.course?.name || "Unknown";
      const assessmentType = result.assessment?.type || "unknown";
      const percentage = parseFloat(result.percentage || 0);
      const date = new Date(result.created_at);

      // Course breakdown
      if (!analytics.courseBreakdown[courseName]) {
        analytics.courseBreakdown[courseName] = { scores: [], count: 0, average: 0 };
      }
      analytics.courseBreakdown[courseName].scores.push(percentage);
      analytics.courseBreakdown[courseName].count++;

      // Assessment type breakdown
      if (!analytics.assessmentTypeBreakdown[assessmentType]) {
        analytics.assessmentTypeBreakdown[assessmentType] = { scores: [], count: 0, average: 0 };
      }
      analytics.assessmentTypeBreakdown[assessmentType].scores.push(percentage);
      analytics.assessmentTypeBreakdown[assessmentType].count++;

      // Performance trend
      analytics.performanceTrend.push({
        date: date.toISOString().split("T")[0],
        score: percentage,
        course: courseName
      });

      // Grade distribution
      if (percentage >= 90) analytics.gradeDistribution.A++;
      else if (percentage >= 80) analytics.gradeDistribution.B++;
      else if (percentage >= 70) analytics.gradeDistribution.C++;
      else if (percentage >= 60) analytics.gradeDistribution.D++;
      else analytics.gradeDistribution.F++;
    });

    // Calculate averages
    Object.keys(analytics.courseBreakdown).forEach(course => {
      const data = analytics.courseBreakdown[course];
      data.average = (data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length).toFixed(2);
    });

    Object.keys(analytics.assessmentTypeBreakdown).forEach(type => {
      const data = analytics.assessmentTypeBreakdown[type];
      data.average = (data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length).toFixed(2);
    });

    // Sort performance trend by date
    analytics.performanceTrend.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.render("student/analytics", {
      title: "Performance Analytics",
      analytics
    });
  } catch (error) {
    console.error("Student analytics error:", error);
    req.flash("error", "Error loading analytics data");
    res.render("student/analytics", {
      title: "Performance Analytics",
      analytics: {}
    });
  }
});





module.exports = studentRouter;



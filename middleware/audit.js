const { supabase } = require('../config/database');

// Audit logger middleware
const auditLogger = (req, res, next) => {
  // Skip audit logging for static files and health checks
  if (req.path.startsWith('/css') || 
      req.path.startsWith('/js') || 
      req.path.startsWith('/images') || 
      req.path.startsWith('/uploads') ||
      req.path === '/health' ||
      req.path === '/favicon.ico') {
    return next();
  }

  // Store original end function
  const originalEnd = res.end;

  // Override end function to log after response
  res.end = function(chunk, encoding) {
    // Call original end function
    originalEnd.call(this, chunk, encoding);

    // Log the activity asynchronously
    setImmediate(() => {
      logActivity(req, res);
    });
  };

  next();
};

// Log activity to database
const logActivity = async (req, res) => {
  try {
    // Skip logging for GET requests to view pages (too verbose)
    if (req.method === 'GET' && res.statusCode === 200) {
      return;
    }

    // Skip logging for failed authentication attempts (handled separately)
    if (req.path === '/auth/login' && res.statusCode === 302) {
      return;
    }

    const logData = {
      user_id: req.session?.user?.id || null,
      action: `${req.method} ${req.path}`,
      table_name: extractTableName(req.path),
      record_id: extractRecordId(req),
      old_values: req.body && Object.keys(req.body).length > 0 ? req.body : null,
      new_values: null, // This would need to be set by individual routes
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent') || null
    };

    // Only log significant actions
    if (shouldLogAction(req, res)) {
      await supabase
        .from('audit_logs')
        .insert(logData);
    }
  } catch (error) {
    console.error('Error logging audit activity:', error);
    // Don't throw error to avoid breaking the application
  }
};

// Determine if action should be logged
const shouldLogAction = (req, res) => {
  const significantMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const significantPaths = ['/auth/', '/admin/', '/lecturer/', '/student/'];
  
  // Log all non-GET requests
  if (significantMethods.includes(req.method)) {
    return true;
  }

  // Log access to significant paths
  if (significantPaths.some(path => req.path.startsWith(path))) {
    return true;
  }

  // Log error responses
  if (res.statusCode >= 400) {
    return true;
  }

  return false;
};

// Extract table name from request path
const extractTableName = (path) => {
  const pathSegments = path.split('/').filter(segment => segment);
  
  if (pathSegments.length < 2) return null;

  const tableMap = {
    'users': 'users',
    'courses': 'courses',
    'assessments': 'assessments',
    'results': 'results',
    'enrollments': 'enrollments'
  };

  // Check for table names in path
  for (const segment of pathSegments) {
    if (tableMap[segment]) {
      return tableMap[segment];
    }
  }

  return null;
};

// Extract record ID from request
const extractRecordId = (req) => {
  // Try to get ID from URL parameters
  if (req.params.id) return req.params.id;
  if (req.params.userId) return req.params.userId;
  if (req.params.courseId) return req.params.courseId;
  if (req.params.assessmentId) return req.params.assessmentId;
  if (req.params.resultId) return req.params.resultId;

  // Try to get ID from request body
  if (req.body.id) return req.body.id;
  if (req.body.userId) return req.body.userId;
  if (req.body.courseId) return req.body.courseId;
  if (req.body.assessmentId) return req.body.assessmentId;
  if (req.body.resultId) return req.body.resultId;

  return null;
};

// Get client IP address
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         '127.0.0.1';
};

// Manual audit logging function for specific actions
const logAuditEvent = async (userId, action, tableName = null, recordId = null, oldValues = null, newValues = null, req = null) => {
  try {
    const logData = {
      user_id: userId,
      action: action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req ? getClientIP(req) : null,
      user_agent: req ? req.get('User-Agent') : null
    };

    await supabase
      .from('audit_logs')
      .insert(logData);
  } catch (error) {
    console.error('Error logging manual audit event:', error);
  }
};

// Log authentication events
const logAuthEvent = async (email, action, success, req, reason = null) => {
  try {
    const logData = {
      user_id: null, // We might not have user ID for failed logins
      action: `AUTH_${action.toUpperCase()}_${success ? 'SUCCESS' : 'FAILED'}`,
      table_name: 'users',
      record_id: null,
      old_values: { email, reason },
      new_values: null,
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent') || null
    };

    await supabase
      .from('audit_logs')
      .insert(logData);
  } catch (error) {
    console.error('Error logging auth event:', error);
  }
};

// Log data export events
const logExportEvent = async (userId, exportType, filters, req) => {
  try {
    const logData = {
      user_id: userId,
      action: `EXPORT_${exportType.toUpperCase()}`,
      table_name: null,
      record_id: null,
      old_values: { filters },
      new_values: null,
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent') || null
    };

    await supabase
      .from('audit_logs')
      .insert(logData);
  } catch (error) {
    console.error('Error logging export event:', error);
  }
};

// Get audit logs with pagination
const getAuditLogs = async (page = 1, limit = 50, filters = {}) => {
  try {
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        user:users(first_name, last_name, email, role)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.action) {
      query = query.ilike('action', `%${filters.action}%`);
    }

    if (filters.tableName) {
      query = query.eq('table_name', filters.tableName);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    throw error;
  }
};

module.exports = {
  auditLogger,
  logAuditEvent,
  logAuthEvent,
  logExportEvent,
  getAuditLogs
};


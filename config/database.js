const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client for general operations
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Create admin client for administrative operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database helper functions - Use service role for server operations
const dbHelpers = {
  // User operations - Using service role to bypass RLS
  async createUser(userData) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserById(userId) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserByEmail(email) {
    console.log('Looking up user by email:', email);
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    console.log('getUserByEmail result:', { data, error });
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error in getUserByEmail:', error);
      throw error;
    }
    return data;
  },

  async updateUser(userId, updates) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getAllUsers() {
    console.log('Querying users table...');
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*');
    
    if (error) {
      console.error('Error querying users:', error);
      throw error;
    }
    
    console.log('Raw query result:', { data, error });
    return data || [];
  },

  // User approval operations
  async getPendingUsers() {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async approveUser(userId, approvedBy) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        approval_status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async rejectUser(userId, rejectionReason, rejectedBy) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        approval_status: 'rejected',
        approved_by: rejectedBy,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUsersByRole(role) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', role)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getApprovedUsersByRole(role) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', role)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Course operations
  async createCourse(courseData) {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .insert(courseData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getAllCourses() {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select(`
        *,
        lecturer:users!courses_lecturer_id_fkey(id, first_name, last_name, email)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getCourseById(courseId) {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select(`
        *,
        lecturer:users!courses_lecturer_id_fkey(id, first_name, last_name, email)
      `)
      .eq('id', courseId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateCourse(courseId, updates) {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .update(updates)
      .eq('id', courseId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteCourse(courseId) {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('id', courseId);
    
    if (error) throw error;
    return data;
  },

  // Assessment operations
  async createAssessment(assessmentData) {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .insert(assessmentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getAssessmentsByLecturer(lecturerId) {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select(`
        *,
        course:courses(id, name, code),
        lecturer:users!assessments_lecturer_id_fkey(id, first_name, last_name)
      `)
      .eq('lecturer_id', lecturerId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getAssessmentById(assessmentId) {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select(`
        *,
        course:courses(id, name, code),
        lecturer:users!assessments_lecturer_id_fkey(id, first_name, last_name)
      `)
      .eq('id', assessmentId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateAssessment(assessmentId, updates) {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .update(updates)
      .eq('id', assessmentId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Result operations
  async createResult(resultData) {
    const { data, error } = await supabaseAdmin
      .from('results')
      .insert(resultData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getResultsByStudent(studentId) {
    const { data, error } = await supabaseAdmin
      .from('results')
      .select(`
        *,
        assessment:assessments(id, title, total_marks, type),
        course:courses(id, name, code),
        student:users!results_student_id_fkey(id, first_name, last_name, student_id)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getResultsByAssessment(assessmentId) {
    const { data, error } = await supabaseAdmin
      .from('results')
      .select(`
        *,
        student:users!results_student_id_fkey(id, first_name, last_name, student_id),
        assessment:assessments(id, title, total_marks, type)
      `)
      .eq('assessment_id', assessmentId)
      .order('score', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async updateResult(resultId, updates) {
    const { data, error } = await supabaseAdmin
      .from('results')
      .update(updates)
      .eq('id', resultId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Enrollment operations
  async enrollStudent(enrollmentData) {
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .insert(enrollmentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getStudentEnrollments(studentId) {
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select(`
        *,
        course:courses(id, name, code, description),
        lecturer:users!courses_lecturer_id_fkey(id, first_name, last_name)
      `)
      .eq('student_id', studentId)
      .eq('status', 'active');
    
    if (error) throw error;
    return data;
  },

  async getCourseEnrollments(courseId) {
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select(`
        *,
        student:users!enrollments_student_id_fkey(id, first_name, last_name, student_id, email)
      `)
      .eq('course_id', courseId)
      .eq('status', 'active');
    
    if (error) throw error;
    return data;
  },

  
  // Notification operations
  async createNotification(notificationData) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert(notificationData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getNotificationsByUserId(userId) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getAdminNotifications() {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .is("user_id", null) // Notifications for all admins
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async markNotificationAsRead(notificationId) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteNotification(notificationId) {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", notificationId);
    
    if (error) throw error;
    return data;
  },

  // Additional missing functions
  async getAllAssessments() {
    const { data, error } = await supabaseAdmin
      .from('assessments')
      .select(`
        *,
        course:courses(id, name, code),
        lecturer:users!assessments_lecturer_id_fkey(id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getAllResults() {
    const { data, error } = await supabaseAdmin
      .from('results')
      .select(`
        *,
        student:users!results_student_id_fkey(id, first_name, last_name, student_id),
        assessment:assessments(id, title, total_marks, type),
        course:courses(id, name, code)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getResultById(resultId) {
    const { data, error } = await supabaseAdmin
      .from('results')
      .select(`
        *,
        student:users!results_student_id_fkey(id, first_name, last_name, student_id),
        assessment:assessments(id, title, total_marks, type),
        course:courses(id, name, code)
      `)
      .eq('id', resultId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getStudentsByLecturer(lecturerId) {
    // First get courses taught by the lecturer
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('lecturer_id', lecturerId);
    
    if (coursesError) throw coursesError;
    
    if (!courses || courses.length === 0) {
      return [];
    }
    
    const courseIds = courses.map(course => course.id);
    
    // Then get enrollments for those courses
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select(`*,
        student:users!enrollments_student_id_fkey(id, first_name, last_name, student_id, email),
        course:courses(id, name, code)`
        
      )
      .in('course_id', courseIds)
      .eq('status', 'active');
    
    if (error) throw error;
    return data;
  },

  async getAllSystemSettings() {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  async updateSystemSetting(key, value) {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getAuditLogsCount(user, action, table) {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact', head: true });

    if (user) {
      query = query.eq('user_id', user);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (table) {
      query = query.eq('table_name', table);
    }

    const { count, error } = await query;
    
    if (error) throw error;
    return count;
  },
};

module.exports = {
  supabaseAdmin,
  supabaseAdmin,
  dbHelpers
};




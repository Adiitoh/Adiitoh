-- 1. Users table (stores all users: admin, lecturers, students)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'lecturer', 'student')),
    student_id VARCHAR(50) UNIQUE, -- Only for students
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Courses table
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    lecturer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    credit_hours INTEGER DEFAULT 3,
    semester VARCHAR(20),
    academic_year VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enrollments table (many-to-many relationship between students and courses)
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
    grade VARCHAR(5),
    gpa DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

-- 4. Assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lecturer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('CA', 'assignment', 'exam', 'project', 'presentation')),
    total_marks INTEGER NOT NULL DEFAULT 100,
    passing_marks INTEGER NOT NULL DEFAULT 40,
    due_date TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER, -- For timed assessments
    instructions TEXT,
    is_published BOOLEAN DEFAULT false,
    allow_late_submission BOOLEAN DEFAULT false,
    late_penalty_percent DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Results table
CREATE TABLE IF NOT EXISTS results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL,
    percentage DECIMAL(5,2), -- Calculated in application to avoid subqueries in schema
    grade VARCHAR(5),
    feedback TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    graded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    graded_by UUID REFERENCES users(id),
    is_late BOOLEAN DEFAULT false,
    attempt_number INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, assessment_id, attempt_number)
);

-- 6. System settings table (for admin configurations)
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Audit logs table (for tracking system activities)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer_id ON courses(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_assessments_course_id ON assessments(course_id);
CREATE INDEX IF NOT EXISTS idx_assessments_lecturer_id ON assessments(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_results_student_id ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_assessment_id ON results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_results_course_id ON results(course_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update updated_at automatically
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users policies
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid()::text = id::text OR EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role IN ('admin', 'lecturer', 'student')));
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text OR EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "Admins can insert users" ON users FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Courses policies
CREATE POLICY "Everyone can view active courses" ON courses FOR SELECT USING (is_active = true);
CREATE POLICY "Lecturers can view their courses" ON courses FOR SELECT USING (lecturer_id::text = auth.uid()::text);
CREATE POLICY "Admins can manage all courses" ON courses FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "Lecturers can update their courses" ON courses FOR UPDATE USING (lecturer_id::text = auth.uid()::text);

-- Enrollments policies
CREATE POLICY "Students can view their enrollments" ON enrollments FOR SELECT USING (student_id::text = auth.uid()::text);
CREATE POLICY "Lecturers can view enrollments for their courses" ON enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM courses WHERE id = course_id AND lecturer_id::text = auth.uid()::text));
CREATE POLICY "Admins can manage all enrollments" ON enrollments FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Assessments policies
CREATE POLICY "Students can view published assessments for their courses" ON assessments FOR SELECT USING (is_published = true AND EXISTS (SELECT 1 FROM enrollments WHERE student_id::text = auth.uid()::text AND course_id = assessments.course_id AND status = 'active'));
CREATE POLICY "Lecturers can manage their assessments" ON assessments FOR ALL USING (lecturer_id::text = auth.uid()::text);
CREATE POLICY "Admins can view all assessments" ON assessments FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Results policies
CREATE POLICY "Students can view their own results" ON results FOR SELECT USING (student_id::text = auth.uid()::text);
CREATE POLICY "Lecturers can view results for their assessments" ON results FOR SELECT USING (EXISTS (SELECT 1 FROM assessments WHERE id = assessment_id AND lecturer_id::text = auth.uid()::text));
CREATE POLICY "Lecturers can manage results for their assessments" ON results FOR ALL USING (EXISTS (SELECT 1 FROM assessments WHERE id = assessment_id AND lecturer_id::text = auth.uid()::text));
CREATE POLICY "Admins can view all results" ON results FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- System settings policies
CREATE POLICY "Only admins can manage system settings" ON system_settings FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Audit logs policies
CREATE POLICY "Only admins can view audit logs" ON audit_logs FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('app_name', 'Student Assessment Tracker', 'Application name'),
('academic_year', '2026/27', 'Current academic year'),
('semester', 'First Semester', 'Second semester'),
('max_login_attempts', '5', 'Maximum login attempts before lockout'),
('lockout_duration', '15', 'Account lockout duration in minutes'),
('grade_scale', 'A,B,C,D', 'Grading scale'),
('passing_grade', '50', 'Minimum passing percentage'),
('allow_late_submissions', 'true', 'Allow late submissions globally')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default admin user (password: admin123 - change this!)
-- Note: You'll need to hash the password in your application
INSERT INTO users (email, password_hash, first_name, last_name, role, approval_status, approved_at) VALUES
('brandonadii39@gmail.com', '$2a$12$kwpl92vFQmB0n1hnyvWHre91YRPTd.GBMv5vwwM2Ypz8epVob9Kp2', 'System', 'Administrator', 'admin', 'approved', NOW())
ON CONFLICT (email) DO NOTHING;


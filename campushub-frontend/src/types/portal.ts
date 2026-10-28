export interface ApiPage<T> {
  count: number;
  next: string | number | null;
  previous: string | number | null;
  results: T[];
}

export interface CourseRosterEntry {
  id: number;
  student_id: number;
  student_name: string;
  admission_number: string | null;
  student_email: string;
  status: string;
  enrolled_at: string;
}

export interface DirectoryUser {
  id: number;
  first_name: string;
  last_name: string;
  admission_number?: string | null;
  email: string;
  username: string;
  role: 'student' | 'lecturer' | 'officer' | 'admin';
  department: number | string | { name?: string } | null;
  department_name?: string | null;
  school_name?: string | null;
  programme_id?: number | null;
  programme_code?: string | null;
  programme_title?: string | null;
  programme_status?: 'active' | 'completed' | null;
  gpa?: string | null;
  phone_number?: string;
  title?: string;
  bio?: string;
  office_hours?: string;
  is_active: boolean;
  date_joined: string;
}

export interface Lecturer extends DirectoryUser {
  title?: string;
  bio?: string;
  office_hours?: string;
  courses?: string[] | { id: number; name: string }[];
}

export interface Placement {
  id: number;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string;
  deadline: string;
  slots_available: number;
  application_count?: number;
  status?: string;
  is_active?: boolean;
  posted_by?: { id: number; name: string } | null;
}

export interface AdminStats {
  active_users: number;
  students: number;
  lecturers: number;
  placement_officers: number;
  schools: number;
  departments: number;
  courses: number;
  units: number;
  active_enrollments: number;
  placements: number;
  applications: number;
  open_placements: number;
  pending_applications: number;
}

export interface Notification {
  id: number;
  verb: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  actor: { id: number; name: string } | null;
}

export interface Enrollment {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  status: 'active' | 'dropped' | 'completed' | string;
  enrolled_at: string;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  department_id: number;
  department_name?: string;
  school_id?: number;
  school_code?: string;
  school_name?: string;
  lecturer_id: number | null;
  lecturer_ids?: number[];
  units?: { id: number; offering_id: number; code: string; title: string; lecturers: { id: number; name: string }[] }[];
  lecturer?: LecturerProfile | null;
  credits: number;
  description?: string;
  is_active: boolean;
}

export interface School {
  id: number;
  name: string;
  code: string;
  department_count: number;
}

export interface AcademicUnit {
  id: number;
  code: string;
  title: string;
  credits: number;
  description: string;
  is_active: boolean;
  department_ids: number[];
  departments: { id: number; code: string; name: string }[];
  course_ids: number[];
  offerings: {
    offering_id: number;
    course_id: number;
    course_code: string;
    course_title: string;
    is_active: boolean;
    lecturers: { id: number; name: string }[];
  }[];
}

export interface LecturerProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  title?: string;
  office_hours?: string;
}

export interface CourseResource {
  id: number;
  title: string;
  description?: string;
  category?: 'introduction' | 'notes' | 'topic' | 'assignment' | string;
  unit_id?: number | null;
  unit_code?: string | null;
  file_url?: string | null;
  file_size?: number;
  file_type?: string;
  created_at?: string;
  uploaded_by?: string;
}

export interface CourseAnnouncement {
  id: number;
  title: string;
  body: string;
  is_pinned?: boolean;
  created_at: string;
  author?: string;
  unit_id?: number | null;
  unit_code?: string | null;
}

export interface UnitAssignment {
  id: number;
  offering_id: number;
  unit_id: number;
  unit_code: string;
  unit_title: string;
  course_id: number;
  course_code: string;
  course_title: string;
  title: string;
  instructions: string;
  assignment_type: 'file' | 'quiz';
  allowed_file_types: string[];
  questions: AssignmentQuestion[];
  due_at: string;
  max_points: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignmentQuestion {
  id: number;
  prompt: string;
  options: string[];
  correct_option?: number;
}

export interface AssignmentSubmission {
  id: number;
  submitted_at: string;
  file_name: string | null;
  score: string | null;
  feedback: string;
  graded_at: string | null;
}

export interface ClassSession {
  id: number;
  offering_id: number;
  unit_code: string;
  unit_title: string;
  course_id: number;
  course_code: string;
  course_title: string;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  starts_on: string;
  ends_on: string;
  location: string;
}

export interface CalendarEvent {
  id: string;
  kind: 'class' | 'assignment';
  title: string;
  unit_code: string;
  offering_id: number;
  date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  due_at: string | null;
}

export interface UnitGroupSet {
  offering_id: number;
  naming_scheme: 'letters' | 'numbers';
  students_per_group: number;
  groups: {
    id: number;
    name: string;
    students: { id: number; name: string; admission_number?: string | null }[];
  }[];
}

export interface StudentApplication {
  id: number;
  status: 'pending' | 'shortlisted' | 'accepted' | 'rejected' | string;
  applied_at: string;
  cover_note?: string;
  cv_file?: string | null;
  student?: { id: number; first_name: string; last_name: string; email?: string };
  placement?: Pick<Placement, 'id' | 'title' | 'company'>;
  placement_title?: string;
  company?: string;
}

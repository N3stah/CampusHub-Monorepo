export interface ApiPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DirectoryUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  role: 'student' | 'lecturer' | 'officer' | 'admin';
  department: number | string | { name?: string } | null;
  gpa?: string | null;
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
  deadline: string;
  status: string;
  is_active?: boolean;
  is_remote?: boolean;
  placement_type?: string;
  requirements?: string;
  posted_by?: { id: number; name: string } | null;
}

export interface AdminStats {
  active_users: number;
  lecturers: number;
  open_placements: number;
  pending_applications: number;
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
  lecturer_id: number | null;
  lecturer?: LecturerProfile | null;
  credits: number;
  description?: string;
  is_active: boolean;
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
  file_url?: string;
  file_type?: string;
  file_size?: number;
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
}

export interface StudentApplication {
  id: number;
  status: 'pending' | 'shortlisted' | 'accepted' | 'rejected' | string;
  applied_at: string;
  student?: { id: number; first_name: string; last_name: string; email?: string };
  placement?: Pick<Placement, 'id' | 'title' | 'company'>;
  placement_title?: string;
  company?: string;
}

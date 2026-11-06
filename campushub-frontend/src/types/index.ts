export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  admission_number?: string | null;
  full_name?: string;
  role: CampusRole;
  department: number | null;
  gpa: string | null;
  is_active: boolean;
  date_joined: string;
  phone_number?: string;
  title?: string;
  bio?: string;
  office_hours?: string;
}

export type CampusRole =
  | 'student'
  | 'lecturer'
  | 'officer'
  | 'admin'
  | 'registrar'
  | 'finance'
  | 'hod'
  | 'examination'
  | 'librarian'
  | 'hostel';

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ApiError {
  detail?: string;
  [field: string]: string | string[] | undefined;
}

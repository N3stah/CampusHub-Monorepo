export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  role: 'student' | 'lecturer' | 'officer' | 'admin';
  department: number | null;
  gpa: string | null;
  is_active: boolean;
  date_joined: string;
  phone_number?: string;
  title?: string;
  bio?: string;
  office_hours?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ApiError {
  detail?: string;
  [field: string]: string | string[] | undefined;
}

export interface User {
  username: string,
  token: string,
  isAdmin?: boolean
}

export interface CurrentUser {
  username: string;
  isAdmin: boolean;
}

export interface RegistrationStatus {
  enabled: boolean;
}


export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

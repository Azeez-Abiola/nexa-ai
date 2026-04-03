# UACN GPT - Resend Email Service Integration Guide

## Overvie

This guide covers the implementation of Resend email service for UACN GPT, including:
- **Email Verification** during user registration
- **Forgot Password** functionality
- **Email Verification** resend capability

## Setup Instructions

### 1. Get Your Resend API Key

1. Visit [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Navigate to API Keys section
4. Copy your API key

### 2. Environment Variables

Add these variables to your `.env` file in the root directory:

```env
# Resend Email Service
RESEND_API_KEY=your_resend_api_key_here
FROM_EMAIL=noreply@uflgpt.com
FRONTEND_URL=http://0.0.0.0:3000
```

**Note**: Update `FROM_EMAIL` to match your verified sender domain in Resend or use the default Resend domain.

### 3. Database Model Updates

The User model has been updated with the following new fields:

```typescript
- emailVerified: boolean (default: false)
- emailVerificationToken: string (token for email verification)
- emailVerificationTokenExpiry: Date (24-hour expiry)
- resetToken: string (password reset token - existing)
- resetTokenExpiry: Date (1-hour expiry - existing)
```

### 4. Install Resend Package

Already installed via npm. If needed:
```bash
npm install resend
```

## API Endpoints

### Authentication Endpoints

#### 1. **Register (with Email Verification)**
- **Endpoint**: `POST /api/auth/register`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "fullName": "John Doe",
  "businessUnit": "GCL"
}
```
- **Response** (201):
```json
{
  "message": "Account created successfully. Please check your email to verify your account.",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "businessUnit": "GCL",
    "emailVerified": false
  }
}
```
- **Behavior**: 
  - Creates user account with `emailVerified: false`
  - Sends verification email with 24-hour valid link
  - User must verify email before login

---

#### 2. **Verify Email**
- **Endpoint**: `POST /api/auth/verify-email`
- **Body**:
```json
{
  "token": "verification_token_from_email_link"
}
```
- **Response** (200):
```json
{
  "message": "Email verified successfully! You can now login."
}
```
- **Behavior**:
  - Validates token (must not be expired)
  - Sets `emailVerified: true`
  - Clears verification token
  - Sends welcome email

---

#### 3. **Resend Verification Email**
- **Endpoint**: `POST /api/auth/resend-verification`
- **Body**:
```json
{
  "email": "user@example.com"
}
```
- **Response** (200):
```json
{
  "message": "Verification email sent. Please check your inbox."
}
```
- **Behavior**:
  - Resends verification email if not already verified
  - Updates token expiry to 24 hours from now
  - Safe to call multiple times

---

#### 4. **Login (with Email Verification Check)**
- **Endpoint**: `POST /api/auth/login`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```
- **Response - Success** (200):
```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "businessUnit": "GCL",
    "emailVerified": true
  }
}
```
- **Response - Email Not Verified** (403):
```json
{
  "error": "Please verify your email before logging in",
  "requiresVerification": true,
  "email": "user@example.com"
}
```
- **Behavior**:
  - Checks if email is verified
  - Returns error if email not verified (with flag for frontend handling)
  - Returns JWT token and user data on success

---

#### 5. **Forgot Password**
- **Endpoint**: `POST /api/auth/forgot-password`
- **Body**:
```json
{
  "email": "user@example.com"
}
```
- **Response** (200):
```json
{
  "message": "If an account exists with this email, a reset link will be sent shortly"
}
```
- **Behavior**:
  - Generates secure reset token (32-byte random)
  - Valid for 1 hour
  - Sends password reset email via Resend
  - Returns generic message for security (doesn't reveal if email exists)

---

#### 6. **Reset Password**
- **Endpoint**: `POST /api/auth/reset-password`
- **Body**:
```json
{
  "token": "reset_token_from_email_link",
  "email": "user@example.com",
  "newPassword": "newpassword123"
}
```
- **Response** (200):
```json
{
  "message": "Password reset successfully. You can now login with your new password."
}
```
- **Response - Invalid Token** (400):
```json
{
  "error": "Reset token is invalid or has expired"
}
```
- **Behavior**:
  - Validates token (must not be expired)
  - Hashes new password
  - Clears reset token
  - User can login immediately with new password

---

## Email Templates

### 1. Email Verification Email
- **Subject**: "Verify Your UACN GPT Email Address"
- **Expires**: 24 hours
- **Link**: `{FRONTEND_URL}/verify-email?token={token}`
- **Content**: Welcome message with CTA button

### 2. Password Reset Email
- **Subject**: "Reset Your UACN GPT Password"
- **Expires**: 1 hour
- **Link**: `{FRONTEND_URL}/reset-password?token={token}`
- **Content**: Password reset instructions with CTA button

### 3. Welcome Email
- **Subject**: "Welcome to UACN GPT - Your Account is Active!"
- **Sent**: After successful email verification
- **Content**: Welcome message with dashboard link

## Frontend Integration Examples

### TypeScript/React Integration

```typescript
// types/auth.ts
export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  businessUnit: 'GCL' | 'LSF' | 'CAP' | 'UFL' | 'CHI' | 'UAC-Restaurants' | 'UPDC';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  email: string;
  newPassword: string;
}
```

```typescript
// services/authService.ts
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://0.0.0.0:5000/api';

const authAPI = axios.create({
  baseURL: `${API_URL}/auth`,
});

export const authService = {
  register: (data: RegisterRequest) => 
    authAPI.post('/register', data),
  
  login: (data: LoginRequest) => 
    authAPI.post('/login', data),
  
  verifyEmail: (token: string) => 
    authAPI.post('/verify-email', { token }),
  
  resendVerification: (email: string) => 
    authAPI.post('/resend-verification', { email }),
  
  forgotPassword: (email: string) => 
    authAPI.post('/forgot-password', { email }),
  
  resetPassword: (token: string, email: string, newPassword: string) => 
    authAPI.post('/reset-password', { token, email, newPassword }),
};
```

### Registration Flow

```typescript
// Register
const handleRegister = async (data: RegisterRequest) => {
  try {
    const response = await authService.register(data);
    alert('Account created! Please check your email to verify.');
    // Redirect to verification pending page
  } catch (error) {
    alert(error.response?.data?.error || 'Registration failed');
  }
};

// Verify Email from URL
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  
  if (token) {
    const verifyEmail = async () => {
      try {
        await authService.verifyEmail(token);
        alert('Email verified successfully! You can now login.');
        // Redirect to login
      } catch (error) {
        alert(error.response?.data?.error || 'Verification failed');
      }
    };
    
    verifyEmail();
  }
}, []);
```

### Login Flow

```typescript
const handleLogin = async (credentials: LoginRequest) => {
  try {
    const response = await authService.login(credentials);
    localStorage.setItem('token', response.data.token);
    // Redirect to dashboard
  } catch (error) {
    if (error.response?.status === 403 && error.response?.data?.requiresVerification) {
      // Redirect to verification pending page
      alert('Please verify your email first. Check your inbox!');
    } else {
      alert(error.response?.data?.error || 'Login failed');
    }
  }
};
```

### Forgot Password Flow

```typescript
// Step 1: Request password reset
const handleForgotPassword = async (email: string) => {
  try {
    await authService.forgotPassword(email);
    alert('Check your email for password reset instructions');
    // Hide form or redirect
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to send reset email');
  }
};

// Step 2: Reset password from email link
const handleResetPassword = async (newPassword: string) => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const email = params.get('email');
  
  try {
    await authService.resetPassword(token, email, newPassword);
    alert('Password reset successfully! Please login with your new password.');
    // Redirect to login
  } catch (error) {
    alert(error.response?.data?.error || 'Password reset failed');
  }
};
```

### Resend Verification

```typescript
const handleResendVerification = async (email: string) => {
  try {
    const response = await authService.resendVerification(email);
    alert(response.data.message);
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to resend verification');
  }
};
```

## Security Considerations

1. **Token Generation**: Uses cryptographically secure random bytes (32 bytes)
2. **Token Storage**: Hashed in database using SHA-256
3. **Token Expiry**: 
   - Email verification: 24 hours
   - Password reset: 1 hour
4. **Password Requirements**: Minimum 6 characters (consider enforcing stronger requirements)
5. **Email Verification**: Required before login
6. **Generic Error Messages**: Forgotpassword doesn't reveal if email exists

## Testing

### Using Resend Testing Environment

Resend provides test email addresses for development:
- Use any email with format: `delivered@resend.dev`, `bounce@resend.dev`, etc.
- See Resend documentation for all test scenarios

### Manual Testing Checklist

- [ ] User can register with email verification
- [ ] Verification email is received
- [ ] Verification link works and email becomes verified
- [ ] User cannot login until email is verified
- [ ] User can login after verification
- [ ] Welcome email is sent after verification
- [ ] User can request password reset
- [ ] Password reset email is received
- [ ] Password reset link works
- [ ] Password is updated successfully
- [ ] User can login with new password
- [ ] User can resend verification email
- [ ] Expired tokens are rejected

## Troubleshooting

### Email Not Sending

1. Check `RESEND_API_KEY` is correct in `.env`
2. Check `FROM_EMAIL` is verified in Resend dashboard
3. Check network logs for API errors
4. Review Resend logs in dashboard

### Token Errors

1. Ensure frontend passes exact token from URL
2. Check token hasn't expired
3. Verify email matches between request and token

### Login Issues

1. Verify email field shows `emailVerified: false` in DB
2. Check verification token expiry in DB
3. Ensure welcome page redirects unverified users correctly

## Future Enhancements

1. **Email Templates**: Move to dedicated template system (e.g., React Email)
2. **Webhook Support**: Handle bounce/complaint events from Resend
3. **Rate Limiting**: Prevent email spam (e.g., max 5 verification emails per hour)
4. **Email Preferences**: Allow users to update communication preferences
5. **Multi-language**: Support email templates in multiple languages
6. **Two-Factor Authentication**: Add 2FA with email OTP

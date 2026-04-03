# UACN GPT - Frontend Implementation Guide for Email Service

## Quick Start - Frontend Pages Needed

You'll need to create these frontend pages/components to work with the new email service:

## 1. Registration Page

Update your existing registration page to handle email verification:

```typescript
// pages/Register.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    businessUnit: 'GCL'
  });
  const [error, setError] = useState('');

  const businessUnits = ['GCL', 'LSF', 'CAP', 'UFL', 'CHI', 'UAC-Restaurants', 'UPDC'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.register(formData);
      // Redirect to verification pending page
      navigate('/verify-email-pending', { 
        state: { email: formData.email } 
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h2>Create UACN GPT Account</h2>
      {error && <div className="alert alert-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name *</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Business Unit *</label>
          <select
            name="businessUnit"
            value={formData.businessUnit}
            onChange={handleChange}
            required
          >
            {businessUnits.map(bu => (
              <option key={bu} value={bu}>{bu}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Password *</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            minLength={6}
            required
          />
          <small>At least 6 characters</small>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <p>
        Already have an account? <a href="/login">Login here</a>
      </p>
    </div>
  );
};
```

---

## 2. Email Verification Pending Page

Show this after registration:

```typescript
// pages/VerifyEmailPending.tsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export const VerifyEmailPendingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleResendEmail = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await authService.resendVerification(email);
      setMessage(response.data.message);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-pending-container">
      <div className="card">
        <div className="icon-check">✓</div>
        <h2>Check Your Email</h2>
        <p>We sent a verification link to:</p>
        <p className="email-confirmation">{email}</p>

        <div className="instructions">
          <h3>What's next?</h3>
          <ol>
            <li>Look for an email from UACN GPT</li>
            <li>Click the verification link in the email</li>
            <li>You'll be able to login once verified</li>
          </ol>
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <button 
          onClick={handleResendEmail} 
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? 'Sending...' : 'Resend Verification Email'}
        </button>

        <p className="tip">
          Didn't receive an email? Check your spam folder or request a new one above.
        </p>

        <a href="/login" className="link-back">Back to Login</a>
      </div>
    </div>
  );
};
```

---

## 3. Email Verification Link Handler

Create a page that handles the verification link from email:

```typescript
// pages/VerifyEmail.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setError('Invalid verification link');
        setLoading(false);
        return;
      }

      try {
        const response = await authService.verifyEmail(token);
        setMessage(response.data.message);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Verification failed');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  if (loading) {
    return <div className="loading">Verifying your email...</div>;
  }

  return (
    <div className="verify-email-container">
      {error ? (
        <div className="card error">
          <h2>Verification Failed</h2>
          <p>{error}</p>
          <a href="/register" className="btn">Create New Account</a>
          <a href="/verify-email-pending" className="link-secondary">Request New Link</a>
        </div>
      ) : (
        <div className="card success">
          <div className="icon-check">✓</div>
          <h2>Email Verified!</h2>
          <p>{message}</p>
          <p className="redirect-message">Redirecting to login...</p>
        </div>
      )}
    </div>
  );
};
```

---

## 4. Login Page (Updated)

Update login to handle unverified emails:

```typescript
// pages/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail('');
    setLoading(true);

    try {
      const response = await authService.login(formData);
      localStorage.setItem('token', response.data.token);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        setUnverifiedEmail(err.response.data.email);
      } else {
        setError(err.response?.data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await authService.resendVerification(unverifiedEmail);
      setError('Verification email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend email');
    }
  };

  return (
    <div className="login-container">
      <div className="card">
        <h2>UFL GPT Login</h2>

        {unverifiedEmail && (
          <div className="alert alert-warning">
            <p>Your email hasn't been verified yet.</p>
            <button 
              onClick={handleResendVerification}
              className="btn-link"
            >
              Resend verification email
            </button>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="form-links">
          <a href="/forgot-password">Forgot Password?</a>
          <a href="/register">Create Account</a>
        </div>
      </div>
    </div>
  );
};
```

---

## 5. Forgot Password Page

```typescript
// pages/ForgotPassword.tsx
import React, { useState } from 'react';
import { authService } from '../services/authService';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await authService.forgotPassword(email);
      setMessage(response.data.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="forgot-password-container">
        <div className="card">
          <div className="icon-check">✓</div>
          <h2>Check Your Email</h2>
          <p>We sent a password reset link to:</p>
          <p className="email-confirmation">{email}</p>
          
          <div className="instructions">
            <h3>Next steps:</h3>
            <ol>
              <li>Check your email for the reset link</li>
              <li>Click the link to reset your password</li>
              <li>Create a new password</li>
              <li>Login with your new password</li>
            </ol>
          </div>

          <p className="tip">
            The link expires in 1 hour. If you don't see it, check your spam folder.
          </p>

          <a href="/login" className="btn">Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-container">
      <div className="card">
        <h2>Reset Your Password</h2>
        <p>Enter your email address and we'll send you a link to reset your password.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p>
          Remember your password? <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  );
};
```

---

## 6. Reset Password Page

```typescript
// pages/ResetPassword.tsx
import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  if (!token || !email) {
    return (
      <div className="reset-password-container">
        <div className="card error">
          <h2>Invalid Reset Link</h2>
          <p>The password reset link is invalid or has expired.</p>
          <a href="/forgot-password" className="btn">Request New Link</a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPassword(token, email, newPassword);
      setMessage(response.data.message);
      setSubmitted(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="reset-password-container">
        <div className="card success">
          <div className="icon-check">✓</div>
          <h2>Password Reset Successful</h2>
          <p>{message}</p>
          <p className="redirect-message">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <div className="card">
        <h2>Create New Password</h2>
        <p>Enter your new password below.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password *</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </div>

          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Confirm your password"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <a href="/login" className="link">Back to Login</a>
      </div>
    </div>
  );
};
```

---

## 7. Router Setup

Update your router to include these new pages:

```typescript
// routes/index.tsx or App.tsx
import { RegisterPage } from '../pages/Register';
import { LoginPage } from '../pages/Login';
import { VerifyEmailPendingPage } from '../pages/VerifyEmailPending';
import { VerifyEmailPage } from '../pages/VerifyEmail';
import { ForgotPasswordPage } from '../pages/ForgotPassword';
import { ResetPasswordPage } from '../pages/ResetPassword';

export const appRoutes = [
  { path: '/register', element: <RegisterPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/verify-email-pending', element: <VerifyEmailPendingPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  // ... other routes
];
```

---

## 8. Environment Variables (Frontend)

Add to your `.env` file:

```env
REACT_APP_API_URL=http://0.0.0.0:5000/api
```

---

## User Flow Diagrams

### Registration Flow
```
Register
  ↓
Create Account
  ↓
Send Verification Email
  ↓
Show "Check Your Email" Page
  ↓
User Clicks Email Link
  ↓
Verify Email
  ↓
Send Welcome Email
  ↓
Redirect to Login
  ↓
User Logs In
```

### Forgot Password Flow
```
Login Page → "Forgot Password" Link
  ↓
Forgot Password Form
  ↓
Enter Email
  ↓
Send Reset Email
  ↓
Show "Check Your Email" Page
  ↓
User Clicks Email Link
  ↓
Reset Password Form
  ↓
Enter New Password
  ↓
Password Updated
  ↓
Redirect to Login
  ↓
User Logs In with New Password
```

---

## CSS Helper Classes (Optional)

```css
/* Alert messages */
.alert {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.alert-error {
  background-color: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.alert-success {
  background-color: #efe;
  color: #3c3;
  border: 1px solid #cfc;
}

.alert-warning {
  background-color: #ffe;
  color: #cc3;
  border: 1px solid #ffc;
}

/* Card styling */
.card {
  background: white;
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  margin: 24px auto;
}

/* Success icon */
.icon-check {
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
  color: #3c3;
}

/* Loading state */
.loading {
  text-align: center;
  padding: 48px 24px;
  font-size: 18px;
  color: #666;
}
```

---

## Testing Checklist

- [ ] User can register with valid email
- [ ] Verification email is sent to correct address
- [ ] User cannot login until email verified
- [ ] Email verification link works correctly
- [ ] Welcome email is sent after verification
- [ ] User can login after verification
- [ ] User can request password reset
- [ ] Password reset email is sent
- [ ] Password reset link works correctly
- [ ] User can set new password
- [ ] User can login with new password
- [ ] Resend verification email works
- [ ] Expired tokens are properly rejected
- [ ] All form validations work
- [ ] Error messages are user-friendly

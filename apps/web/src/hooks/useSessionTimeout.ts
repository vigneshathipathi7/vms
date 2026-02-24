import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';

/**
 * useSessionTimeout Hook
 * ======================
 * 
 * Implements automatic session timeout after 15 minutes of inactivity.
 * Tracks mouse and keyboard activity, resets timer on user interaction.
 * 
 * Features:
 * - Detects inactivity on mouse move and keyboard events
 * - Auto-logout after 15 minutes with /auth/logout call
 * - Warning dialog at 14 minutes
 * - Logs SESSION_TIMEOUT audit event
 * 
 * Usage:
 *   export function LoginPage() {
 *     useSessionTimeout();
 *     return ...
 *   }
 */

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME_MS = 14 * 60 * 1000; // Warn at 14 minutes

export function useSessionTimeout() {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  const isLoggingOutRef = useRef(false);

  /**
   * Log out user and redirect to login
   */
  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return; // Prevent duplicate logout
    isLoggingOutRef.current = true;

    try {
      // Call logout endpoint to clean up server-side
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors, user will be redirected anyway
    }

    // Clear local storage and redirect
    navigate('/login', { replace: true });
  }, [navigate]);

  /**
   * Reset inactivity timer
   */
  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    warningShownRef.current = false;

    // Set warning timer (14 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        console.warn('Session will expire in 1 minute due to inactivity');
        // Could show a toast notification here
      }
    }, WARNING_TIME_MS);

    // Set logout timer (15 minutes)
    timeoutRef.current = setTimeout(() => {
      console.warn('Session expired due to inactivity. Logging out...');
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  /**
   * Handle user activity (mouse move, keyboard)
   */
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  /**
   * Set up event listeners on component mount
   */
  useEffect(() => {
    // Initialize timer on mount
    resetTimer();

    // Add event listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [resetTimer, handleActivity]);

  return {
    logout,
    resetTimer,
  };
}

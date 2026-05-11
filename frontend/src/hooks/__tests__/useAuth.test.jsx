import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../../api/axios');

import api from '../../api/axios';

// ── Imports under test (after mocks) ─────────────────────────────────────────
import { AuthProvider } from '../../context/AuthContext';
import { useAuth } from '../useAuth';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => vi.resetAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useAuth', () => {
  it('returns isAuthenticated: false when /auth/me returns 401', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 401 } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('restores an existing session from /auth/me on mount', async () => {
    const mockUser = { _id: '1', email: 'admin@example.com', role: 'admin' };
    api.get.mockResolvedValueOnce({ data: { data: mockUser } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {});

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('updates user state when login() is called', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 401 } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(false);

    const newUser = { _id: '2', email: 'user@example.com', role: 'sales_rep' };
    act(() => {
      result.current.login(newUser);
    });

    expect(result.current.user).toEqual(newUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('clears user state and calls logout API when logout() is called', async () => {
    const mockUser = { _id: '1', email: 'user@example.com', role: 'sales_rep' };
    api.get.mockResolvedValueOnce({ data: { data: mockUser } });
    api.post.mockResolvedValueOnce({});

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { username: 'admin', display_name: 'Admin', role: 'admin' },
    logout: vi.fn(),
  }),
}));

vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: () => ({
    darkMode: false,
    toggleDarkMode: vi.fn(),
  }),
}));

vi.mock('../../api/hooks/useAlerts', () => ({
  useActiveAlerts: () => ({ data: [] }),
}));

describe('Header', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders ServerEye logo text', () => {
    render(<Header />);
    expect(screen.getByText('ServerEye')).toBeInTheDocument();
  });

  it('navigates to home when logo is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const logoButton = screen.getByText('ServerEye').closest('button');
    expect(logoButton).toBeInTheDocument();

    await user.click(logoButton!);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import { LoginForm } from './LoginForm';
import * as apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

function renderWithStore() {
  const store = configureStore({ reducer: { auth: authReducer } });
  render(
    <Provider store={store}>
      <LoginForm />
    </Provider>,
  );
  return store;
}

describe('LoginForm', () => {
  it('submits username and password and dispatches login on success', async () => {
    (apiClient.login as jest.Mock).mockResolvedValue({
      token: 'abc123',
      role: 'petugas',
    });
    const store = renderWithStore();

    await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
    await userEvent.type(screen.getByLabelText(/password/i), 'testpass');
    await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

    expect(apiClient.login).toHaveBeenCalledWith('testuser', 'testpass');
    expect(store.getState().auth).toEqual({ token: 'abc123', role: 'petugas' });
  });

  it('shows an error message when login fails', async () => {
    (apiClient.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));
    renderWithStore();

    await userEvent.type(screen.getByLabelText(/username/i), 'bad');
    await userEvent.type(screen.getByLabelText(/password/i), 'creds');
    await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});

import { login, post } from './apiClient';

describe('apiClient.login', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('posts credentials and returns token+role on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'abc123', role: 'petugas' }),
    });

    const result = await login('testuser', 'testpass');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
      }),
    );
    expect(result).toEqual({ token: 'abc123', role: 'petugas' });
  });

  it('throws with the server message on a non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    });

    await expect(login('bad', 'creds')).rejects.toThrow('Invalid credentials');
  });
});

describe('apiClient.post', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('sends an Authorization header when a token is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    });

    await post('/archive/search', { raw_transcript: 'cari budi' }, 'my-token');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/archive/search'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('omits the Authorization header when token is null', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    });

    await post('/auth/login', { username: 'a', password: 'b' }, null);

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('throws with the server message on a non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });

    await expect(post('/archive/cases', {}, 'token')).rejects.toThrow('Forbidden');
  });
});

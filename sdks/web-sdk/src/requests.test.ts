import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest'
import type { ProviderConfig } from '@melody-auth/shared'
import {
  getAuthorize,
  getUserInfo,
  postLogout,
  postTokenByAuthCode,
  postTokenByRefreshToken,
} from './requests'

describe(
  'requests',
  () => {
    const mockProviderConfig: ProviderConfig = {
      serverUri: 'https://test.server',
      clientId: 'test-client-id',
      redirectUri: 'https://test.redirect',
      scopes: ['test-scope'],
    }

    describe(
      'getAuthorize',
      () => {
        const mockWindow = { location: { href: '' } }
        const originalWindow = global.window

        beforeEach(() => {
          // @ts-expect-error - Partial window mock
          global.window = mockWindow
        })

        afterEach(() => {
          global.window = originalWindow
        })

        it(
          'should redirect to authorization URL with required parameters',
          async () => {
            await getAuthorize(
              mockProviderConfig,
              {
                state: 'test-state',
                codeChallenge: 'test-challenge',
              },
            )

            expect(mockWindow.location.href).toContain('https://test.server/oauth2/v1/authorize')
            expect(mockWindow.location.href).toContain('response_type=code')
            expect(mockWindow.location.href).toContain('state=test-state')
            expect(mockWindow.location.href).toContain('client_id=test-client-id')
            expect(mockWindow.location.href).toContain('redirect_uri=https://test.redirect')
            expect(mockWindow.location.href).toContain('code_challenge=test-challenge')
            expect(mockWindow.location.href).toContain('code_challenge_method=S256')
            expect(mockWindow.location.href).toContain('scope=test-scope openid profile offline_access')
          },
        )

        it(
          'should include optional parameters when provided',
          async () => {
            await getAuthorize(
              mockProviderConfig,
              {
                state: 'test-state',
                codeChallenge: 'test-challenge',
                locale: 'en',
                policy: 'test-policy',
                org: 'test-org',
              },
            )

            expect(mockWindow.location.href).toContain('locale=en')
            expect(mockWindow.location.href).toContain('policy=test-policy')
            expect(mockWindow.location.href).toContain('org=test-org')
          },
        )

        it(
          'should open popup and handle message event when authorizeMethod is "popup"',
          async () => {
            // Create a fake popup window with spy functions for focus and close
            const fakePopup = {
              focus: vi.fn(),
              close: vi.fn(),
              closed: false,
            }
            // Ensure window.open exists and then spy on it
            if (!window.open) {
              (window as any).open = () => null
            }
            // Spy on window.open to return our fake popup
            const windowOpenSpy = vi.spyOn(
              window,
              'open',
            ).mockImplementation(() => fakePopup as unknown as Window)

            // Ensure addEventListener and removeEventListener exist on window
            if (!window.addEventListener) {
              (window as any).addEventListener = () => {}
            }
            if (!window.removeEventListener) {
              (window as any).removeEventListener = () => {}
            }
            // Capture the message event listener callback when added.
            let messageHandler: ((e: MessageEvent) => void) | null = null
            const addEventListenerSpy = vi.spyOn(
              window,
              'addEventListener',
            ).mockImplementation((
              event: string, handler: EventListenerOrEventListenerObject,
            ) => {
              if (event === 'message') {
                messageHandler = handler as (e: MessageEvent) => void
              }
            })

            // Spy on removeEventListener to verify that it is called later.
            const removeEventListenerSpy = vi.spyOn(
              window,
              'removeEventListener',
            ).mockImplementation(() => {})

            const authorizePopupHandler = vi.fn()

            // Call getAuthorize with authorizeMethod set to 'popup'
            await getAuthorize(
              mockProviderConfig,
              {
                state: 'test-state',
                codeChallenge: 'test-codeChallenge',
                authorizeMethod: 'popup',
                authorizePopupHandler,
                locale: 'en',
              },
            )

            // Assert that the popup was opened and focused.
            expect(windowOpenSpy).toHaveBeenCalled()
            expect(fakePopup.focus).toHaveBeenCalled()

            // Simulate an incoming message event with the expected state and code.
            const eventData = {
              state: 'test-state', code: 'test-code',
            }
            expect(messageHandler).toBeDefined()
            if (messageHandler) {
              messageHandler(new MessageEvent(
                'message',
                { data: eventData },
              ))
            }

            // Verify that the authorizePopupHandler was called with the event data.
            expect(authorizePopupHandler).toHaveBeenCalledWith(eventData)
            // Assert that the popup was closed.
            expect(fakePopup.close).toHaveBeenCalled()
            // Assert that the message event listener was removed.
            expect(removeEventListenerSpy).toHaveBeenCalledWith(
              'message',
              messageHandler,
            )

            // Cleanup spies.
            windowOpenSpy.mockRestore()
            addEventListenerSpy.mockRestore()
            removeEventListenerSpy.mockRestore()
          },
        )
      },
    )

    describe(
      'API requests',
      () => {
        beforeEach(() => {
          global.fetch = vi.fn()
        })

        describe(
          'getUserInfo',
          () => {
            it(
              'should fetch user info with access token',
              async () => {
                const mockResponse = {
                  sub: 'test-user', email: 'test@example.com',
                }
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: true,
                  json: () => Promise.resolve(mockResponse),
                } as Response)

                const result = await getUserInfo(
                  mockProviderConfig,
                  { accessToken: 'test-token' },
                )

                expect(fetch).toHaveBeenCalledWith(
                  'https://test.server/oauth2/v1/userinfo',
                  {
                    method: 'GET',
                    headers: { Authorization: 'Bearer test-token' },
                  },
                )
                expect(result).toEqual(mockResponse)
              },
            )

            it(
              'should throw error on failed request',
              async () => {
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: false,
                  text: () => Promise.resolve('Error message'),
                } as Response)

                await expect(getUserInfo(
                  mockProviderConfig,
                  { accessToken: 'test-token' },
                )).rejects.toThrow('Error message')
              },
            )
          },
        )

        describe(
          'postLogout',
          () => {
            it(
              'should post logout request with tokens',
              async () => {
                const mockResponse = { redirectUri: 'https://logout.redirect' }
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: true,
                  json: () => Promise.resolve(mockResponse),
                } as Response)

                const result = await postLogout(
                  mockProviderConfig,
                  {
                    accessToken: 'test-access-token',
                    refreshToken: 'test-refresh-token',
                    postLogoutRedirectUri: 'https://post.logout',
                  },
                )

                expect(fetch).toHaveBeenCalledWith(
                  'https://test.server/identity/v1/logout',
                  {
                    method: 'POST',
                    headers: {
                      Authorization: 'Bearer test-access-token',
                      'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: expect.stringContaining('refresh_token=test-refresh-token'),
                  },
                )
                expect(result).toBe('https://logout.redirect')
              },
            )

            it(
              'should return post logout redirect URI if no redirect in response',
              async () => {
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: true,
                  json: () => Promise.resolve({}),
                } as Response)

                const result = await postLogout(
                  mockProviderConfig,
                  {
                    accessToken: 'test-token',
                    refreshToken: 'test-refresh',
                    postLogoutRedirectUri: 'https://default.redirect',
                  },
                )

                expect(result).toBe('https://default.redirect')
              },
            )

            it(
              'should throw error on failed request',
              async () => {
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: false,
                  text: () => Promise.resolve('Logout failed'),
                } as Response)

                await expect(postLogout(
                  mockProviderConfig,
                  {
                    accessToken: 'test-token',
                    refreshToken: 'test-refresh',
                    postLogoutRedirectUri: 'https://default.redirect',
                  },
                )).rejects.toThrow('Logout failed')
              },
            )
          },
        )

        describe(
          'postTokenByAuthCode',
          () => {
            it(
              'should exchange auth code for tokens',
              async () => {
                const mockResponse = {
                  access_token: 'new-access-token',
                  refresh_token: 'new-refresh-token',
                }
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: true,
                  json: () => Promise.resolve(mockResponse),
                } as Response)

                const result = await postTokenByAuthCode(
                  mockProviderConfig,
                  {
                    code: 'test-code',
                    codeVerifier: 'test-verifier',
                  },
                )

                expect(fetch).toHaveBeenCalledWith(
                  'https://test.server/oauth2/v1/token',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: expect.stringContaining('grant_type=authorization_code'),
                  },
                )
                expect(result).toEqual(mockResponse)
              },
            )

            it(
              'should throw error on failed request',
              async () => {
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: false,
                  text: () => Promise.resolve('Token exchange failed'),
                } as Response)

                await expect(postTokenByAuthCode(
                  mockProviderConfig,
                  {
                    code: 'test-code',
                    codeVerifier: 'test-verifier',
                  },
                )).rejects.toThrow('Token exchange failed')
              },
            )
          },
        )

        describe(
          'postTokenByRefreshToken',
          () => {
            it(
              'should refresh tokens',
              async () => {
                const mockResponse = {
                  access_token: 'new-access-token',
                  refresh_token: 'new-refresh-token',
                }
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: true,
                  json: () => Promise.resolve(mockResponse),
                } as Response)

                const result = await postTokenByRefreshToken(
                  mockProviderConfig,
                  { refreshToken: 'old-refresh-token' },
                )

                expect(fetch).toHaveBeenCalledWith(
                  'https://test.server/oauth2/v1/token',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: expect.stringContaining('grant_type=refresh_token'),
                  },
                )
                expect(result).toEqual(mockResponse)
              },
            )

            it(
              'should throw error on failed request',
              async () => {
                vi.mocked(fetch).mockResolvedValueOnce({
                  ok: false,
                  text: () => Promise.resolve('Token refresh failed'),
                } as Response)

                await expect(postTokenByRefreshToken(
                  mockProviderConfig,
                  { refreshToken: 'old-refresh-token' },
                )).rejects.toThrow('Token refresh failed')
              },
            )
          },
        )
      },
    )
  },
)

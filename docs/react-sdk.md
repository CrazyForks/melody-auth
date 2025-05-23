# React SDK

## Installation

```
npm install @melody-auth/react --save
```

## AuthProvider

Wrap your application inside AuthProvider component to provide the auth related context to your application components.

| Parameter | Type | Description | Default | Required |
|-----------|------|-------------|---------|----------|
| clientId | string | The auth clientId your frontend connects to | N/A | Yes |
| redirectUri | string | The URL to redirect users after successful authentication | N/A | Yes |
| serverUri | string | The URL where you host the melody auth server | N/A | Yes |
| scopes | string[] | Permission scopes to request for user access | N/A | No |
| storage | 'sessionStorage' \| 'localStorage' | Storage type for authentication tokens | 'localStorage' | No |
| onLoginSuccess | (attr: { locale?: string; state?: string }) => void | Function to execute after a successful login | N/A | No |

```
import { AuthProvider } from '@melody-auth/react'

export default function RootLayout ({ children }: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <AuthProvider
        clientId={process.env.CLIENT_ID ?? ''}
        redirectUri={process.env.REDIRECT_URI ?? ''}
        serverUri={process.env.SERVER_URI ?? ''}
      >
        <body>
          {children}
        </body>
      </AuthProvider>
    </html>
  )
}
```

## isAuthenticated

Indicates if the current user is authenticated.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isAuthenticating, isAuthenticated } = useAuth()

  if (isAuthenticating) return <Spinner />
  if (isAuthenticated) return <Button>Logout</Button>
  if (!isAuthenticated) return <Button>Login</Button>
}
```

## loginRedirect

Triggers a new authentication flow by redirecting to the auth server.

| Parameter | Type | Description | Default | Required |
|-----------|------|-------------|---------|----------|
| locale | string | Specifies the locale to use in the authentication flow | N/A | No |
| state | string | Specifies the state to use in the authentication flow if you prefer not to use a randomly generated string | N/A | No |
| policy | string | Specifies the policy to use in the authentication flow | 'sign_in_or_sign_up' | No |
| org | string | Specifies the organization to use in the authentication flow, the value should be the slug of the organization | N/A | No |

```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isAuthenticated, loginRedirect } = useAuth()

  const handleLogin = () => {
    loginRedirect({
      locale: 'en',
      state: JSON.stringify({ info: Math.random() })
    })
  }

  if (!isAuthenticated) {
    return <Button onClick={handleLogin}>Login</Button>
  }
}
```

## loginPopup

Triggers a new authentication flow in a popup.

| Parameter | Type | Description | Default | Required |
|-----------|------|-------------|---------|----------|
| locale | string | Specifies the locale to use in the authentication flow | N/A | No |
| state | string | Specifies the state to use in the authentication flow if you prefer not to use a randomly generated string | N/A | No |
| org | string | Specifies the organization to use in the authentication flow, the value should be the slug of the organization | N/A | No |
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isAuthenticated, loginPopup } = useAuth()

  const handleLogin = () => {
    loginPopup({
      locale: 'en',
      state: JSON.stringify({ info: Math.random() })
    })
  }

  if (!isAuthenticated) {
    return <Button onClick={handleLogin}>Login</Button>
  }
}
```

## logoutRedirect

Triggers the logout flow.

| Parameter | Type | Description | Default | Required |
|-----------|------|-------------|---------|----------|
| postLogoutRedirectUri | string | The URL to redirect users after logout | N/A | No |

```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isAuthenticated, logoutRedirect } = useAuth()

  const handleLogout = () => {
    logoutRedirect({ postLogoutRedirectUri: 'http://localhost:3000/' })
  }

  if (isAuthenticated) {
    return <Button onClick={handleLogout}>Logout</Button>
  }
}
```

## acquireToken

Gets the user's accessToken, or refreshes it if expired.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isAuthenticated, acquireToken } = useAuth()

  const handleFetchUserInfo = () => {
    const accessToken = await acquireToken()
    // Use the token to fetch protected resources
    await fetch('/...', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }

  if (isAuthenticated) {
    return <Button onClick={handleFetchUserInfo}>Fetch User Info</Button>
  }
}
```

## acquireUserInfo

Gets the user's public info from the auth server.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isAuthenticated, acquireUserInfo } = useAuth()

  const handleFetchUserInfo = () => {
    const userInfo = await acquireUserInfo()
  }

  if (isAuthenticated) {
    return <Button onClick={handleFetchUserInfo}>Fetch User Info</Button>
  }
}
```

## userInfo

The current user's details. Be sure to invoke acquireUserInfo before accessing userInfo.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { userInfo } = useAuth()

  <div>{JSON.stringify(userInfo)}</div>
}
```

## isAuthenticating

Indicates whether the SDK is initializing and attempting to obtain the user's authentication state.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isAuthenticating } = useAuth()

  if (isAuthenticating) return <Spinner />
}
```

## isLoadingToken

Indicates whether the SDK is acquiring token.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isLoadingToken } = useAuth()

  if (isLoadingToken) return <Spinner />
}
```

## isLoadingUserInfo

Indicates whether the SDK is acquiring user info.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { isLoadingUserInfo } = useAuth()

  if (isLoadingUserInfo) return <Spinner />
}
```

## authenticationError

Indicates whether there is an authentication process related error.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { authenticationError } = useAuth()

  if (authenticationError) return <Alert />
}
```

## acquireTokenError

Indicates whether there is an acquireToken process related error.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { acquireTokenError } = useAuth()

  if (acquireTokenError) return <Alert />
}
```

## acquireUserInfoError

Indicates whether there is an acquireUserInfo process related error.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { acquireUserInfoError } = useAuth()

  if (acquireUserInfoError) return <Alert />
}
```

## idToken

The id_token of the current user.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { idToken } = useAuth()
}
```

## account

Decoded account information from id_token.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { account } = useAuth()
}
```

## loginError

Indicates whether there is an login process related error.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { loginError } = useAuth()

  if (loginError) return <Alert />
}
```

## logoutError

Indicates whether there is an login process related error.
```
import { useAuth } from '@melody-auth/react'

export default function Home () {
  const { logoutError } = useAuth()

  if (logoutError) return <Alert />
}
```

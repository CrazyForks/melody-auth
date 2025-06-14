const PostInitiateReq = {
  type: 'object',
  properties: {
    redirectUri: { type: 'string' },
    clientId: { type: 'string' },
    codeChallenge: { type: 'string' },
    codeChallengeMethod: {
      type: 'string',
      enum: ['S256', 'plain'],
    },
    scopes: {
      type: 'array',
      items: { type: 'string' },
    },
    locale: { type: 'string' },
    org: { type: 'string' },
  },
  required: [
    'redirectUri', 'clientId', 'codeChallenge',
    'codeChallengeMethod', 'scopes', 'locale',
  ],
}

const PostSignInReq = {
  type: 'object',
  properties: {
    email: { type: 'string' },
    password: { type: 'string' },
  },
  required: [
    'email', 'password',
  ],
}

const GetSignUpInfoRes = {
  type: 'object',
  properties: {
    userAttributes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          includeInSignUpForm: { type: 'boolean' },
          requiredInSignUpForm: { type: 'boolean' },
          includeInIdTokenBody: { type: 'boolean' },
          includeInUserInfo: { type: 'boolean' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          deletedAt: {
            type: 'string', nullable: true, example: null,
          },
        },
      },
    },
  },
  required: ['userAttributes'],
}

const PostSignUpReq = {
  type: 'object',
  properties: {
    email: { type: 'string' },
    password: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    attributes: {
      type: 'object',
      additionalProperties: { type: 'string' },
      example: {
        1: 'value for attributeId 1',
        2: 'value for attributeId 2',
      },
    },
  },
  required: [
    'email', 'password',
  ],
}

const MfaEnrollmentInfoRes = {
  type: 'object',
  properties: {
    mfaTypes: {
      type: 'array',
      items: {
        type: 'string', enum: ['otp', 'email', 'sms'],
      },
    },
  },
  required: ['mfaTypes'],
}

const PostMfaEnrollmentReq = {
  type: 'object',
  properties: {
    type: {
      type: 'string', enum: ['otp', 'email', 'sms'],
    },
  },
  required: ['type'],
}

const MfaCodeReq = {
  type: 'object',
  properties: { mfaCode: { type: 'string' } },
  required: ['mfaCode'],
}

const OtpMfaSetupRes = {
  type: 'object',
  properties: {
    otpUri: { type: 'string' },
    otpSecret: { type: 'string' },
  },
  required: ['otpUri', 'otpSecret'],
}

const OtpMfaConfigRes = {
  type: 'object',
  properties: { couldFallbackToEmailMfa: { type: 'boolean' } },
  required: ['couldFallbackToEmailMfa'],
}

const SmsMfaSetupReq = {
  type: 'object',
  properties: { phoneNumber: { type: 'string' } },
  required: ['phoneNumber'],
}

const SmsMfaConfigRes = {
  type: 'object',
  properties: {
    allowFallbackToEmailMfa: { type: 'boolean' },
    countryCode: { type: 'string' },
    phoneNumber: { type: 'string' },
  },
  required: ['allowFallbackToEmailMfa', 'countryCode', 'phoneNumber'],
}

const AuthRes = {
  type: 'object',
  properties: {
    sessionId: { type: 'string' },
    nextStep: {
      type: 'string',
      enum: ['consent', 'mfa_enroll', 'email_mfa', 'sms_mfa', 'otp_setup', 'opt_mfa', 'passkey_enroll'],
    },
    success: { type: 'boolean' },
  },
  required: ['sessionId', 'success'],
}

const TokenExchangeReq = {
  type: 'object',
  properties: {
    codeVerifier: { type: 'string' },
    sessionId: { type: 'string' },
  },
  required: ['codeVerifier', 'sessionId'],
}

const TokenExchangeRes = {
  type: 'object',
  properties: {
    access_token: { type: 'string' },
    expires_in: { type: 'number' },
    expires_on: { type: 'number' },
    not_before: { type: 'number' },
    token_type: {
      type: 'string', enum: ['Bearer'],
    },
    scope: { type: 'string' },
    refresh_token: { type: 'string' },
    refresh_token_expires_in: { type: 'number' },
    refresh_token_expires_on: { type: 'number' },
    id_token: { type: 'string' },
  },
  required: ['access_token', 'expires_in', 'expires_on', 'not_before', 'token_type', 'scope'],
}

const TokenRefreshReq = {
  type: 'object',
  properties: { refreshToken: { type: 'string' } },
  required: ['refreshToken'],
}

const TokenRefreshRes = {
  type: 'object',
  properties: {
    access_token: { type: 'string' },
    expires_in: { type: 'number' },
    expires_on: { type: 'number' },
    token_type: {
      type: 'string', enum: ['Bearer'],
    },
  },
  required: ['access_token', 'expires_in', 'expires_on', 'token_type'],
}

const SignOutReq = {
  type: 'object',
  properties: {
    refreshToken: { type: 'string' }, clientId: { type: 'string' },
  },
  required: ['refreshToken', 'clientId'],
}

const GetAppConsentRes = {
  type: 'object',
  properties: {
    scopes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          note: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          deletedAt: {
            type: 'string', nullable: true, example: null,
          },
          locales: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                scopeId: { type: 'number' },
                locale: { type: 'string' },
                value: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                deletedAt: {
                  type: 'string', nullable: true, example: null,
                },
              },
            },
          },
        },
      },
    },
    appName: { type: 'string' },
  },
  required: ['scopes', 'appName'],
}

const ResetPasswordReq = {
  type: 'object',
  properties: {
    email: { type: 'string' },
    locale: { type: 'string' },
  },
  required: ['email'],
}

module.exports = {
  PostInitiateReq,
  PostSignInReq,
  GetSignUpInfoRes,
  PostSignUpReq,
  TokenExchangeReq,
  TokenRefreshReq,
  MfaEnrollmentInfoRes,
  PostMfaEnrollmentReq,
  MfaCodeReq,
  OtpMfaSetupRes,
  OtpMfaConfigRes,
  SmsMfaSetupReq,
  SmsMfaConfigRes,
  AuthRes,
  TokenExchangeRes,
  TokenRefreshRes,
  SignOutReq,
  GetAppConsentRes,
  ResetPasswordReq,
}

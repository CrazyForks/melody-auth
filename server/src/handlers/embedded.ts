import { Context } from 'hono'
import { env } from 'hono/adapter'
import { genRandomString } from '@melody-auth/shared'
import {
  errorConfig, messageConfig, typeConfig,
} from 'configs'
import {
  appService, consentService, emailService, identityService,
  kvService, mfaService, oauthService, passkeyService, recoveryCodeService, scopeService,
  userAttributeService,
  userService,
} from 'services'
import {
  baseDto,
  embeddedDto, oauthDto,
} from 'dtos'
import {
  cryptoUtil, loggerUtil, requestUtil, validateUtil,
} from 'utils'
import {
  authCodeHook, signInHook,
  signUpHook,
} from 'hooks'
import { userModel } from 'models'

export const sessionBodyToAuthCodeBody = (sessionBody: typeConfig.EmbeddedSessionBody): typeConfig.AuthCodeBody => {
  if (!sessionBody.user) {
    throw new errorConfig.NotFound(messageConfig.RequestError.WrongSessionId)
  }

  return {
    ...sessionBody,
    user: sessionBody.user,
    request: {
      ...sessionBody.request,
      state: '',
      responseType: 'code',
    },
  }
}

const getSessionBody = async (
  c: Context<typeConfig.Context>,
  sessionId: string,
) => {
  const sessionBody = await kvService.getEmbeddedSessionBody(
    c.env.KV,
    sessionId,
  )
  if (!sessionBody) {
    loggerUtil.triggerLogger(
      c,
      loggerUtil.LoggerLevel.Warn,
      messageConfig.RequestError.WrongSessionId,
    )
    throw new errorConfig.NotFound(messageConfig.RequestError.WrongSessionId)
  }

  return sessionBody
}

const getSessionBodyWithUser = async (
  c: Context<typeConfig.Context>, sessionId: string,
) => {
  const sessionBody = await kvService.getEmbeddedSessionBody(
    c.env.KV,
    sessionId,
  )

  if (!sessionBody || !sessionBody.user) {
    loggerUtil.triggerLogger(
      c,
      loggerUtil.LoggerLevel.Warn,
      messageConfig.RequestError.WrongSessionId,
    )
    throw new errorConfig.NotFound(messageConfig.RequestError.WrongSessionId)
  }

  return sessionBody as typeConfig.EmbeddedSessionBodyWithUser
}

export const initiate = async (c: Context<typeConfig.Context>) => {
  const reqBody = await c.req.json()
  const queryDto = new oauthDto.CoreAuthorizeDto(reqBody)
  await validateUtil.dto(queryDto)

  const app = await appService.verifySPAClientRequest(
    c,
    queryDto.clientId,
    queryDto.redirectUri,
  )

  const validScopes = await scopeService.verifyAppScopes(
    c,
    app.id,
    queryDto.scopes,
  )

  const { AUTHORIZATION_CODE_EXPIRES_IN: codeExpiresIn } = env(c)
  const mfaConfig = mfaService.getAppMfaConfig(app)

  const sessionId = genRandomString(128)
  const embeddedSessionBody: typeConfig.EmbeddedSessionBody = {
    appId: app.id,
    appName: app.name,
    request: {
      ...queryDto,
      scopes: validScopes,
    },
    mfa: mfaConfig ? mfaService.getAuthCodeBodyMfaConfig(mfaConfig) : undefined,
  }
  await kvService.storeEmbeddedSession(
    c.env.KV,
    sessionId,
    embeddedSessionBody,
    codeExpiresIn,
  )

  return c.json({ sessionId })
}

const processAuthorizeWithUser = async (
  c: Context<typeConfig.Context>,
  sessionId: string,
  sessionBody: typeConfig.EmbeddedSessionBody,
  user: userModel.Record,
) => {
  const sessionBodyWithUser = {
    ...sessionBody,
    user,
  }

  const { AUTHORIZATION_CODE_EXPIRES_IN: codeExpiresIn } = env(c)
  await kvService.storeEmbeddedSession(
    c.env.KV,
    sessionId,
    sessionBodyWithUser,
    codeExpiresIn,
  )

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.Password,
    sessionId,
    sessionBodyToAuthCodeBody(sessionBodyWithUser),
  )

  return result
}

export const getSignUpInfo = async (c: Context<typeConfig.Context>) => {
  const { ENABLE_USER_ATTRIBUTE: enableUserAttribute } = env(c)

  const userAttributes = enableUserAttribute
    ? await userAttributeService.getUserSignUpAttributes(c)
    : []

  return c.json({ userAttributes })
}

export const signUp = async (c: Context<typeConfig.Context>) => {
  await signUpHook.preSignUp()

  const sessionId = c.req.param('sessionId')

  const reqBody = {
    ...(await c.req.json()),
    sessionId,
  }

  const {
    NAMES_IS_REQUIRED: namesIsRequired,
    ENABLE_EMAIL_VERIFICATION: enableEmailVerification,
  } = env(c)

  const bodyDto = namesIsRequired
    ? new embeddedDto.SignUpDtoWithRequiredNames(reqBody)
    : new embeddedDto.SignUpDtoWithNames(reqBody)
  await validateUtil.dto(bodyDto)

  const sessionBody = await getSessionBody(
    c,
    bodyDto.sessionId,
  )

  const attributeValues = await userAttributeService.getUserSignUpAttributeValues(
    c,
    reqBody,
  )

  const user = await userService.createAccountWithPassword(
    c,
    {
      email: bodyDto.email,
      password: bodyDto.password,
      firstName: bodyDto.firstName,
      lastName: bodyDto.lastName,
      locale: sessionBody.request.locale,
      org: sessionBody.request.org,
    },
    attributeValues,
  )

  if (enableEmailVerification) {
    const verificationCode = await emailService.sendEmailVerification(
      c,
      bodyDto.email,
      user,
      sessionBody.request.locale,
    )
    if (verificationCode) {
      await kvService.storeEmailVerificationCode(
        c.env.KV,
        user.id,
        verificationCode,
      )
    }
  }

  const result = await processAuthorizeWithUser(
    c,
    bodyDto.sessionId,
    sessionBody,
    user,
  )

  await signUpHook.postSignUp()

  return c.json({
    sessionId: bodyDto.sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const signIn = async (c: Context<typeConfig.Context>) => {
  await signInHook.preSignIn()

  const sessionId = c.req.param('sessionId')

  const reqBody = {
    ...(await c.req.json()),
    sessionId,
  }

  const bodyDto = new embeddedDto.SignInDto(reqBody)
  await validateUtil.dto(bodyDto)

  const sessionBody = await getSessionBody(
    c,
    bodyDto.sessionId,
  )

  const user = await userService.verifyPasswordSignIn(
    c,
    bodyDto,
  )

  const result = await processAuthorizeWithUser(
    c,
    bodyDto.sessionId,
    sessionBody,
    user,
  )

  await signInHook.postSignIn()

  return c.json({
    sessionId: bodyDto.sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const signInWithRecoveryCode = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')

  const reqBody = {
    ...(await c.req.json()),
    sessionId,
  }

  const bodyDto = new embeddedDto.SignInWithRecoveryCodeDto(reqBody)
  await validateUtil.dto(bodyDto)

  const sessionBody = await getSessionBody(
    c,
    bodyDto.sessionId,
  )

  const user = await userService.verifyRecoveryCodeSignIn(
    c,
    bodyDto,
  )

  const result = await processAuthorizeWithUser(
    c,
    bodyDto.sessionId,
    {
      ...sessionBody,
      isFullyAuthorized: true,
    },
    user,
  )

  return c.json({
    sessionId: bodyDto.sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const tokenExchange = async (c: Context<typeConfig.Context>) => {
  await authCodeHook.preTokenExchangeWithAuthCode()

  const reqBody = await c.req.json()

  const bodyDto = new embeddedDto.TokenExchangeDto(reqBody)
  await validateUtil.dto(bodyDto)

  const sessionBody = await getSessionBodyWithUser(
    c,
    bodyDto.sessionId,
  )

  const result = await oauthService.handleAuthCodeTokenExchange(
    c,
    sessionBodyToAuthCodeBody(sessionBody),
    {
      ...bodyDto,
      code: bodyDto.sessionId,
      grantType: oauthDto.TokenGrantType.AuthorizationCode,
    },
  )

  await authCodeHook.postTokenExchangeWithAuthCode()

  return c.json(result)
}

export const tokenRefresh = async (c: Context<typeConfig.Context>) => {
  const reqBody = await c.req.json()

  const bodyDto = new embeddedDto.TokenRefreshDto(reqBody)
  await validateUtil.dto(bodyDto)

  const result = await oauthService.handleRefreshTokenTokenExchange(
    c,
    {
      ...bodyDto,
      grantType: oauthDto.TokenGrantType.RefreshToken,
    },
  )

  return c.json(result)
}

export const signOut = async (c: Context<typeConfig.Context>) => {
  const reqBody = await c.req.json()

  const bodyDto = new embeddedDto.SignOutDto(reqBody)
  await validateUtil.dto(bodyDto)

  await oauthService.handleInvalidRefreshToken(
    c,
    bodyDto.refreshToken,
    bodyDto.clientId,
  )

  c.status(200)
  return c.body(null)
}

export const getAppConsent = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const result = await identityService.processGetAppConsent(
    c,
    sessionBody.request,
  )

  return c.json(result)
}

export const postAppConsent = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  await consentService.createUserAppConsent(
    c,
    sessionBody.user.id,
    sessionBody.appId,
  )

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.Password,
    sessionId,
    sessionBodyToAuthCodeBody(sessionBody),
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const getMfaEnrollment = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const result = await mfaService.getMfaEnrollmentInfo(
    c,
    sessionBody,
  )

  return c.json(result)
}

export const postMfaEnrollment = async (c: Context<typeConfig.Context>) => {
  const bodyDto = new embeddedDto.PostMfaEnrollmentDto(await c.req.json())
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const user = await mfaService.processMfaEnrollment(
    c,
    sessionBody,
    bodyDto.type,
  )

  const { AUTHORIZATION_CODE_EXPIRES_IN: codeExpiresIn } = env(c)
  const newSessionBody = {
    ...sessionBody,
    user,
  }
  await kvService.storeEmbeddedSession(
    c.env.KV,
    sessionId,
    newSessionBody,
    codeExpiresIn,
  )

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.MfaEnroll,
    sessionId,
    sessionBodyToAuthCodeBody(newSessionBody),
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const postEmailMfaCode = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')

  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const isPasswordlessCode = false
  await mfaService.handleSendEmailMfa(
    c,
    sessionId,
    sessionBody,
    sessionBody.request.locale,
    isPasswordlessCode,
  )

  return c.json({ success: true })
}

export const postEmailMfa = async (c: Context<typeConfig.Context>) => {
  const bodyDto = new embeddedDto.MfaDto(await c.req.json())
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  await mfaService.processEmailMfa(
    c,
    sessionId,
    sessionBody,
    bodyDto.mfaCode,
  )

  await mfaService.rememberEmailMfaDevice(
    c,
    bodyDto.rememberDevice,
    sessionBody.user.id,
  )

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.EmailMfa,
    sessionId,
    sessionBodyToAuthCodeBody(sessionBody),
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const getOtpMfaSetup = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const {
    user, otpUri, otpSecret,
  } = await mfaService.handleGetOtpMfaSetup(
    c,
    sessionBody,
  )

  if (user) {
    const { AUTHORIZATION_CODE_EXPIRES_IN: codeExpiresIn } = env(c)
    const newSessionBody = {
      ...sessionBody,
      user,
    }

    await kvService.storeEmbeddedSession(
      c.env.KV,
      sessionId,
      newSessionBody,
      codeExpiresIn,
    )
  }

  return c.json({
    otpUri,
    otpSecret,
  })
}

export const getOtpMfa = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const allowFallbackToEmailMfa = mfaService.allowOtpSwitchToEmailMfa(
    c,
    sessionBody,
  )

  return c.json({ allowFallbackToEmailMfa })
}

export const postOtpMfa = async (c: Context<typeConfig.Context>) => {
  const bodyDto = new embeddedDto.MfaDto(await c.req.json())
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  await mfaService.processOtpMfa(
    c,
    sessionId,
    sessionBody,
    bodyDto.mfaCode,
  )

  await mfaService.rememberOtpMfaDevice(
    c,
    bodyDto.rememberDevice,
    sessionBody.user.id,
  )

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.OtpMfa,
    sessionId,
    sessionBodyToAuthCodeBody(sessionBody),
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const postSmsMfaSetup = async (c: Context<typeConfig.Context>) => {
  const bodyDto = new embeddedDto.SmsMfaSetupDto(await c.req.json())
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  await mfaService.handleSmsMfaSetup(
    c,
    sessionId,
    sessionBody,
    bodyDto.phoneNumber,
    sessionBody.request.locale,
  )

  return c.json({ success: true })
}

export const getSmsMfa = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const info = await mfaService.getSmsMfaInfo(
    c,
    sessionId,
    sessionBody,
    sessionBody.request.locale,
  )

  return c.json(info)
}

export const postSmsMfaCode = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  await mfaService.handleSendSmsMfaCode(
    c,
    sessionId,
    sessionBody,
    sessionBody.request.locale,
  )

  return c.json({ success: true })
}

export const postSmsMfa = async (c: Context<typeConfig.Context>) => {
  const bodyDto = new embeddedDto.MfaDto(await c.req.json())
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  await mfaService.processSmsMfa(
    c,
    sessionId,
    sessionBody,
    bodyDto.mfaCode,
  )

  await mfaService.rememberSmsMfaDevice(
    c,
    bodyDto.rememberDevice,
    sessionBody.user.id,
  )

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.SmsMfa,
    sessionId,
    sessionBodyToAuthCodeBody(sessionBody),
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const getPasskeyEnroll = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const enrollOptions = await passkeyService.genPasskeyEnrollOptions(
    c,
    sessionBody,
  )

  return c.json({ enrollOptions })
}

export const postPasskeyEnroll = async (c: Context<typeConfig.Context>) => {
  const bodyDto = new embeddedDto.PostProcessPasskeyEnrollDto(await c.req.json())
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const {
    passkeyId, passkeyPublickey, passkeyCounter,
  } = await passkeyService.processPasskeyEnroll(
    c,
    sessionBody,
    bodyDto.enrollInfo,
  )

  await passkeyService.createUserPasskey(
    c,
    sessionBody.user.id,
    passkeyId,
    cryptoUtil.uint8ArrayToBase64(passkeyPublickey),
    passkeyCounter,
  )

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.PasskeyEnroll,
    sessionId,
    sessionBodyToAuthCodeBody(sessionBody),
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const postPasskeyEnrollDecline = async (c: Context<typeConfig.Context>) => {
  const reqBody = await c.req.json()

  const bodyDto = new embeddedDto.PostProcessPasskeyEnrollDeclineDto(reqBody)
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  if (bodyDto.remember) {
    await userService.skipUserPasskeyEnroll(
      c,
      sessionBody.user,
    )
  }

  const result = await identityService.processPostAuthorize(
    c,
    identityService.AuthorizeStep.PasskeyEnroll,
    sessionId,
    sessionBodyToAuthCodeBody(sessionBody),
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const getPasskeyVerify = async (c: Context<typeConfig.Context>) => {
  const dto = new baseDto.PasskeyVerifyDto({ email: c.req.query('email') ?? '' })
  await validateUtil.dto(dto)

  const options = await passkeyService.genPasskeyVerifyOptions(
    c,
    dto.email,
  )

  if (!options) return c.json({ passkeyOption: null })

  await kvService.setPasskeyVerifyChallenge(
    c.env.KV,
    dto.email,
    options.challenge,
  )

  return c.json({ passkeyOption: options })
}

export const postPasskeyVerify = async (c: Context<typeConfig.Context>) => {
  const reqBody = await c.req.json()

  const bodyDto = new embeddedDto.PostPasskeyVerifyDto(reqBody)
  await validateUtil.dto(bodyDto)

  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBody(
    c,
    sessionId,
  )

  const {
    user, newCounter, passkeyId,
  } = await passkeyService.processPasskeyVerify(
    c,
    bodyDto.email,
    bodyDto.passkeyInfo,
  )

  await passkeyService.updatePasskeyCounter(
    c,
    passkeyId,
    newCounter,
  )

  const result = await processAuthorizeWithUser(
    c,
    sessionId,
    {
      ...sessionBody,
      isFullyAuthorized: true,
    },
    user,
  )

  return c.json({
    sessionId,
    nextStep: result.nextPage,
    success: !result.nextPage,
  })
}

export const getRecoveryCodeEnroll = async (c: Context<typeConfig.Context>) => {
  const sessionId = c.req.param('sessionId')
  const sessionBody = await getSessionBodyWithUser(
    c,
    sessionId,
  )

  const {
    recoveryCode, user,
  } = await recoveryCodeService.getRecoveryCodeEnrollmentInfo(
    c,
    sessionBodyToAuthCodeBody(sessionBody),
  )

  const { AUTHORIZATION_CODE_EXPIRES_IN: codeExpiresIn } = env(c)
  const newAuthCodeStore = {
    ...sessionBody,
    user,
  }
  await kvService.storeEmbeddedSession(
    c.env.KV,
    sessionId,
    newAuthCodeStore,
    codeExpiresIn,
  )

  return c.json({ recoveryCode })
}

export const resetPassword = async (c: Context<typeConfig.Context>) => {
  const reqBody = await c.req.json()
  const bodyDto = new embeddedDto.ResetPasswordDto(reqBody)
  const email = bodyDto.email
  const locale = requestUtil.getLocaleFromQuery(
    c,
    bodyDto.locale,
  )

  await identityService.processResetPassword(
    c,
    email,
    locale,
  )

  return c.json({ success: true })
}

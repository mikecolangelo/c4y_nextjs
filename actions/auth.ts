"use server"
import { z } from "zod"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { STRAPI_BASE_URL_HOSTNAME } from "@/lib/config"
import { STRAPI_BASE_URL_PORT, STRAPI_BASE_URL_PROTOCOL } from "@/lib/config"

import { SignUpFormSchema, SignInFormSchema, type FormState } from "@/validations/auth"
import { registerUserService, loginUserService, createUserProfile } from "@/lib/strapi"

const buildCookieConfig = async () => {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const hostname = host.split(":")[0];
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
  const domain = isLocalhost ? undefined : hostname;
  return {
    maxAge: 60 * 60 * 24 * 7, // 1 week,
    path: '/',
    httpOnly: true, // only accessible by the server
    domain,
    secure: process.env.NODE_ENV === 'production',
  };
};

export async function registerUserAction(prevState: FormState, formData: FormData): Promise<FormState> {

  const fields = {
    fullName: formData.get('fullName') as string,
    username: formData.get('username') as string,
    password: formData.get('password') as string,
    email: formData.get('email') as string,
  }

  const validatedFields = SignUpFormSchema.safeParse(fields)

  if (!validatedFields.success) {
    const flattenedErrors = z.flattenError(validatedFields.error)

    console.log("Validation errors:", flattenedErrors.fieldErrors)

    return {
      success: false,
      message: "Validation error",
      strapiErrors: undefined,
      zodErrors: flattenedErrors.fieldErrors,
      data: fields
    }
  }

  const response = await registerUserService({
    username: validatedFields.data.username,
    email: validatedFields.data.email,
    password: validatedFields.data.password,
  })

  if (!response || response.error) {
    return {
      success: false,
      message: "Registration error",
      strapiErrors: response?.error,
      zodErrors: null,
      data: fields
    }
  }

  // Crear el user-profile con rol "driver" automáticamente
  if (response.user && response.user.id) {
    await createUserProfile(
      response.user.id,
      validatedFields.data.fullName,
      validatedFields.data.email
    )
  }

  const cookieStore = await cookies()
  const cookieConfig = await buildCookieConfig()
  cookieStore.set('jwt', response.jwt, cookieConfig)
  redirect('/dashboard')
}

export async function loginUserAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const headerList = await headers();
  const fields = {
    identifier: formData.get('identifier') as string,
    password: formData.get('password') as string,
  }

  const validatedFields = SignInFormSchema.safeParse(fields)

  if (!validatedFields.success) {
    const flattenedErrors = z.flattenError(validatedFields.error)

    return {
      success: false,
      message: "Validation error",
      strapiErrors: undefined,
      zodErrors: flattenedErrors.fieldErrors,
      data: fields
    }
  }

  const response = await loginUserService(fields)

  if (!response || response.error) {
    return {
      success: false,
      message: "Login error",
      strapiErrors: response?.error,
      zodErrors: null,
      data: fields
    }
  }

  const cookieStore = await cookies()
  const cookieConfig = await buildCookieConfig()
  cookieStore.set('jwt', response.jwt, cookieConfig)
  redirect('/dashboard')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('jwt')
  // Limpiar la cookie del tema para que no persista después del logout
  cookieStore.delete('admin-theme')
  redirect('/signin')
}
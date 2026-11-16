import { supabaseAuthService } from './supabaseAuthService'

type AuthProvider = 'supabase'

const services: Record<AuthProvider, AuthService> = {
  supabase: supabaseAuthService,
}

const requestedProvider = import.meta.env.VITE_AUTH_PROVIDER

export const authService = services[requestedProvider]

export { AuthError } from './AuthError'
export type { AuthService } from './AuthService'


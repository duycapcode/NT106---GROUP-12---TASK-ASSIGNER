

import { supabaseAuthService } from './supabaseAuthService'
import type { AuthService } from './AuthService'

export const authService: AuthService = supabaseAuthService

export { AuthError } from './AuthError'
export type { AuthService } from './AuthService'
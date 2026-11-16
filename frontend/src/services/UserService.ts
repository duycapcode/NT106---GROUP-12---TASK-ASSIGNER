import {getClient} from '@/features/auth/services/supabaseAuthService'

export async function getMyProfile() {
    const supabase = getClient()
    const {
        data: {user},
        error: AuthError,
    } = await supabase.auth.getUser()

    if (AuthError) throw AuthError
    if (!user) throw new Error('Bạn chưa đăng nhập')
    
    const { data, error } = await supabase
        .from('Users')
        .select('UserId, Username, AvataPath')
        .eq('UserId', user.id)
        .single()
    
    if (error) throw error

    return data

}
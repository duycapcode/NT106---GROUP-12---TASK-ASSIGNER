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

export async function updateMyName(name: string) {
  const supabase = getClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!user) throw new Error('Bạn chưa đăng nhập.')

  const { data, error } = await supabase
    .from('Users')
    .update({ Username: name })
    .eq('UserId', user.id)
    .select('UserId, Username')
    .single()

  if (error) throw error
  if (data.UserId !== user.id || data.Username !== name) {
    throw new Error('Supabase chưa xác nhận tên mới. Hãy kiểm tra lại dữ liệu trong bảng Users.')
  }

  return data
}

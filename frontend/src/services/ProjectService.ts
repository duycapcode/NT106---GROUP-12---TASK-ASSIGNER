import {getClient} from '@/features/auth/services/supabaseAuthService'

export async function getMyProject() {
    const supabase = getClient ()

    const {data , error} = await supabase
        .from('Projects')
        .select('*')
        .order('CreatedAt',{ascending : false})

    if (error) throw error
    
    return data
}

export async function createProject(
    name: string,
    description: string,
    startdate: string,
    duedate: string

) {
    const supabase = getClient()

    const {data, error} = await supabase.rpc('create_project',{
        p_name : name,
        p_description : description,
        p_start_date : startdate,
        p_due_date : duedate
    })

    if (error) throw error

    return data


}
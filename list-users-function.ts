import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase URL or Service Role Key missing in environment.')
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
        if (error) throw error

        const safeUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.user_metadata?.full_name || u.user_metadata?.name || '',
            role: u.user_metadata?.role || 'representative',
            created_at: u.created_at,
        }))

        return new Response(JSON.stringify(safeUsers), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('[list-users] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

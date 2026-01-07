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
        const { email, name, role } = await req.json()
        console.log(`[DEBUG] Request received for: ${email}, Name: ${name}, Role: ${role}`)

        // Check Env Vars
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        console.log(`[DEBUG] Env Check - URL: ${!!supabaseUrl}, Key: ${!!serviceRoleKey}`)

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase URL or Service Role Key missing in environment.')
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

        // Invite
        console.log('[DEBUG] Calling inviteUserByEmail...')
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                full_name: name,
                role: role || 'representative',
                force_password_change: true
            }
        })

        if (error) {
            console.error('[DEBUG] Supabase Invite Error:', error)
            throw error
        }

        console.log('[DEBUG] Success! Data:', JSON.stringify(data))

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('[DEBUG] Application Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

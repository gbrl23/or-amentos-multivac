
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Simple env parser
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envConfig = {}
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=')
    if (key && val) {
        envConfig[key.trim()] = val.join('=').trim()
    }
})

const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTable() {
    console.log('Checking for "orcamentos" table...')
    // Try to select. If table doesn't exist, it usually throws a specific error or returns null data with error.
    const { data, error } = await supabase.from('orcamentos').select('*').limit(1)

    if (error) {
        console.log('Error accessing table:', JSON.stringify(error, null, 2))
        if (error.code === '42P01') { // Postgres code for undefined table
            console.log('CONFIRMED: Table does not exist.')
        }
    } else {
        console.log('Success! Table exists.')
    }
}

checkTable()

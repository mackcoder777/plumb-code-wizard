import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CostCode {
  code: string;
  description: string;
  category: 'L' | 'M';
  subcategory?: string;
  units?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verified for user:', user.id);

    const { codes, replaceAll } = await req.json() as { 
      codes: CostCode[], 
      replaceAll: boolean 
    };

    if (!Array.isArray(codes) || codes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty codes array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${codes.length} cost codes, replaceAll: ${replaceAll}`);

    // If replaceAll, delete existing codes first
    if (replaceAll) {
      console.log('Deleting existing cost codes...');
      const { error: deleteError } = await supabase
        .from('cost_codes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) {
        console.error('Failed to delete existing codes:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete existing codes', details: deleteError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Existing codes deleted successfully');
    }

    // Insert new codes with created_by field
    const codesToInsert = codes.map(code => ({
      ...code,
      created_by: user.id,
    }));

    console.log('Inserting new cost codes...');
    const { data, error } = await supabase
      .from('cost_codes')
      .insert(codesToInsert)
      .select();

    if (error) {
      console.error('Failed to insert codes:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to insert codes', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully inserted ${data?.length || 0} cost codes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: data?.length || 0,
        message: `Successfully uploaded ${data?.length || 0} cost codes` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in upload-cost-codes function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

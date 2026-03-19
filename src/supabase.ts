import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nxypqccehsbzeyzqszev.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eXBxY2NlaHNiemV5enFzemV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDMyODgsImV4cCI6MjA4OTUxOTI4OH0.p9Z4f6007lWHCQgMipVuKtqIryqioxTxuxsUUziPCOk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from '@/lib/supabase/server';
import UsageLogs from '@/components/billing/usage-logs';

export default async function UsageLogsPage() {
  const supabaseClient = await createClient();
  const { data: personalAccount } = await supabaseClient.rpc(
    'get_personal_account',
  );

  return (
    <div className="space-y-6">
      <UsageLogs accountId={personalAccount.account_id} />
    </div>
  );
}

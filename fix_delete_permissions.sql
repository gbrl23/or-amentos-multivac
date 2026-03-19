-- Enable DELETE for users on their own budgets
-- This policy allows a user to delete a row in 'orcamentos' ONLY if they are the owner (user_id matches their auth.uid())

create policy "Enable delete for users based on user_id"
on "public"."orcamentos"
as permissive
for delete
to public
using (
  (auth.uid() = user_id)
);

-- Optional: If you want admins to delete ANY budget, you can add this policy:
-- create policy "Enable delete for admins"
-- on "public"."orcamentos"
-- as permissive
-- for delete
-- to public
-- using (
--   (auth.jwt() ->> 'role' = 'admin') OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
-- );

# WIMPEX storage setup

## Supabase Storage bucket
Create a public bucket named `wpx-videos` in Supabase Storage.

### Suggested bucket settings
- Public bucket: true
- Allowed MIME types: `video/mp4`, `video/quicktime`, `video/webm`, `video/x-m4v`, `video/ogg`
- File size limit: `104857600` bytes (100 MB)

### Storage policy example
Use a policy that allows authenticated users to upload files into their own folder and read public objects.

```sql
-- Example policy for uploads into /videos/{user_id}/...
create policy "Users can upload their own videos"
on auth.users
for insert
to authenticated
with check (
  bucket_id = 'wpx-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read public videos"
on storage.objects
for select
to public
using (bucket_id = 'wpx-videos');
```

### Notes
- The app currently uploads to `videos/{user_id}/{filename}` in the `wpx-videos` bucket.
- If the bucket already exists, the app will continue without failing.
- For production, add stricter object lifecycle rules and signed URLs if you want private media access.


ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#2563eb';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#1e40af';

-- Create a storage bucket for organization assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-assets', 'organization-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload to organization-assets
-- Note: You might want to restrict this further to only allow users to upload to their own organization's folder
CREATE POLICY "Authenticated users can upload organization assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'organization-assets' );

-- Policy to allow public to view organization assets
CREATE POLICY "Public can view organization assets"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'organization-assets' );

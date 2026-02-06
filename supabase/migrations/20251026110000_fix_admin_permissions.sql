-- Allow System Admins to view any organization
CREATE POLICY "System Admins can view any organization"
ON public.organizations FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow System Admins to update any organization
CREATE POLICY "System Admins can update any organization"
ON public.organizations FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow System Admins to delete any organization
CREATE POLICY "System Admins can delete any organization"
ON public.organizations FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Fix Storage Policies for organization-assets
-- Allow updates to organization-assets for authenticated users (needed for upsert/replace logo)
CREATE POLICY "Authenticated users can update organization assets"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'organization-assets' );

-- Allow deletes to organization-assets for authenticated users
CREATE POLICY "Authenticated users can delete organization assets"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'organization-assets' );

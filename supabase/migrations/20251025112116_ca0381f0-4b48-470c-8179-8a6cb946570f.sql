-- Create app_role enum for role management
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'user');

-- Create user_roles table with proper security
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 
  CASE 
    WHEN role = 'admin' THEN 'admin'::app_role
    WHEN role = 'agent' THEN 'agent'::app_role
    ELSE 'user'::app_role
  END
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Update profiles table: prevent users from modifying their own role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile (except role)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add explicit authentication requirement for profiles SELECT
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Add explicit authentication requirement for customers
CREATE POLICY "Require authentication for customers"
ON public.customers
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Add explicit authentication requirement for orders
CREATE POLICY "Require authentication for orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Add explicit authentication requirement for payments
CREATE POLICY "Require authentication for payments"
ON public.payments
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Add explicit authentication requirement for installments
CREATE POLICY "Require authentication for installments"
ON public.installments
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only admins can insert/update/delete roles (via has_role function)
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
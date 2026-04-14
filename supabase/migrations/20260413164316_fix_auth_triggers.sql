
-- Drop the old triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TRIGGER IF EXISTS on_profile_created_seed_categories ON public.profiles;
DROP FUNCTION IF EXISTS public.seed_default_categories();

-- Recreate with explicit public schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, icon, color, category_type) VALUES
    (NEW.id, 'Makan', 'ShoppingBag', '#F59E0B', 'expense'),
    (NEW.id, 'Kopi', 'Coffee', '#92400E', 'expense'),
    (NEW.id, 'Transport', 'Car', '#3B82F6', 'expense'),
    (NEW.id, 'Bensin', 'Fuel', '#EF4444', 'expense'),
    (NEW.id, 'Belanja', 'ShoppingCart', '#8B5CF6', 'expense'),
    (NEW.id, 'Listrik', 'Zap', '#F97316', 'expense'),
    (NEW.id, 'Hiburan', 'Gamepad2', '#EC4899', 'expense'),
    (NEW.id, 'Kesehatan', 'Heart', '#10B981', 'expense'),
    (NEW.id, 'Gaji', 'Landmark', '#059669', 'income'),
    (NEW.id, 'Bonus', 'Gift', '#14B8A6', 'income'),
    (NEW.id, 'Lainnya', 'Receipt', '#6B7280', 'both');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_seed_categories
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();
;

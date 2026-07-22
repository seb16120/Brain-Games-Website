# Authentification Brain Games

## 1. Fonctionnement livré

- Google est présenté comme connexion principale.
- E-mail + mot de passe est disponible en solution de secours.
- La session est conservée par Supabase sur l’appareil.
- Le joueur peut modifier son nom de profil.
- Les profils anonymes employés par certains jeux sont exclus.
- La table `public.profiles` applique RLS : chaque joueur ne voit et ne modifie
  que son propre profil.

## 2. Activation Google à faire une seule fois

La connexion Google a besoin d’un identifiant client et d’un secret Google, que
seul le propriétaire du projet peut créer.

1. Dans Google Cloud, créer un client OAuth Web.
2. Ajouter comme URL de redirection autorisée :
   `https://lktwlonqzlhhkxiggotb.supabase.co/auth/v1/callback`
3. Dans Supabase, ouvrir Authentication > Providers > Google.
4. Activer Google et renseigner l’identifiant client et le secret.
5. Dans Authentication > URL Configuration, utiliser :
   - Site URL : `https://seb16120.github.io/Brain-Games-Website/`
   - Redirect URL : `https://seb16120.github.io/Brain-Games-Website/**`

Sans cette configuration Google, l’inscription et la connexion e-mail/mot de
passe continuent de fonctionner.

## 3. Sécurité

Le navigateur utilise uniquement la clé publique Supabase. Les politiques RLS
vérifient à la fois `auth.uid()` et que le compte n’est pas anonyme. Le nom
provenant de Google ou du formulaire sert uniquement à l’affichage et n’est
jamais utilisé comme autorisation.

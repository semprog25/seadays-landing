================================================================================
SeaDays Landing Page Package
================================================================================

This folder contains all the necessary files for the SeaDays landing page website.
You can copy this entire folder to your web server or hosting provider.

--------------------------------------------------------------------------------
FILE LIST
--------------------------------------------------------------------------------

1. HTML PAGES (Main Website)
   - index.html         (Homepage with waitlist, features, and blog preview)
   - landing-page.html  (The main homepage with waitlist and features)
   - blog.html          (Blog listing - Port Site Stories from the community)
   - blog-article.html  (Individual article page with full content)
   - about.html         (About Us page)
   - help.html          (Help Center & FAQ)
   - faq.html           (Frequently Asked Questions)
   - contact.html       (Contact form and support info)
   - community.html     (Community features and guidelines)
   - terms.html         (Terms & Conditions - Updated with pricing)
   - privacy.html       (Privacy Policy - GDPR compliant)
   - cookies.html       (Cookie Policy)
   - gdpr.html          (GDPR compliance and data rights)

2. ADMIN TOOLS
   - waitlist-admin.html (Dashboard to view/export waitlist subscribers)
   - seo-admin.html     (SEO settings - Meta title, description, og:site_name, robots, etc.)

3. SCRIPTS
   - seo-inject.js      (Fetches admin-configured SEO and injects meta tags - include in pages)

4. BACKEND SETUP
   - waitlist-backend-setup.txt (Instructions and code for Supabase waitlist)

5. ADMOB VERIFICATION
   - app-ads.txt (Required for Google AdMob app verification - upload to web root)

--------------------------------------------------------------------------------
HOW TO USE
--------------------------------------------------------------------------------

1. Deploy HTML Files:
   - Upload all .html files AND app-ads.txt to your public_html or www folder.
   - app-ads.txt must be at the root (e.g. https://yoursite.com/app-ads.txt) for AdMob verification.
   - Use `index.html` or `landing-page.html` as your homepage (both are included).

2. Verify Links:
   - All internal links are set up to work with these file names.
   - The "Start Planning" buttons link to `https://seadays.app/app`.
   - Legal links open in new tabs (`target="_blank"`).

3. SEO Admin Setup:
   - Set Supabase secret SEO_ADMIN_USER_IDS (comma-separated user UUIDs) to allow admin access.
   - Sign in at seo-admin.html with a whitelisted account to manage meta tags.

5. Waitlist Setup (Optional):
   - If you want to re-enable the waitlist feature, you can use the `waitlist-admin.html` tool.
   - See `waitlist-backend-setup.txt` for backend deployment instructions.

--------------------------------------------------------------------------------
GDPR & LEGAL
--------------------------------------------------------------------------------

- The Privacy Policy and Terms & Conditions have been updated with your contact
  details (privacy@seadays.app, legal@seadays.app).
- Ensure you monitor these email addresses for data requests.

--------------------------------------------------------------------------------
IMAGES
--------------------------------------------------------------------------------

- All images are currently hosted on ImgHippo (SeaDays Logo).
- The background starfield is CSS-generated (no image file needed).
- Phone mockups (if any) in the hero section use CSS frames.

Enjoy your new landing page! 🚢

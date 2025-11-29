================================================================================
SeaDays Landing Page Package
================================================================================

This folder contains all the necessary files for the SeaDays landing page website.
You can copy this entire folder to your web server or hosting provider.

--------------------------------------------------------------------------------
FILE LIST
--------------------------------------------------------------------------------

1. HTML PAGES (Main Website)
   - landing-page.html  (The main homepage with "Start Planning" flow)
   - about.html         (About Us page)
   - help.html          (Help Center & FAQ)
   - contact.html       (Contact form and support info)
   - terms.html         (Terms & Conditions - Updated with pricing)
   - privacy.html       (Privacy Policy - GDPR compliant)

2. ADMIN TOOLS
   - waitlist-admin.html (Dashboard to view/export waitlist subscribers)

3. BACKEND SETUP
   - waitlist-backend-setup.txt (Instructions and code for Supabase waitlist)

--------------------------------------------------------------------------------
HOW TO USE
--------------------------------------------------------------------------------

1. Deploy HTML Files:
   - Upload all .html files to your public_html or www folder.
   - Ensure `landing-page.html` is your index page (rename to index.html if needed).

2. Verify Links:
   - All internal links are set up to work with these file names.
   - The "Start Planning" buttons link to `https://seadays.semprog.de/app`.
   - Legal links open in new tabs (`target="_blank"`).

3. Waitlist Setup (Optional):
   - If you want to re-enable the waitlist feature, you can use the `waitlist-admin.html` tool.
   - See `waitlist-backend-setup.txt` for backend deployment instructions.

--------------------------------------------------------------------------------
GDPR & LEGAL
--------------------------------------------------------------------------------

- The Privacy Policy and Terms & Conditions have been updated with your contact
  details (privacy@seadays.semprog.de, legal@seadays.semprog.de).
- Ensure you monitor these email addresses for data requests.

--------------------------------------------------------------------------------
IMAGES
--------------------------------------------------------------------------------

- All images are currently hosted on ImgHippo (SeaDays Logo).
- The background starfield is CSS-generated (no image file needed).
- Phone mockups (if any) in the hero section use CSS frames.

Enjoy your new landing page! 🚢

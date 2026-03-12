/**
 * SeaDays SEO Inject - Fetches global SEO settings from API and injects/updates meta tags.
 * Include this script early in <head> for pages that should use admin-configured SEO defaults.
 * Only updates meta tags that are not already set with content (preserves page-specific overrides).
 */
(function() {
    const API = 'https://soqkgrfzluewpuiguypm.supabase.co/functions/v1/make-server-51d3ca8d';

    function setMetaIfEmpty(nameOrProp, content, isProp) {
        if (!content) return;
        var attr = isProp ? 'property' : 'name';
        var el = document.querySelector('meta[' + attr + '="' + nameOrProp + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, nameOrProp);
            document.head.appendChild(el);
        }
        if (!el.getAttribute('content') || el.getAttribute('content').trim() === '') {
            el.setAttribute('content', content);
        }
    }

    function run() {
        fetch(API + '/site-seo')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.error || !data.metaTitle) return;
                setMetaIfEmpty('description', data.metaDescription, false);
                setMetaIfEmpty('robots', data.robots, false);
                setMetaIfEmpty('max-image-preview', data.maxImagePreview, false);
                setMetaIfEmpty('og:site_name', data.ogSiteName, true);
                setMetaIfEmpty('article:author', data.articleAuthor, true);
                if (!document.title || document.title === '') {
                    document.title = data.metaTitle;
                }
            })
            .catch(function() {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();

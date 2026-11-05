'use strict';

const { SEADAYS_NO_PHOTO_WEBP_PATH } = require('./seadaysNoPhotoAsset');

/** Inline script: allow same-origin /assets/ and https images; block legacy CDN/SVG. */
function buildDirectoryRuntimeImageGuardScript() {
  return `<script>
(function(){
  var FB='${SEADAYS_NO_PHOTO_WEBP_PATH}';
  function safeImage(src){
    var s=String(src||'').trim();
    if(!s)return FB;
    if(s.startsWith('/assets/')&&!s.includes('..'))return s;
    if(!s.startsWith('https://'))return FB;
    if(s.includes('cdn.seadays.app'))return FB;
    if(s.indexOf('/storage/v1/object/sign/')!==-1)return FB;
    if(s.split('?')[0].toLowerCase().endsWith('.svg'))return FB;
    return s;
  }
  function applyGuard(){
    document.querySelectorAll('img[data-img-source]').forEach(function(el){
      var orig=el.getAttribute('src')||'';
      var safe=safeImage(orig);
      if(safe!==orig){el.dataset.originalSrc=orig;el.src=safe;}
    });
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',applyGuard);}
  else{applyGuard();}
})();
</script>`;
}

module.exports = { buildDirectoryRuntimeImageGuardScript };

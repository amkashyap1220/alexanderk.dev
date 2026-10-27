/* ==========================================================================
   Shows the Private tab (and hides "Log in") when you're logged in.
   Loaded in <head> so it's set before the page paints, with no flash.

   It reads the signed_in=1 cookie the login sets (worker/auth.js). That
   cookie only changes what's shown: the private pages themselves are
   checked by the Worker with a separate cookie scripts can't read.
   ========================================================================== */

if (/(?:^|;\s*)signed_in=1(?:;|$)/.test(document.cookie)) document.documentElement.classList.add("signed-in");

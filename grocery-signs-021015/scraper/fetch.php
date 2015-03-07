<?php
// Simple proxy to bypass CORS restriction on scraped sites.
echo readfile($_GET["url"]);
?>
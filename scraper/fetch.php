<?php
// Simple proxy to bypass CORS restriction on scraped sites.
$url = $_GET["url"];
$curl = $_GET["curl"];
$tor = $_GET["tor"];

if ($curl || $tor) {
	// Use cURL.
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
	
	// Function for header output.
	function dump_header( $curl, $header_line ) {
		header($header_line);
		return strlen($header_line);
	}
	curl_setopt($ch, CURLOPT_HEADERFUNCTION, "dump_header"); 

	if ($tor) {
		// Proxy through TOR.
		curl_setopt($ch, CURLOPT_HTTPPROXYTUNNEL, 1); 
		curl_setopt($ch, CURLOPT_PROXY, "http://127.0.0.1:9050/");
		curl_setopt($ch, CURLOPT_PROXYTYPE, 7 /*CURLPROXY_SOCKS5_HOSTNAME*/);
	}

	curl_exec($ch);
	curl_close($ch);
} else {
	// Use plain HTTP wrapper.
	readfile($url);
	/*
	foreach ($http_response_header as $header) {
		header($header);
		echo($header);
	}
	print_r($out);
	*/
}
?>
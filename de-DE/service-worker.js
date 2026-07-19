fan_base_url_prefix = "/galzyr-translate/de-DE";
console.log('[ServiceWorker] Initialising...');

var VERSION = '2.1.23';
var LANGUAGE = 'en-GB';
var CACHE_NAME = 'Lands-V'+VERSION;
var FILES_TO_CACHE = [
	fan_base_url_prefix+'/',

	// CSS
	fan_base_url_prefix+'/css/style.css?v='+VERSION,
];

self.addEventListener('install', function(event) {

	messageAllClients('Event-Install');

	// Determine language, default to en-GB
	const swURL = new URL(location);
	LANGUAGE = swURL.searchParams.get('language') ?? LANGUAGE;
	var AUDIOFORMAT = swURL.searchParams.get('audio-format') ?? '.';
	var ENCYCLOPEDIA = swURL.searchParams.get('encyclopedia') ?? 0;

	// Determine asset url (php script that takes language into account)
	var assetURL = AUDIOFORMAT == '.' ? fan_base_url_prefix+'/assets.json' : fan_base_url_prefix+'/assets-'+AUDIOFORMAT+'.json';

	// Add possible language version index.html to cache, like /es
	if (LANGUAGE != 'en-GB') {
		FILES_TO_CACHE.push(fan_base_url_prefix + '/' + LANGUAGE.split('-')[0]);
	}

	// Add a possible dev url with parameters to the files to cache, like /?devmode=0
	// The end user shouldn't have any parameters set, but this is needed at least for development work
	var searchParams = swURL.searchParams.get('url-parameters');
	if (searchParams !== '' && searchParams != null) {
		var URLParameters = decodeURIComponent(searchParams);
		FILES_TO_CACHE.push(fan_base_url_prefix + '/' + URLParameters);
		if (LANGUAGE != 'en-GB') {
			// The same for other language versions
			FILES_TO_CACHE.push(fan_base_url_prefix + '/' + LANGUAGE.split('-')[0] + URLParameters);
		}
	}

	event.waitUntil(
		fetch(assetURL)
			.then(response => response.json())
			.then(jsonData => {
			// Update the cache with all files got from the PHP script
			FILES_TO_CACHE = FILES_TO_CACHE.concat(jsonData);

			console.log("FILES_TO_CACHE:");
			console.log(FILES_TO_CACHE);

			// Cache all files
			return caches.open(CACHE_NAME).then(function(cache) {
				messageAllClients('Language detected by the service worker: '+LANGUAGE);
				messageAllClients('Pre-caching offline page');
				return cache.addAll(FILES_TO_CACHE);
			})
		})
	);

	self.skipWaiting();
});

// Activated upon clean-up of an old service worker version
// Used to clean old caches
self.addEventListener('activate', function(event) {

	messageAllClients('Event-Activate');
	
	event.waitUntil(
		caches.keys().then((keyList) => {
			return Promise.all(keyList.map((key) => {
				if (key !== CACHE_NAME) {
					messageAllClients('Removing old cache:'+key);
					messageAllClients('Updated');
					messageAllClients(['Updated', VERSION]);
					return caches.delete(key);
				}
			}));
		})
	);
	self.clients.claim();
});


// Cache-first fetch for assets
self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	// We only try to find items from our cache that were originally saved there
	// Otherwise, we could end up saving random files there, like those requested by browser extensions
	// Requests not on the cache list are normally handled by the browser via network.
	if (FILES_TO_CACHE.includes(url.pathname + url.search)) {
		event.respondWith(cacheFirst(event.request));
	}
});

async function cacheFirst(request) {
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}
	try {
		const networkResponse = await fetch(request);
		// networkResponse.status 206 is a partial response (with large files, like music)
		// It doesn't like to be put in cache
		if (networkResponse.ok || networkResponse.status !== 206) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		return Response.error();
	}
}


self.addEventListener('message', function(event){
	if (event.data == 'check-version') {
		console.log('[ServiceWorker] Checking version...');
		event.ports[0].postMessage(VERSION);
	}
});

function messageClient(client, msg){
	return new Promise(function(resolve, reject){
		var msg_chan = new MessageChannel();

		msg_chan.port1.onmessage = function(event){
			if(event.data.error){
				reject(event.data.error);
			}else{
				resolve(event.data);
			}
		};

		client.postMessage(msg, [msg_chan.port2]);
	});
}

function messageAllClients(msg){
	console.log('[ServiceWorker] '+msg);

	clients.matchAll().then(clients => {
		clients.forEach(client => {
			messageClient(client, msg).then(m => console.log("SW Received Message: "+m));
		})
	})
}
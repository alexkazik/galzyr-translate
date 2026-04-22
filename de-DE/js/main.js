fan_base_url_prefix = "/galzyr-translate/de-DE";
fan_language = "de-DE"
fan_app = true
fan_language_name = "german"
var version = $('html').attr('version');

var devMode = true;
var animationSpeed = 300;
var mobileWidth = 720;
var month = "";
var day = 0;
var prestigeEarned1p = 0;
var prestigeEarned2p = 0;
var stories = [];
var encyclopedia = {};
var autoOpen = (getUrlParams('scene') != null ? true : false);
var forceNewStories = (getUrlParams('format') == 'all' ? true : false);
var touchInProgress = false;
var saveSceneID = 533;
var sessionID = null;
var preventReload = true;
var deviceType = false;
var e1 = ($('body').hasClass('e1') ? true : false);
var e2 = ($('body').hasClass('e2') ? true : false);
var expansionsExist = (e1 || e2 ? true : false);
var language = ($('html').attr('lang') != undefined ? $('html').attr('lang') : 'en-GB');

// Music and sound variables
var currentTrackID = 0;
var currentTrack = null;
var trackListUpdate = null;
var disableSounds = false;
var rangeslidersInitiated = false;
var simplifiedVolumeControls = false;

// Speech synthesis variables
var textToSpeechAvailable = false;
var synthesis = false;
var speechBlocks = [];
var pendingSpeech = [];
var newSpeechStarting = false;

// Trivia variables
var triviaQuestions = [];
var triviaQuestionNumber = 0;
var triviaCorrect = 0;
var triviaResults = {
	0: 'subscene-3346',
	1: 'subscene-3347',
	2: 'subscene-3348',
	3: 'subscene-3349',
	4: 'subscene-3350',
	5: 'subscene-3351',
	6: 'subscene-3352',
	7: 'subscene-3353',
	8: 'subscene-3354',
	9: 'subscene-3355',
	10: 'subscene-3356',
}

// Default settings
var settings = {
	'volumeSound':			70,
	'volumeMusic':			50,
	'volumeTextToSpeech':	70,
	'trackSelection':		'all',
	'coopChallenge':		'disabled',
	'expansion1':			'disabled',
	'expansion2':			'disabled',
	'textToSpeech':			'disabled',
	'fontSize':				'default',
	'fontStyle':			'default',
	'textEffects':			'default',
	'increasedContrast':	'disabled',
	'verbHighlight':		'disabled',
	'scrollSpeed':			'default',
	'sceneListDividers':	'disabled',
	'sendData':				'enabled',
	'settingsShown':		'false',
};
var settingsDefault = $.extend(true,{},settings);

var previousVolume = {
	'volumeSound':			70,
	'volumeMusic':			50,
	'volumeTextToSpeech':	70,
}

var scrollSpeedMultipliers = {
	'slow':				1.5,
	'default':			1,
	'fast':				0.3,
};

var soundsInitialised = false;

var soundNames = [
	null,						// So indexing starts at 1
	'sound-button-press',
	'sound-button-release',
	'sound-day-token-grab',
	'sound-day-token-release',
	'sound-day-token-slide',
	'sound-modal-show',
	'sound-modal-hide',
	'sound-scene-list-select',
	'sound-volume-adjustment',
	'sound-achievement-unlock',
	'sound-encyclopedia',
];
var musicNames = [
	null,						// So indexing starts at 1 for months to match
	'music-01-january',
	'music-02-february',
	'music-03-march',
	'music-04-april',
	'music-05-may',
	'music-06-june',
	'music-07-july',
	'music-08-august',
	'music-09-september',
	'music-10-october',
	'music-11-november',
	'music-12-december',
];
var allAudio = {
	'sound': {},
	'music': {},
};

// ================================================ //
// MARK: Music + sounds
// ================================================ //

function initialiseAudio(){
	// Initialise sound
	for (var i = 1; i < soundNames.length; i++) {
		var audioName = soundNames[i];
		allAudio['sound'][audioName] = new Howl({
			src: [fan_base_url_prefix+'/audio/'+audioName+'.mp3', fan_base_url_prefix+'/audio/'+audioName+'.ogg'],
			html5: true,
			volume: getSetting('volumeSound')/100,
		});
		allAudio['sound'][audioName]['audioID'] = i;
	}

	// Initialise music
	for (var i = 1; i < musicNames.length; i++) {
		var audioName = musicNames[i];
		allAudio['music'][audioName] = new Howl({
			src: [fan_base_url_prefix+'/audio/'+audioName+'.mp3', fan_base_url_prefix+'/audio/'+audioName+'.ogg'],
			html5: true,
			volume: getSetting('volumeMusic')/100,
		});
		allAudio['music'][audioName]['audioID'] = i;
	}
	
	soundsInitialised = true;
}

$('body').on('touchstart mousedown', '.sfx-button', function(e){
	if (e.type == 'touchstart') touchInProgress = true;

	// Many touch devices trigger BOTH touchstart AND mousedown
	// We should only play the sound on touchstart on those devices
	if (touchInProgress) {
		if (e.type != 'mousedown') playSound('button-press', e.type);
	} else {
		playSound('button-press', e.type);
	}
	
	if (e.type == 'mousedown') touchInProgress = false;
});

// Mute / unmute sounds with a click of the icon
$('body').on('click', '.volume-icon', function(){
	type = $(this).data('type');

	if ($(this).parent('.col-slider').hasClass('mute')) {
		// When unmuting, restore previous volume
		var newVolume = previousVolume[type];
	} else {
		// When muting, store previous volume
		var newVolume = 0;
		previousVolume[type] = settings[type];
	}

	setSetting(type, newVolume, true, false);
});

// SFX button sounds
$('body').on('click', '.sfx-button', function(){ playSound('button-release'); });
$('body').on('click', '.sfx-toggle', function(){ playSound('button-release'); });

function adjustVolume(type, newVolume) {
	if (!soundsInitialised) return;

	for (var key in allAudio[type]) {
		allAudio[type][key].volume(newVolume/100);
	}
}

function playSound(sound, eventType = false, fadeMusic = false) {
	if (!soundsInitialised) initialiseAudio();

	if (settings['volumeSound'] == 0) return;

	var audio = allAudio['sound']['sound-'+sound];

	if (!fadeMusic || !currentTrack.playing()) {
		// Just play without any fade tricks
		audio.play();
	} else {
		// If multiple instances have been clicked, remove previous return fades
		audio.off(); // Doesn't seem to work?

		// Fade music for the duration of the sound
		if (simplifiedVolumeControls) {
			musicControl('pause');
		} else {
			for (var key in allAudio['music']) allAudio['music'][key].fade(currentTrack.volume(), 0, 500);
		}

		audio.play();
		audio.once('end', function(){
			if (simplifiedVolumeControls) {
				musicControl('play');
			} else {
				for (var key in allAudio['music']) allAudio['music'][key].fade(currentTrack.volume(), settings['volumeMusic']/100, 2000);
			}
		});
	}
}

function playMusic(music, eventType = false) {
	if (!soundsInitialised) initialiseAudio();

	if (music == 'currentMonth') music = musicNames[month];

	for (var key in allAudio['music']) {
		allAudio['music'][key].off();	// Clear any possibly lingering end events
		allAudio['music'][key].stop();	// Stop any possibly playing music
	}

	currentTrack = allAudio['music'][music];
	if (settings['volumeMusic'] == 0) {
		// Music is disable, mark the player as paused
		$('.soundtrack').addClass('paused');
	} else {
		// Music is not disabled, play normally
		currentTrack.play();
	}
	currentTrack.once('end', musicEnd);

	currentTrackID = currentTrack['audioID'];

	// console.log(currentTrack);
	// console.log('started music: '+music+' ID: '+currentTrackID);

	$('.music-settings').removeClass('faded');

	// Highlight the track on the track list
	$('.playhead').css('width', '0');
	$('.time .current').text('0:00');
	$('#track-'+(currentTrackID)).addClass('playing').siblings().removeClass('playing');
}

document.onkeydown = function(e) {
	e = event || window.event;
	if ((e.keyCode == 37 || e.keyCode == 39) && e.altKey && currentTrack != null) {
		// Alt + left / right moves back or advances the music mostly for debugging
		var trackProgress = currentTrack.seek();
		var trackLength = currentTrack.duration();
		if (e.keyCode == 37) var newPos = (trackProgress > 30 ? trackProgress - 30 : 0);
		if (e.keyCode == 39) var newPos = (trackProgress < trackLength - 30 ? trackProgress + 30 : trackLength - 0.5);
		currentTrack.seek(newPos);
		updateMusicPlayer();
	}
};

function musicEnd() {
	// Check if new music is already playing?
	// Like if new game is played right away and new music replaces old

	if (getSetting('trackSelection') == 'monthly') {
		// Loop the same track
		playMusic('currentMonth');
	} else {
		// Play the next track
		var nextTrackID = (currentTrackID == 12 ? 1 : currentTrackID + 1);
		playMusic(musicNames[nextTrackID]);
	}
}

function fadeOutMusic(playNext = false) {
	// Fade current away
	if (simplifiedVolumeControls) {
		musicControl('pause');
	} else {
		for (var key in allAudio['music']) allAudio['music'][key].fade(settings['volumeMusic']/100, 0, 2000);
	}

	setTimeout(function() {
		for (var key in allAudio['music']) {
			allAudio['music'][key].off();	// Clear any possibly lingering end events
			allAudio['music'][key].stop();	// Stop any possibly playing music
		}
		adjustVolume('music', settings['volumeMusic']);	// Reset volume
		if (playNext) {
			playMusic('currentMonth');		// Begin next track
		} else {
			// Stop playing entirely
			currentTrack = null;
			$('.track').removeClass('playing');
			$('.music-settings').addClass('faded');
		}
	}, 2000);
}

function updateMusicPlayer() {
	if (currentTrack == null) return;

	var trackLength = currentTrack.duration();
	var trackProgress = currentTrack.seek();
	$('.playing .playhead').css('width', (trackProgress/trackLength*100)+'%');
	$('.playing .time .current').text(formatTime(trackProgress));
}

function formatTime(seconds) {
	var minutes = Math.floor(seconds / 60) || 0;
	var seconds = Math.floor(seconds - minutes * 60) || 0;

	return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function musicControl(control) {
	switch (control) {
		case 'pause':
			currentTrack.pause();
			$('.soundtrack').addClass('paused');
			break;
		case 'play':
			currentTrack.play();
			$('.soundtrack').removeClass('paused');
			break;
	}
}

// MARK: Set settings

function setSetting(setting, newValue, updateUI = false, playSounds = true) {
	if (!playSounds) disableSounds = true;

	// Save setting to local storage
	localStorage.setItem(setting, newValue);

	// Update settings object
	settings[setting] = newValue;
	
	// console.log('Setting saved - '+setting+': '+newValue);

	// Based on setting set, adjust things like volume etc.
	if (setting == 'volumeTextToSpeech') {
		if (updateUI) $('.input-volume-text-to-speech').val(newValue).change();
		updateVolumeIcon($('.input-volume-text-to-speech').siblings('.volume-icon'), newValue);
	} else if (setting == 'volumeSound') {
		if (updateUI) $('.input-volume-sound').val(newValue).change();
		adjustVolume('sound', newValue);
		updateVolumeIcon($('.input-volume-sound').siblings('.volume-icon'), newValue);
		if (newValue == 0 || newValue == 100) updateSettingButtons(setting, 'val-'+newValue);
	} else if (setting == 'volumeMusic') {
		if (updateUI) $('.input-volume-music').val(newValue).change();
		adjustVolume('music', newValue);
		updateVolumeIcon($('.input-volume-music').siblings('.volume-icon'), newValue);

		if (currentTrack != null) {
			if (newValue == 0) {
				musicControl('pause');
			} else if (!currentTrack.playing()) {
				musicControl('play');
			}
		}
		if (newValue == 0 || newValue == 100) updateSettingButtons(setting, 'val-'+newValue);
	} else if (setting == 'trackSelection') {
		updateSettingButtons(setting, newValue);
		$('.soundtrack').removeClass('monthly all').addClass(newValue);
		// If chosen monthly and current month is not chosen, change the track
		if (newValue == 'monthly' && currentTrackID != month) playMusic('currentMonth');
	} else if (setting == 'coopChallenge') {
		if (newValue == 'enabled')	$('body').addClass('coop-challenge');
		if (newValue == 'disabled')	$('body').removeClass('coop-challenge');
		updateSettingButtons(setting, newValue);
	} else if (setting == 'expansion1' || setting == 'expansion2') {
		// Update body classes (to show and hide scenes in the scene list)
		if (setting == 'expansion1') {
			if (newValue == 'enabled') {
				$('body').addClass('e1-selected');
				$('.unfinished-expansion-1-message').slideDown();
			}
			if (newValue == 'disabled') {
				$('body').removeClass('e1-selected');
				$('.unfinished-expansion-1-message').slideUp();
			}
		}
		if (setting == 'expansion2') {
			if (newValue == 'enabled') {
				$('body').addClass('e2-selected');
				$('.unfinished-expansion-2-message').slideDown();
			}
			if (newValue == 'disabled')	{
				$('body').removeClass('e2-selected');
				$('.unfinished-expansion-2-message').slideUp();
			}
		}
		// Update toggle and checkbox
		updateSettingButtons(setting, newValue, 'toggle');
		updateSettingButtons(setting, newValue, 'checkbox');
	} else if (setting == 'textToSpeech') {
		updateSettingButtons(setting, newValue);
		// Hide / show text to speech volume
		if (newValue == 'enabled') {
			// Enable speech volume control
			$('.volume-text-to-speech').slideDown();
			updateSliders();
		} else {
			// Disable speech volume control
			$('.volume-text-to-speech').slideUp();
		}
	} else if (setting == 'fontSize') {
		updateSettingButtons(setting, newValue);
		$('body').removeClass('font-size-small font-size-default font-size-large').addClass('font-size-'+newValue);
	} else if (setting == 'fontStyle') {
		updateSettingButtons(setting, newValue);
		$('body').removeClass('font-style-default font-style-non-cursive').addClass('font-style-'+newValue);
	} else if (setting == 'textEffects') {
		updateSettingButtons(setting, newValue);
		$('body').removeClass('effects-reduced effects-disabled effects-default').addClass('effects-'+newValue);
	} else if (setting == 'increasedContrast') {
		// Increase / decrease story text contrast
		updateSettingButtons(setting, newValue);
		if (newValue == 'enabled') {
			// Show scene list dividers
			$('body').addClass('increased-contrast');
		} else {
			// Hide scene list dividers
			$('body').removeClass('increased-contrast');
		}
	} else if (setting == 'sceneListDividers') {
		updateSettingButtons(setting, newValue);
		// Hide / show scene list dividers
		if (newValue == 'enabled') {
			// Show scene list dividers
			$('body').addClass('scene-list-dividers');
		} else {
			// Hide scene list dividers
			$('body').removeClass('scene-list-dividers');
		}
	} else if (setting == 'verbHighlight') {
		updateSettingButtons(setting, newValue);
		// Hide / show verb highlighting in option names
		if (newValue == 'enabled') {
			// Show scene list dividers
			$('body').addClass('verb-highlight');
		} else {
			// Hide scene list dividers
			$('body').removeClass('verb-highlight');
		}
	} else if (setting == 'scrollSpeed') {
		updateSettingButtons(setting, newValue);
	} else if (setting == 'sendData') {
		updateSettingButtons(setting, newValue);
	}

	if (!playSounds) disableSounds = false;
}

function updateSettingButtons(setting, button, type = 'toggle') {
	if (type == 'toggle') {
		// Toggle button
		$('.settings-toggle-holder.'+setting).children('.settings-toggle').addClass('not-chosen');
		$('.settings-toggle-holder.'+setting).children('.'+button).removeClass('not-chosen');
	} else {
		// Checkbox button
		if (button == 'enabled') {
			$('.settings-checkbox-holder.'+setting).children('.settings-checkbox').removeClass('not-chosen');
		} else {
			$('.settings-checkbox-holder.'+setting).children('.settings-checkbox').addClass('not-chosen');
		}
	}
}

function hideModal(){
	$curtain = $('#info-modal-curtain');
	if (!$curtain.hasClass('show')) return;

	$curtain.removeClass('show');
	playSound('modal-hide');

	setTimeout(function() {
		$curtain.hide();
		$('.reminder-visible').removeClass('reminder-visible');
	}, 300);
}

function openSettings($scrollTarget = false) {
	// If the modal is open, close it
	// We can click the settings button when the settings reminder is shown
	hideModal();
	setSetting('settingsShown', 'true');

	// Start updating the track list every second
	updateMusicPlayer();
	trackListUpdate = setInterval(updateMusicPlayer, 1000);

	if (textToSpeechAvailable) {
		pendingSpeech = speechBlocks.slice(0);
		synthesis.cancel();
	}

	if (getSetting('showReleaseNotes') == 'yes') {
		$('#curtain').addClass('show-release-notes');
		localStorage.setItem('showReleaseNotes', 'no');
	}

	playSound('modal-show');

	$('#curtain').show();
	setTimeout(function() {
		$('body').addClass('show-settings');
		$('.settings').scrollTop(0);
		if ($scrollTarget) $('.settings').scrollTop($scrollTarget.position().top);
		updateSliders();
	}, 10);
}

function closeSettings() {
	// Stop updating the track list to save on resources
	clearInterval(trackListUpdate);

	$('body').removeClass('show-settings');

	playSound('modal-hide');

	setTimeout(function() {
		$('#curtain').hide();
		$('#curtain').removeClass('show-release-notes');

		if (textToSpeechAvailable) textToSpeech(false, false);
	}, 500);
}

function updateSliders() {
	// Range sliders (sounds + music + text-to-speech)
	if (!rangeslidersInitiated) $('input[type="range"]').rangeslider({ polyfill: false });

	$('input[type="range"]').rangeslider('update', true);
}

function updateVolumeIcon($icon, volume) {
	var newIcon = '[VOL_0]';
	if (volume == 0) {
		$icon.closest('.col-slider').addClass('mute');
	} else {
		$icon.closest('.col-slider').removeClass('mute');
	}
	if (volume > 0)		newIcon = '[VOL_1]';
	if (volume > 33.3)	newIcon = '[VOL_2]';
	if (volume > 66.6)	newIcon = '[VOL_3]';
	$icon.text(newIcon);
}

// ================================================ //
// MARK: Text to speech synthesiser
// ================================================ //

mysterySpeechDictionary = {
	'a': 'foo', 'A': 'Foo',
	'b': 'c', 'B': 'C',
	'c': 'wu', 'C': 'Wu',
	'd': 'f', 'D': 'F',
	'e': 'fa', 'E': 'Fa',
	'f': 'z', 'F': 'Z',
	'g': 'q', 'G': 'Q',
	'h': 'pu', 'H': 'Pu',
	'i': 'cy', 'I': 'Cy',
	'j': 'l', 'J': 'L',
	'k': 'j', 'K': 'J',
	'l': 'hu', 'L': 'Hu',
	'm': 'ra', 'M': 'Ra',
	'n': 'b', 'N': 'B',
	'o': 'ne', 'O': 'Ne',
	'p': 'd', 'P': 'D',
	'q': 'v', 'Q': 'V',
	'r': 'ky', 'R': 'Ky',
	's': 'gy', 'S': 'Gy',
	't': 's', 'T': 'S',
	'u': 'si', 'U': 'Si',
	'v': 'x', 'V': 'X',
	'w': 'no', 'W': 'No',
	'x': 'm', 'X': 'M',
	'y': 'u', 'Y': 'u',
	'z': 'tu', 'Z': 'Tu',
	'å': 'tee', 'Å': 'Tee',
	'ä': 'nu', 'Ä': 'Nu',
	'ö': 'pii', 'Ö': 'Pii',
}

function jumbleMysteryText($block) {
	if($block.find('.mystery').length !== 0) {
		$block.find('.mystery').each(function(){
			var text = scrambleText($(this).text(), 1);
			$(this).html(text);
			console.log('scrambled: ' + text);
		});
	}
	return $block;
}

function scrambleText(text, shift) {
	var scrambledText = '';
	for(var i = 0; i < text.length; i++){
		if (text[i] in mysterySpeechDictionary) {
			scrambledText += mysterySpeechDictionary[text[i]];
		} else {
			scrambledText += text[i];
		}
	}
	return scrambledText;
}

function textToSpeech($block = false, cancelPrevious = true) {
	// console.log('speech called');
	if (getSetting('textToSpeech') != 'enabled') return;	// Return if speech is disabled

	if (cancelPrevious) {
		newSpeechStarting = true;
		synthesis.cancel();
		speechBlocks = [];

		if (!$block.length) return;

		// If the block has mystery text in it, jumble its letters so the speech synth doesn't spoil the proper meaning
		$block = jumbleMysteryText($block.clone());

		// Split text into smaller chunks so Chrome doesn't bug out
		$block.children('p').each(function(){
			// OLD: split only at paragaphs
			// speechBlocks.push($(this).html());

			// NEW: split at paragraphs AND sentences
			var flavour = $(this).text();
			if (flavour.match(/[\.\?\!]/)) {
				// Text does include . ? !
				// Split it by them
				flavour.match(/\(?[^\.\?\!]+[\.!\?]\)?/g).forEach(
					sentence => speechBlocks.push(sentence)
				);
			} else {
				// Text does NOT include . ? !
				// Do not split it
				speechBlocks.push(flavour);
			}
		});
	} else {
		speechBlocks = pendingSpeech.slice(0);
	}

	setTimeout(function () {
		// Speack each paragraph separately (to avoid a Chrome bug and to add a short pause)
		for (var i = 0; i < speechBlocks.length; i++) {
			newSpeech(speechBlocks[i]);
			newSpeechStarting = false;
		}
	}, 100);
}

function newSpeech(message) {
	var msg = new SpeechSynthesisUtterance();
	// fan: use translated language instead of english
	var language = fan_language;
	msg.lang = language;

	if (['safari-ios', 'safari-mac'].includes(deviceType) && language == 'en-GB') {
		// Safari has poor default en-gb voice
		// Let's default to "Daniel"
		msg.voice = synthesis.getVoices().find(voice => /Daniel/.test(voice.name));
	}
	if (msg.voice == null || msg.voice == undefined) {
		// For other devices (or if Daniel if not found, use first en-gb)
		var languageRegex = new RegExp(language.replace('-', '(-|_)'));
		msg.voice = synthesis.getVoices().find(voice => languageRegex.test(voice.lang));
	}

	msg.text = message;
	msg.volume = getSetting('volumeTextToSpeech')/100;

	msg.addEventListener('end', function () {
		onSpeechEnd();
	});

	// IMPORTANT! Do not remove: Logging the object out fixes some onend firing issues
	console.log(msg);

	// placing the speak invocation inside a callback fixes ordering and onend issues
	setTimeout(function () {
		synthesis.speak(msg);
	}, 0);
}

function onSpeechEnd() {
	// Remove the spoken sentence from the array
	// But only if we are continuing to speak, not if we start a new one
	if (!newSpeechStarting) speechBlocks.shift();
}

function scanDevice() {
	var device = false;
	var nav = navigator.userAgent;

	if (nav.search("Edg") >= 0) {
		// EDGE
		device		= 'edge-desktop';
	} else if (nav.search('Chrome') >= 0) {
		// DIFFERENT IF DESKTOP OR ANDROID
		if (nav.search('Windows') >= 0 || nav.search('Macintosh') >= 0) {
			device	= 'chrome-desktop';
		} else if (nav.search('Android') >= 0) {
			device	= 'chrome-android';
		}
	} else if (nav.search('Firefox') >= 0) {
		// ONLY IF MOBILE (Android)
		if (nav.search('Android') >= 0) {
			device	= 'firefox-mobile';
		}
	} else if (nav.search('Safari') >= 0 && nav.search('Chrome') < 0) {
		// ONLY IF iOS
		// if (nav.search('iPad') >= 0 || nav.search('iPhone') >= 0) {
		if ("ontouchend" in document) {
			// Detect if the device has touch as iPads can lie about being a Mac with their userAgent
			device	= 'safari-ios';
		} else {
			device	= 'safari-mac';
		}
	}
	return device;
}



var storiesLoaded = false;
var encyclopediaLoaded = false;

$(document).ready(function() {
	// ALWAYS disable dev mode for the generated static HTML version
	if (fan_app && ($('body').hasClass('static') || getUrlParams('devmode') == 0)) devMode = false;

    // fan: add some text
    $('.logo').after('<div class="fan-version-head"><div class="highlight-block"><b>Fan project: automatic '+fan_language_name+' translation of the stories</b></div></div>');
    if (!fan_app) {
        $('.notification-install').hide();
    }
    $('.begin-holder').prepend('<div class="fan-version-note" id="fan-version-unknown"><div class="highlight-block"><p><strong>Possibly outdated version</strong></p><p>This tool is based on version '+version+', and it\'s unclear what version the <a href="http://stories.daimyria.fi/">original english storybook</a> is.</p></div></div>');
    $('.begin-holder').prepend('<div class="fan-version-note"><div class="highlight-block">This is done with the ok from Sami Laakso, the author.<br>There are some caveats though:<ul><li>This tool is based on the <a href="http://stories.daimyria.fi/">original english storybook</a><li>Only the stories, options and many effects and buttons are translated - everything else is unchanged<li>The stories and options are translated with deepl API, effects and buttons are translated manually<li>The expansion is mostly translated<li>Text effects are missing (e.g. wobbly text)<li>The installed app (optional) does not work offline<li>I\'ll release the source to the translator once it\'s finished and cleaned up<li><a href="https://boardgamegeek.com/thread/3673499/fan-project-automatic-german-translation" target="_blank">BGG forum about this project</a></ul></div></div>')

    // fan: version check
    $.ajax({type: 'GET', url: 'https://dev.stories.daimyria.fi/version.php', success: function(liveVersion){
      $('#fan-version-unknown').hide();
      if (liveVersion != version){
        $('#fan-version-unknown').after('<div class="fan-version-note"><div class="highlight-block"><p><strong>Outdated version</strong></p><p>This tool is based on version '+version+', but the <a href="http://stories.daimyria.fi/">original english storybook</a> is already at version '+liveVersion+'.</p><p>This will be updated eventually, just be in the clear that it is currently not up to date.</p></div></div>');
      }
    }});

    // fan: remove data collection settings (since they are not used)
    $('.sendData').parent().parent().next().remove();
    $('.sendData').parent().parent().remove();

	// WARN ABOUT LEAVING THE EDITOR IF THERE ARE UNSAVED CHANGES
	window.onbeforeunload = function() {
		if (preventReload && currentTrack != null) {
			return $('#notification-close-warning').val();
		}
	}

	deviceType = scanDevice();
	if (deviceType == 'safari-ios') {
		// iOS doesn't support streamig audio volume control
		// Revert to simplified audio controls (enable / disable)

		simplifiedVolumeControls = true;
		$('body').addClass('simplified-volume-controls');

		settings['volumeSound']					= 100;
		settings['volumeMusic']					= 100;
		settings['volumeTextToSpeech']			= 100;
		settingsDefault['volumeSound']			= 100;
		settingsDefault['volumeMusic']			= 100;
		settingsDefault['volumeTextToSpeech']	= 100;
	}

	// ================================================ //
	// MARK: Load stories JSON
	// ================================================ //

	if ($('body').hasClass('encyclopedia-enabled')) {
		var jsonURL = fan_base_url_prefix+'/json/encyclopedia-'+language.toLowerCase()+'.json';
		if (autoOpen || forceNewStories) {
			jsonURL += '?v='+Date.now();
		} else {
			jsonURL += '?v=' + version;
		}
		$.getJSON(jsonURL).done(function(data) {
			$.each(data, function(i, entry) {
				encyclopedia[entry['SPECIES']] = {
					'description':	entry['DESCRIPTION'],
					'image':		entry['IMAGE'],
				};
			});
			encyclopediaLoaded = true;
			if (storiesLoaded) doneLoading();
		}).fail(function(jqxhr, textStatus, error) {
			var err = textStatus + ', ' + error;
			console.log('Encyclopedia JSON request Failed: ' + err);
		});
	} else {
		encyclopediaLoaded = true;
	}

	var jsonURL = fan_base_url_prefix+'/json/stories-'+language.toLowerCase()+'.json';
	if (autoOpen || forceNewStories) {
		jsonURL += '?v='+Date.now();
	} else {
		jsonURL += '?v=' + version;
	}

	$progressBar = $('.loading-holder .progress-bar');

	$.ajax({
		xhr: function() {
			var xhr = new window.XMLHttpRequest();
			
			// We need to see the actual size of the stories file as Cloudflare zips it on the fly and doesn't provide evt.total
			var totalStorySize = $('body').data('story-size');

			// Download progress
			xhr.addEventListener('progress', function(evt){
				// if (evt.lengthComputable) {
					// var percentComplete = evt.loaded / evt.total;
					var percentComplete = evt.loaded / totalStorySize;

					// Adjust so the bar begins at 10%
					percentComplete = percentComplete * 90 + 10;
					$progressBar.css('width', percentComplete+'%');
				// }
			}, false);

			return xhr;
		},
		type: 'GET',
		url: jsonURL,
		// data: {},
		success: function(data){
			// Stories downloaded
			$.each(data, function(i, story) {
				stories[story['ID']] = story['HTML'];
			});

			storiesLoaded = true;
			if (encyclopediaLoaded) doneLoading();
		},
		fail: function(jqxhr, textStatus, error) {
			var err = textStatus + ', ' + error;
			console.log('Story JSON request Failed: ' + err);
		}
	});

	function doneLoading() {
		// DONE LOADING!
		$('.message-loading').fadeOut(function() {
			$('.message-complete').fadeIn(function() {
				$('.loading-holder').delay(500).fadeOut(function() {
					$('body').removeClass('loading');
					
					// Only show the "Book of Stories" header if we don't have expansion selection
					if (!expansionsExist) $('.intro h2').fadeIn();

					$('.begin-holder').fadeIn(function(){
						// Open scene, if certain GET parameters are set
						if (autoOpen) debugScene();
					});
				});
			});
		});
	}

	// PWA install message
	if (window.matchMedia('(display-mode: standalone)').matches) {  
		// We're in an installed PWA
		console.log('Launched PWA.');
		disableBackButton();
	} else {
		// console.log('We\'re inside a browser.');
		installNotification();
	}

	// ================================================ //
	// MARK: Service worker
	// ================================================ //

	var registration;

	if (devMode) {
		console.log('Development mode active, service worker unavailable.');
		// registration.stop();
	} else if ('serviceWorker' in navigator) {
		console.log('Attempting to install the service worker.');

		// Check if we should try to cache MP3 or OGG
		var audioFormat = '.';
		const supportedOutcomes = ['probably', 'maybe'];
		if (supportedOutcomes.includes(document.createElement('audio').canPlayType('audio/mpeg;'))) {
			audioFormat = 'mp3';
		} else if (supportedOutcomes.includes(document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'))) {
			audioFormat = 'ogg';
		}

		// Attempt to load service worker
		var swURL = fan_base_url_prefix+'/service-worker.js';
		swURL += '?language='+language;
		swURL += '&audio-format='+audioFormat;
		if ($('body').hasClass('encyclopedia-enabled')) swURL += '&encyclopedia=1';
		
		
		// ?devmode=0&expansion1=0
		const currentURL = new URL(location.href);
		if (currentURL.search !== '') {
			swURL += '&url-parameters=' + encodeURIComponent(currentURL.search);
		}

		navigator.serviceWorker.register(swURL, { scope: fan_base_url_prefix+'/' }).then((reg) => {
			console.log('Service worker registered successfully.', reg);
			registration = reg;
		}).catch(function (e) {
			console.error('Error during service worker registration:', e);
		});
	
		// Handler for messages coming from the service worker
		navigator.serviceWorker.addEventListener('message', function(event){
			console.log('[Service Worker]: ' + event.data);
			if (event.data[0] == 'Updated') {
				notify('refresh', $('#notification-new-version').val().replace('[VERSION]', event.data[1]));
			}
			// event.ports[0].postMessage('Client says hello.');
		});
	} else {
		console.log('Service worker not available.');
	}

	function messageServiceWorker(msg){
		return new Promise(function(resolve, reject){
			// Create a Message Channel
			var msg_chan = new MessageChannel();

			// Handler for recieving message reply from service worker
			msg_chan.port1.onmessage = function(event){
				if (event.data.error){
					reject(event.data.error);
				} else {
					resolve(event.data);
				}
			};

			// Send message to service worker along with port for reply
			navigator.serviceWorker.controller.postMessage(msg, [msg_chan.port2]);
		});
	}

	// ================================================ //
	// MARK: APP install banner
	// ================================================ //

	function installNotification() {
		var installAvailable = (deviceType != false ? true : false);
		if (deviceType == 'safari-mac') {
			// Only MacOS Safari 18+ supports PWA
			var nav = navigator.userAgent;
			var regexVersion = /Version\/([\d\.]+)/g;
			var safariVersion = regexVersion.exec(nav)[1];
			if (safariVersion < 18) installAvailable = false;
		}
		
		if (installAvailable) {
			$('.settings .pwa-install').show();
			$('.install-instruction.'+deviceType).show();
			$('.notification-install').addClass('show');
		}
	}

	$('.notification-install .close').click(function(){
		playSound('modal-hide');
		$('.notification-install').removeClass('show');
	});

	// ================================================ //
	// MARK: Updating the APP
	// ================================================ //

	// Set the name of the hidden property and the change event for visibility
	var hidden, visibilityChange; 
	if (typeof document.hidden !== 'undefined') { // Opera 12.10 and Firefox 18 and later support 
		hidden = 'hidden';
		visibilityChange = 'visibilitychange';
	} else if (typeof document.msHidden !== 'undefined') {
		hidden = 'msHidden';
		visibilityChange = 'msvisibilitychange';
	} else if (typeof document.webkitHidden !== 'undefined') {
		hidden = 'webkitHidden';
		visibilityChange = 'webkitvisibilitychange';
	}

	// Detect when the page is visible
	function handleVisibilityChange() {
		if (document[hidden]) {
			// console.log('hidden');
		} else {
			// Try to update
			// alert('become visible');
			if (!devMode) registration.update();

			// messageServiceWorker('check-version').then(m => console.log(m));
			// console.log('visible');
		}
	}

	if (typeof document.addEventListener === 'undefined' || hidden === undefined) {
		console.log('No support for page visibility.');
	} else {
		// Handle page visibility change   
		document.addEventListener(visibilityChange, handleVisibilityChange, false);
	}

	// ================================================ //
	// MARK: Encyclopedia modals
	// ================================================ //

	$('body').on('click', '.encyclopedia', function() {
		showInfoModal($(this), 'encyclopedia', $('.encyclopedia-entry'));
	});

	$('body').on('click', '.open-modal', function(event) {
		showInfoModal($(this), 'info', $('.'+$(this).data('modal')));
		event.stopPropagation();
	})

	function showInfoModal($target, type, $modal) {
		$curtain = $('#info-modal-curtain');
		if (type == 'encyclopedia') {
			var entry = encyclopedia[$target.data('entry')];

			// Update modal contents
			$modal.find('p.description').html(entry['description']);
			if (entry['image'] != '') {
				imageURL = 'url("img/encyclopedia/' + entry['image'] + '")';
				$modal.addClass('with-image');
			} else {
				imageURL = '';
				$modal.removeClass('with-image');
			}
			$modal.find('span.image').css({ 'background-image': imageURL });
		} else if (type == 'reminder') {
			$target.addClass('reminder-visible');
		}

		$modal.show().siblings().hide();

		// Calculate bubble orientation and position
		var modalD = $modal.getRealDimensions();
		var extraPadding = 20;
		var entryWidth = $target.outerWidth();
		var entryHeight = $target.outerHeight();
		var entryLeft = $target.offset().left;
		var entryTop = $target.offset().top - $(window).scrollTop();
		var windowWidth = $(window).width();

		// From which direction should the modal be revealed?
		var revealDirection = 'down';
		if (entryTop < (modalD.height + extraPadding * 2)) revealDirection = 'up';
		$curtain.removeClass().addClass('reveal-'+revealDirection);

		if (revealDirection == 'down') {
			var newTop = entryTop - modalD.height - extraPadding;
		} else {
			var newTop = entryTop + entryHeight + extraPadding;
		}
		
		var newLeft = entryLeft + (entryWidth / 2) - (modalD.width / 2);
		
		// TOO FAR LEFT
		if (newLeft < extraPadding) newLeft = extraPadding;

		// TOO FAR RIGHT
		if ((newLeft + modalD.width + extraPadding) > windowWidth) {
			newLeft = windowWidth - modalD.width - extraPadding;
		}

		// Where should be move the pointing arrow?
		var arrowLeft = (entryWidth / 2) - (newLeft - entryLeft) - 10;
		
		// Which side should we put the image?
		if (arrowLeft > (modalD.width / 2)) {
			$modal.addClass('image-left');
		} else {
			$modal.removeClass('image-left');
		}

		$modal.css({ top: newTop+'px', left: newLeft+'px' });
		$modal.find('.arrow').css({ left: arrowLeft+'px' });

		// Show the bubble
		$curtain.show();
		playSound('encyclopedia');
		setTimeout(function() {
			$curtain.addClass('show');
		}, 10);
	}

	$('.info-modal a').click(function(event){
		// Do not close the info modal when a link is clicked inside it
		event.stopPropagation();
	});

	$('#info-modal-curtain').click(function(){
		hideModal();
	});

	// ================================================ //
	// MARK: Settings
	// ================================================ //

	// Load settings if there are any
	for (const [key, value] of Object.entries(settings)) {
		if (getSetting(key)) setSetting(key, getSetting(key), true);
	}

	// Reset settings to defaults
	$('.reset-to-defaults').click(function() {
		for (const [key, value] of Object.entries(settingsDefault)) {
			setSetting(key, value, true, false);
		}
	});

	$('body').on('click', '.settings-show', function(){
		$scrollTarget = false;
		if ($(this).data('scroll-target')) $scrollTarget = $('#settings-'+$(this).data('scroll-target'));
		openSettings($scrollTarget);
	});

	// Close settings/release notes curtain if clicked the area around it
	$('#curtain').click(function(e) {
		if ($(e.target).closest('.curtain-container').length == 0 ||
			$(e.target).hasClass('curtain-close')) closeSettings();
	});
	
	$(document).on('input', '.input-range', function(e) {
		var newVolume = parseInt($(this).val());
		setSetting($(this).data('attribute'), newVolume);

		// Play sound on sound effects adjustment
		if ($(this).hasClass('input-volume-sound') && !disableSounds) {
			waitForFinalEvent(function() {
				playSound('volume-adjustment');
			}, 200, 'Set sound volume');
		}

		// Speak text to speech volume
		if ($(this).hasClass('input-volume-text-to-speech') && !disableSounds) {
			waitForFinalEvent(function(){
				synthesis.cancel();
				newSpeech(newVolume.toString());
			}, 200, 'Speak volume');
		}
	});

	$(document).on('touchstart', '.rangeslider', function() {
		// Disable scrolling via touch while adjusting volumes
		$('.settings').bind('mousewheel touchmove', lockScroll);
	});

	$(document).on('touchend', '.rangeslider', function() {
		// Enable scrolling via touch again
		$('.settings').unbind('mousewheel touchmove', lockScroll);
	});

	// Selection toggle buttons
	$('.settings-toggle').click(function(){
		// $(this).removeClass('not-chosen').siblings().addClass('not-chosen');
		setSetting($(this).parent().data('attribute'), $(this).data('value'));
	});

	// Selection checkbox parents (so you can click anywhere on the parent for the checkbox to activate)
	$('.checkbox-block').click(function(event){
		// Do not toggle the checkbox when the info-modal was clicked
		if ($(event.target).is(".open-modal")) return;

		$(this).find('.settings-checkbox').click();
	});

	// Selection checkboxes
	$('.settings-checkbox').click(function(event){
		event.stopPropagation();
		if ($(this).hasClass('not-chosen')) {
			var value = 'enabled';
		} else {
			var value = 'disabled';
		}
		setSetting($(this).parent().data('attribute'), value);
	});

	// Show / hide release notes
	$('.release-notes-show').click(function(){
		playSound('modal-show');
		$('.release-notes').scrollTop(0);
		$('#curtain').addClass('show-release-notes');
	});
	$('.release-notes-close').click(function(){		
		$('#curtain').removeClass('show-release-notes');
	});

	// START OVER BUTTON
	$('.button.start-over').click(function(){
		// Hide any possible scene input errors
		closeSceneInputErrors();

		closeSettings();
		fadeOutMusic();
		switchScene('intro', true, true);
	});

	if ('speechSynthesis' in window) {
		
		// Enable the user to be able to change the setting
		$('.settings-text-to-speech').removeClass('setting-disabled');
		synthesis = window.speechSynthesis;
		textToSpeechAvailable = true;

		// console.log(voices);
	}

	// ================================================ //
	// MARK: Back button (mostly for Android)
	// ================================================ //

	function disableBackButton() {
		history.pushState(null, null, window.location.href);
		window.onpopstate = () => history.forward();
	}

	// TODO: Could add special functionality in the future
	// https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onpopstate
	function moveBack() {
		if ($('#curtain').hasClass('show-release-notes')) {
			// Release notes -> Settings
			console.log(1);
		} else if ($('body').hasClass('show-settings')) {
			// Close settings
			console.log(2);
		} else if (!$('#scene-intro').hasClass('active')) {
			// Go back to intro/home
			console.log(3);
		} else if (!$('#scene-intro').hasClass('active')) {
			// Start a new game
			console.log(4);
		} else {
			// Allow basic back button
		}
	}

	// ================================================ //
	// MARK: Special option glimmer
	// ================================================ //

	function optionSpecialGlimmer($option) {
		// Max number of starts
		limit = $('.scene-holder').outerWidth() / 40;

		$starContainer = $('<div class="star-container">');

		for (var i = 0; i <= limit; i++) {
			$star = $('<div class="star">&#10022;</div>');
			$star.css('top', Math.random() * 100 + '%');
			$star.css('left', Math.random() * 100 + '%');
			$star.css('webkitAnimationDelay', Math.random() * -1.5 + 's');
			$star.css('mozAnimationDelay', Math.random() * -1.5 + 's');
			$starContainer.append($star);
		}

		$option.find('h2').append($starContainer);
	}

	// ================================================ //
	// MARK: Achievement opening
	// ================================================ //

	function openAchievements($parent, delay = 0) {
		// Check if the parent has achievements
		if(!$($parent).children('.achievement-wrapper').length) return;
		$achievement = $parent.find('> .achievement-wrapper > .achievement');

		playSound('achievement-unlock', false, true);

		setTimeout(function() {
			$achievementWidth = $achievement.find('.achievement-text').outerWidth();
			$achievement.addClass('open').css('max-width', $achievementWidth);
		}, delay);
	}

	// ================================================ //
	// MARK: Scene number input
	// ================================================ //

	$('#input-scene-number').inputFilter(function(value) {
		return /^\d*$/.test(value);	// Allow digits only, using a RegExp
	});

	$('#input-scene-number').on('focus',function(e) {
		$(this).val('');
		// $('.footer').addClass('deactive');
	});

	$('#input-scene-number').on('keyup',function(e) {
		// Enter removes focus and activates the function too
		if(e.which == 13) $(this).blur();

		// Activate/Deactivate the arrow button
		if ($('#input-scene-number').val() != '') {
			$('#open-scene').addClass('active');
		} else {
			$('#open-scene').removeClass('active');
		}
	});

	$('#open-scene').click(validateInputScene);

	$('#input-scene-number').blur(validateInputScene);

	function validateInputScene(){
		// Fix janky iOS Safari scroll behaviour
		$('html').scrollTop(0);

		var inputText = $("#input-scene-number").val();
		// Do nothing on empty input
		if (inputText == '') return;

		$('#open-scene').removeClass('active');

		var scene = inputText.padStart(4, '0');
		$listScene = $('.visual-scene-'+scene);

		var inputError = false;
		if (!$listScene.length) {
			inputError = 'missing-scene';
		} else if ($listScene.hasClass('game-1') && settings['expansion1'] == 'disabled') {
			inputError = 'missing-e1';
		} else if ($listScene.hasClass('game-1') && settings['expansion1'] == 'disabled') {
			inputError = 'missing-e2';
		}
		
		if (inputError) {
			$('.input-scene-number-error:not(".'+inputError+'")').slideUp();
			$('.input-scene-number-error.'+inputError).slideDown();
			$('#open-scene').removeClass('active');
		} else {
			// Scene exists and is accessible with the chosen expansions

			// Hide any possible scene input errors
			closeSceneInputErrors();

			$listScene.click();

			// Scroll the list to the correct spot if the list is visible
			if ($('.layout-menu').hasClass('show') || $(window).width() > mobileWidth) {
				var currentScroll = $('.layout-menu .inner').scrollTop();
				var newScroll = $listScene.position().top - $('.scene-list li.active').outerHeight();
				if ($('body').hasClass('scene-list-dividers')) newScroll = newScroll - $('.scene-list .divider').outerHeight();
				var timeScroll = getScrollAnimationTime(Math.abs(currentScroll - newScroll));

				$('.layout-menu .inner').animate({scrollTop: newScroll}, timeScroll);
			}
		}
	}

	function closeSceneInputErrors() {
		$('.input-scene-number-error').slideUp();
		$('#input-scene-number').val('');
	}

	function getScrollAnimationTime(scrollDistance) {
		var animationTime = Math.floor(Math.log(scrollDistance) * 120);
		return animationTime;
	}



	// ================================================ //
	// MARK: Notification banner
	// ================================================ //

	function notify(action, msg) {
		if (action == 'refresh') {
			$('.notification-update .icon').text('[RFR]');
			$('.notification-update').attr('data-action', 'refresh');
		}
		$('.notification-update .message').html(' '+msg);
		$('.notification-update').addClass('show');
		playSound('volume-adjustment');
	}

	$('.notification-update').click(function(){
		if ($(this).data('action') == 'refresh') {
			preventReload = false;	// Allow refresh without annoying popup

			// Save to settings that we have refreshed a new version
			localStorage.setItem('showReleaseNotes', 'yes');
			location.reload();
		}
	});
	// If so, show release notes on refresh and reset the setting
	if (getSetting('showReleaseNotes') == 'yes') openSettings();

	// ================================================ //
	// MARK: Book functionality
	// ================================================ //

	// NEW GAME BUTTON
	$('.button.begin').click(function(){
		// TODO: Generate unique sessionID for gathering play data
		generateSessionID();

		// Move the logo upwards, fadeout the button
		$('body').removeClass('title-screen');

		// Prepare to animate the day token
		$('.day-list-ui').removeClass('neutral-position');

		// Scroll scenelist
		$('.layout-menu .inner').scrollTop(0);

		// Randomise starting day
		day = Math.floor(Math.random() * Math.floor(7)+1); // Random number between 1 and 7

		// Hide "Start new game" button, show month selection
		$('.begin-holder').fadeOut(animationSpeed*0.5, function(){
			// If expansions exist, show the "Book of Adventures" header now
			if (expansionsExist) $('.intro h2').delay(animationSpeed*1.5).fadeIn(animationSpeed*1.5);

			if (!autoOpen) $('.date-initial').delay(animationSpeed*1.5).fadeIn(animationSpeed*1.5);
			autoOpen = false;
		});
	});

	// MONTH LIST FUNCTIONALITY
	$('.month-list li').click(function(){
		month = $(this).data('month');
		updateMonth($(this).data('month'));

		// Update the day token (day was chosen randomly earlier)
		updateDayTokenSpot(day);
		
		$('body').removeClass('new-game');

		// Hide month selection, show month selection, show scene list, show new game button
		$('.date-initial').fadeOut(animationSpeed*1.5, function(){
			$('.date-more').removeClass('hide');

			$('body').removeClass('new-game-delay');

			// Delay before showing the day token
			setTimeout(function() {
				$('.day-list-ui').addClass('neutral-position');
				playSound('day-token-slide');
			}, 850);
		});

		// Start current month music
		playMusic('currentMonth');
	});

	function updateMonth(month) {
		if (month < 3 || month > 8) {
			// It is either winter or autumn
			$('.board-side').text($('.summer-winter').data('winter'));
			$('.calendar').removeClass('summer winter').addClass('winter');
		} else {
			// It is either summer or spring
			$('.board-side').text($('.summer-winter').data('summer'));
			$('.calendar').removeClass('summer winter').addClass('summer');
		}
		var monthText = months[month];
		// if ($('.summer-winter').data('setting-capitalise-month') == 'NO') monthText = monthText.toLowerCase();
		$('.current-month').text(monthText);
	}

	// DAY LIST FUNCTIONALITY > Clicking the day buttons
	$('.day-list li').click(function(){
		if ($(this).hasClass('chosen')) return;
		day = $(this).data('day');
		playSound('day-token-slide');
		updateDayTokenSpot(day);
	});

	// DAY LIST FUNCTIONALITY > Dragging the day token
	$('.day-token').draggable({
		containment: 'parent',
		axis: 'x',
		start: function(e, ui) {
			$(this).addClass('dragged');
			playSound('day-token-grab');
		},
		stop: function(e, ui) {
			$(this).removeClass('dragged');
			playSound('day-token-release');
			var width = dayTokenStep(),
				left = ui.helper.position().left+width/2,
				top = ui.helper.position().top,
				newLeft = left - (left%width);
				
			day = Math.round(newLeft/width) + 1;

			updateDayTokenSpot(day);
		}
	});

	function updateDayTokenSpot(day) {
		$('.day-token').css({
			left: (day - 1) * dayTokenStep()
		});
		$('.day-list li').removeClass('chosen').addClass('not-chosen');
		$('.day-list li.day-'+day).removeClass('not-chosen').addClass('chosen');
	}

	function dayTokenStep() {
		var width =		Math.round($('.day-token').css('width').replace('px', '')),
			margin =	Math.round($('.monday').css('margin-right').replace('px', ''));
		return width + margin;
	}

	// Update day token spot when the window is resized
	$(window).resize(function () {
		waitForFinalEvent(function(){
			updateDayTokenSpot(day);
		}, 500, 'Resize window');
	});
	// Update day token spot when the tab is focused
	$(window).focus(function() {
		waitForFinalEvent(function(){
			updateDayTokenSpot(day);
		}, 500, 'Focus window');
	});


	// CHOOSE A NEW SCENE BUTTON ON MOBILE
	$('.show-scene-list').click(function(){
		// Show scene list on mobile
		$('.layout-menu').addClass('show');
	});

	// SCENE LIST
	$('.scene-list .list-scene').click(function(event){
		// Special case for the info label scene button
		if ($(this).hasClass('hidden-expansion-scenes')) {
			$infoModal = $(this).find('.open-modal');
			showInfoModal($infoModal, 'info', $('.'+$infoModal.data('modal')));
			event.stopPropagation();
			return
		}

		playSound('scene-list-select');

		// Select scene based on if expansions are active or not
		var sceneID = $(this).data('scene');
		if ($(this).hasClass('override') &&
			(	(settings['expansion1'] == 'enabled' && $(this).hasClass('override-game-1')) ||
				(settings['expansion2'] == 'enabled' && $(this).hasClass('override-game-2'))
				)) { sceneID = $(this).data('override'); }

		switchScene(sceneID, false, false, false, false, $(this).data('scene'));
		$('.layout-menu').removeClass('show');
	});

	// Scene complete > back to intro
	$('body').on('click', '.scene-complete', function() {
		switchScene('intro', false, false, true);
	});

	// Final scene complete (competitive, co-operative, etc.) > continue to saving
	$('body').on('click', '.game-end', function() {
		switchScene(saveSceneID, true, false, true);
	});

	// End of game (do not continue playing) > Thank you scene
	$('body').on('click', '.save-complete', function() {
		switchScene('thank-you', true, false, true);
	});

	// End of game (continue playing) > Back to intro
	$('body').on('click', '.play-again', function() {
		// Advance to the next music month if needed
		if (settings['trackSelection'] == 'monthly') fadeOutMusic(true);

		switchScene('intro', false, false, true, true);
	});

	// Thank you scene > Back to intro with logo
	$('body').on('click', '.game-complete', function() {
		// Fade out music
		fadeOutMusic();

		switchScene('intro', true);
	});

	// TRIVIA ANSWERS
	$('body').on('click', '.trivia-answer', function() {
		if ($(this).data('correct') == 'correct') triviaCorrect++;
		$(this).parent('.button-holder').addClass('locked');
		$(this).siblings().addClass('not-chosen');

		$triviaFlavour = $(this).closest('.trivia').find('.trivia-question-description');
		$triviaFlavour.slideDown(animationSpeed, function(){
			$speechBlock = $triviaFlavour.children('.flavour');
			scrollToShow($nextSubscene, ($speechBlock.length ? $speechBlock : false));
		});
	});

	// SCENE CONTINUES BUTTON OPENS THE NEXT SUBSCENE
	$('body').on('click', '.scene-continue', function() {
		// Don't do anything if the subscene is locked (already resolved)
		if ($(this).closest('.subscene').hasClass('locked')) return;
		
		if ($(this).parent('.button-holder').hasClass('question-buttons')) {
			$(this).siblings().addClass('not-chosen');
		} else {
			$(this).parent('.button-holder').slideUp(animationSpeed);
		}
		$scene = $('.scene.active');
		$scene.children('.subscene.active').children('.option.not-chosen').slideUp();
		// $scene.children('.subscene.active button').prop('disabled', true);
		$scene.children('.subscene.active').removeClass('active').addClass('inactive locked');

		if ($(this).hasClass('trivia-next-question')) {
			// ================================================ //
			// MARK: Trivia
			// ================================================ //
			
			if ($(this).hasClass('trivia-start')) {
				triviaCorrect = 0;
				
				// Randomise questions
				triviaQuestionNumber = 1;
				
				triviaQuestions = [];
				$('.trivia').each(function(){ triviaQuestions.push($(this).data('trivia')); });
				triviaQuestions = triviaQuestions.sort(() => .5 - Math.random()).slice(0,10);

				triviaQuestions.unshift('');	// Put an empty string to 0 so we can start from 1
			}

			if (triviaQuestionNumber < 11) {
				$speechBlock = $('<div>');

				// Next question
				$nextSubscene = $('.'+triviaQuestions[triviaQuestionNumber]);

				$speechBlock.append('<p>'+$nextSubscene.find('.trivia-question').text()+'</p>');

				// Update question number
				$nextSubscene.find('.trivia-number .number').text(triviaQuestionNumber);

				// Shuffle answers
				var answers = [];
				$questionHolder = $nextSubscene.find('.question-buttons');
				$questionHolder.find('.trivia-answer').each(function(){
					answers.push($(this));
					$(this).remove();
				});
				answers = shuffle(answers);
				for (var i = 0; i < answers.length; i++) {
					$questionHolder.append($(answers[i]));
					if (i == 3) $speechBlock.append('<p>'+$('#trivia-or').val()+'</p>');
					$speechBlock.append('<p>'+$(answers[i]).find('.answer').text()+'</p>');
				};

				// Increment question number for the next question
				triviaQuestionNumber++;

				// Speak out the question
				// console.log($speechBlock);
			} else {
				// results
				$nextSubscene = $('.'+triviaResults[triviaCorrect]);
				$nextSubscene.find('.trivia-ending .answers-correct').text(triviaCorrect);
				$speechBlock = $nextSubscene.children('.flavour');
			}
		} else {
			// Regular next subscene button
			$nextSubscene = $scene.children('.subscene-'+$(this).data('continue'));
			$speechBlock = $nextSubscene.children('.flavour');
		}

		// Add earned prestige to the total (current subscene + chosen outcome)
		var newPrestigeEarned1P = $(this).closest('.outcome, .subscene').data('p1');
		var newPrestigeEarned2P = $(this).closest('.outcome, .subscene').data('p2');

		// Adjust prestige given
		if (!$(this).hasClass("fake-end")) {
			adjustPrestige($nextSubscene, newPrestigeEarned1P, newPrestigeEarned2P);
		}

		// If this is the button that shows the quick setup for a new game, do some upkeep
		if ($(this).data('continue') == '3052') {
			// Do we need to flip the the game board?
			if (month == 2) {
				// Flip to summer
				$('.scene-holder').find('.flip-summer').show();
			} else if (month == 8) {
				// Flip to winter
				$('.scene-holder').find('.flip-winter').show();
			} else if (month > 2 && month < 8) {
				// Keep summer side
				$('.scene-holder').find('.keep-summer').show();
			} else {
				// Keep winter side
				$('.scene-holder').find('.keep-winter').show();
			}
			month++;
			if (month == 13) month = 1; // Loop back to January after December
			$('.scene-holder').find('.current-month').html(months[month]);
			updateMonth(month);

			// Randomise new the starting day
			day = Math.floor(Math.random() * Math.floor(7)+1);
			$('.scene-holder').find('.current-day').html(days[day]);
			updateDayTokenSpot(day);
		}

		// Move the next scene to be at the bottom and then show it
		$nextSubscene.appendTo($nextSubscene.closest('.scene')).addClass('active').removeClass('inactive').slideDown(animationSpeed*1.5, function(){
			scrollToShow($nextSubscene, ($speechBlock.length ? $speechBlock : false));

			openAchievements($nextSubscene, 1700);
		});

		// $nextSubscene.delay(animationSpeed).slideDown(animationSpeed*1.5).addClass('active').removeClass('inactive');
	});

	// OPTION DECISION FUNCTIONALITY
	$('body').on('click', '.option h2', function(event) {
		// Don't do anything if the subscene is locked (already resolved)
		if ($(this).closest('.subscene').hasClass('locked')) return;

		// .option
		$parent = $(this).parent();

		// Handle special cases for unavailable options with info modals in them
		var needs1expansion = $parent.hasClass('option-needs-1-expansion');
		var needs2expansions = $parent.hasClass('option-needs-2-expansions');
		var e1selected = $('body').hasClass('e1-selected');
		var e2selected = $('body').hasClass('e2-selected');
		if (
			(needs1expansion && !e1selected && !e2selected) ||
			(needs2expansions && (!e1selected || !e2selected))
		){
			// Open the info modal to explain why this doesn't work
			$infoModal = $(this).find('.open-modal');
			showInfoModal($infoModal, 'info', $('.'+$infoModal.data('modal')));
			event.stopPropagation();
			return;
		}

		
		if (!$parent.hasClass('chosen')) {
			// Show the chosen option and hide the rest if any other are open
			
			$speechBlock = false;

			if ($(this).siblings('.outcome-holder').children('.outcome-list').length == 0) {
				// If there's only a single outcome, show it immediately
				$outcomeNext = $(this).siblings('.outcome-holder').children('.outcome');
				$outcomeNext.show();
				openAchievements($outcomeNext, 1700);

				$speechBlock = $outcomeNext.children('.flavour');
			}

			// If skill check outcome had clicked already before, read it again
			if ($(this).siblings('.outcome-holder').children('.outcome').hasClass('chosen')) {
				$speechBlock = $(this).siblings('.outcome-holder').children('.outcome.chosen').children('.flavour');
			}

			$parent.addClass('chosen').removeClass('not-chosen');
			$parent.siblings('.option').addClass('not-chosen').removeClass('chosen');
			$parent.siblings('.option').children('.outcome-holder').slideUp(animationSpeed);
			$(this).siblings('.outcome-holder').slideDown(animationSpeed, function(){
				scrollToShow($parent, $speechBlock);
			});
		} else {
			// Hide the currently chosen option
			textToSpeech(false);
			$parent.removeClass('chosen');
			$parent.siblings('.option').removeClass('not-chosen');
			$(this).siblings('.outcome-holder').slideUp(animationSpeed);
		}
	});
	$('body').on('touchstart mousedown', '.option h2', function(e) {
		// e.preventDefault();	// Stop mouse events if using touch events
		if (!$(this).closest('.subscene').hasClass('locked')) $(this).parent().addClass('active');
	});
	$('body').on('touchend mouseup', function(e){
		// e.preventDefault();	// Stop mouse events if using touch events
		$('.option').removeClass('active');
	});

	// OUTCOME BUTTONS REVEAL FUNCTIONALITY
	$('body').on('click', '.outcome-list-reveal', function() {
		$outcomeRevealHolder = $(this).parent('.outcome-list-reveal-holder');
		$outcomeRevealHolder.fadeOut(animationSpeed, function(){
			$outcomeRevealHolder.siblings('.outcome-list').fadeIn();
			$outcomeRevealHolder.siblings('.option-rules').slideDown(animationSpeed, function (){
				scrollToShow($(this).closest('.option'));
			});
		});
	});

	// OUTCOME DECISION FUNCTIONALITY
	$('body').on('click', '.outcome-list li', function() {
		// Don't do anything if the subscene is locked (already resolved)
		if ($(this).closest('.subscene').hasClass('locked')) return;

		$parent = $(this).parent();
		if (!$(this).hasClass('chosen')) {
			// Show the chosen outcome and hide the rest if any other are open
			$(this).addClass('chosen').removeClass('not-chosen');
			$(this).siblings('li').addClass('not-chosen').removeClass('chosen');
			$parent.siblings('.outcome').slideUp(animationSpeed).removeClass('chosen');

			$nextOutcome = $parent.siblings('.outcome-'+$(this).data('outcome'));
			$nextOutcome.addClass('chosen').slideDown(animationSpeed, function(){
				$nextOption = $(this).closest('.option');
				$speechBlock = $nextOutcome.children('.flavour');
				scrollToShow($nextOption, $speechBlock);
				openAchievements($(this), 1700);
			});
		} else {
			// Hide the currently chosen outcome
			$(this).removeClass('chosen');
			$(this).siblings('li').removeClass('not-chosen');
			$parent.siblings('.outcome-'+$(this).data('outcome')).slideUp(animationSpeed).removeClass('chosen');
		}
	});

	var waitForFinalEvent = (function () {
		var timers = {};
		return function (callback, ms, uniqueId) {
			if (!uniqueId) {
				uniqueId = "Don't call this twice without a uniqueId";
			}
			if (timers[uniqueId]) {
				clearTimeout (timers[uniqueId]);
			}
			timers[uniqueId] = setTimeout(callback, ms);
		};
	})();

	// ================================================ //
	// MARK: Open new scene functions
	// ================================================ //

	function adjustPrestige($subscene, prestigeGain1p, prestigeGain2p) {
		prestigeEarned1p += prestigeGain1p;
		prestigeEarned2p += prestigeGain2p;

		// Update subscene and outcome rules
		updatePrestigeRules($subscene, prestigeEarned1p, prestigeEarned2p);
		$subscene.find('.outcome').each(function(){
			updatePrestigeRules($(this), prestigeEarned1p, prestigeEarned2p);
		});
	}

	function updatePrestigeRules($block, prestigeEarned1p, prestigeEarned2p) {
		// Do nothing if this is not an end of scene
		if (!$block.hasClass('end-of-scene') && !$block.hasClass('fake-end')) return;

		var prestigeNew1p = prestigeEarned1p + $block.data('p1');
		var prestigeNew2p = prestigeEarned2p + $block.data('p2');

		// Update prestige values
		$block.find('.rules-prestige-1p .prestige-1p').html(prestigeNew1p);
		$block.find('.rules-prestige-2p .prestige-2p').html(prestigeNew2p);

		var prestigeAmount1p = (prestigeNew1p < 2 ? 'single' : 'multiple');
		var prestigeAmount2p = (prestigeNew2p < 2 ? 'single' : 'multiple');

		// Update rules visibility
		if (prestigeNew1p > 0) $block.find('.rules-1p, .rules-prestige-1p').removeClass('single multiple').addClass('prestige-earned '+prestigeAmount1p);
		if (prestigeNew2p > 0) $block.find('.rules-2p, .rules-prestige-2p').removeClass('single multiple').addClass('prestige-earned '+prestigeAmount2p);
	}

	function scrollToShow($targetElement, $speechBlock = false) {
		var scrollTo = 0;

		// Determine current scroll position
		var scrollPosTop = $('.layout-content').scrollTop();
		var scrollPosBottom = scrollPosTop + $(window).height();

		var elemTop = $($targetElement).offset().top;
		var elemBottom = elemTop + $($targetElement).height();

		if (elemTop < 0) {
			scrollTo = $targetElement.position().top;
		}

		if (elemBottom > $(window).height()) {
			// The element's bottom is not visible
			if ($($targetElement).height() > $(window).height()) {
				// If the element is taller than the window, scoll to its top
				scrollTo = $targetElement.position().top;
			} else {
				// If the element is shorter than the windows, scroll until the whole element is visible
				var hiddenHeight = elemBottom - $(window).height();
				scrollTo = scrollPosTop + hiddenHeight + 35;
			}
		}

		if (scrollTo != 0) {
			var scrollSpeed = 1100 * scrollSpeedMultipliers[settings['scrollSpeed']];
			var scrollCap = 400;
			var currentPos = $('.layout-content').scrollTop();
			var scrollAmount = Math.abs(currentPos-scrollTo);
			if (scrollAmount < scrollCap) scrollSpeed = scrollAmount/(scrollCap+50)*scrollSpeed+50;
			$('.layout-content').animate({ scrollTop: scrollTo }, scrollSpeed, function(){
				// Text to speech
				if ($speechBlock) textToSpeech($speechBlock);
			});
		} else {
			// Text to speech
			if ($speechBlock) textToSpeech($speechBlock);
		}
	}

	function switchScene(newSceneId, gameEnd = false, forceGameEnd = false, sendData = false, newGame = false, sceneListId = false) {
		// Send play data
		// fan: never send
		if (false) {
			var playedBlocks = $('.scene.active').attr('id');
			$('.subscene:visible, .option:visible, .outcome:visible').not('.not-chosen').each(function(){
				playedBlocks += ','+$(this).attr('class').split(' ')[1];
			});

			let data = new FormData();
			data.append('sessionID',	sessionID);
			data.append('blocks',		playedBlocks);
			data.append('lang',			language.toLowerCase());
			navigator.sendBeacon('send-play-data.php', data);
		}

		if (newGame) generateSessionID();

		prestigeEarned1p = 0;
		prestigeEarned2p = 0;

		$previousScene = $('.scene-holder .scene.active');

		$('.scene-holder').append(stories[newSceneId]);
		$nextScene = $('.scene-holder #scene-'+newSceneId).last();

		// Don't do anything if the user is at intro and tries to click it again
		if ($previousScene.hasClass('intro') && $nextScene.hasClass('intro') && !forceGameEnd) return;

		// Handle the scene id list
		$('.scene-list li').removeClass('active');
		if (sceneListId != false) {
			// If we have buttons that open multiple scenes based on expensions, we need to specify the list item
			$('#list-scene-'+sceneListId).addClass('active');
		} else {
			$('#list-scene-'+newSceneId).addClass('active');
		}

		var transitionSpeed = animationSpeed;

		// Adjust animation speed in mobile in certain cases
		if (
			$('.layout-menu').hasClass('show')	// If the scene list is visible
			&& !$nextScene.hasClass('intro')	// AND next scene is not intro
			&& $(window).width() <= mobileWidth	// AND we're in mobile view
			) transitionSpeed = 0;

		// Fade the current scene out and show the new one
		$previousScene.removeClass('active').fadeOut(transitionSpeed, function() {
			// Hide any possible errors and empty the scene input
			if (!$nextScene.hasClass('intro')) {
				$('.input-scene-number-error').hide();
				$('#input-scene-number').val('');
			}

			if (!$previousScene.hasClass('permanent')) $previousScene.remove();

			// Scroll to top
			$('.layout-content').animate({ scrollTop: 0 }, 0);

			// PREPARE NEW SCENE!

			// Add glimmer to all special options
			$nextScene.find('.option-special').each(function(){
				optionSpecialGlimmer($(this));
			})

			prepareScene($nextScene);

			if (month < 3 || month > 8) {
				// It is either winter or autumn
				$nextScene.find('span.summer').addClass('hidden');
			} else {
				// It is either winter or autumn
				$nextScene.find('span.winter').addClass('hidden');
			}

			$nextScene.addClass('active').fadeIn(transitionSpeed, function() {

				// Text to speech
				$speechBlock = $nextScene.find('.subscene.primary.active .flavour').first();
				textToSpeech($speechBlock);

				// Open achievements if needed
				$nextScene.children('.subscene.primary.active').each(function(){
					openAchievements($(this), 1700);
				});

				// Show incomplete scene message if needed
				$incompleteNotification = $('#scene-incomplete');
				if ($nextScene.hasClass('incomplete')) {
					setTimeout(function() { $incompleteNotification.addClass('show'); }, 200);
					setTimeout(function() { $incompleteNotification.removeClass('show'); }, 3500);
				}

				if (settings['settingsShown'] == 'false' && $nextScene.hasClass('intro')) {
					// If we open intro AND have NOT already shown the reminder settings (or the user opened settings at least once),
					// show a reminder modal to notify the user about the existence of settings
					
					setSetting('settingsShown', 'true');
					showInfoModal($('#intro-settings-holder'), 'reminder', $('.reminder-settings'));

					// TODO: disable clicking for a half a second?
				}
			});
		});

		// Show / hide the scene list if needed
		if (gameEnd) {
			// Hide it
			hideSceneList(true, (newSceneId == 'intro' ? true : false));
		} else if (newSceneId == 'intro') {
			// Show it
			$('body').removeClass('title-screen new-game new-game-delay');
		}
	}

	function hideSceneList(skipAnimation = false, beginNewGame = false) {
		aSpeed = (skipAnimation ? 0 : animationSpeed);
		if (skipAnimation) $('body').addClass('skip-animation');

		$('body').addClass('title-screen new-game new-game-delay');

		// If asked, also handle the intro resets for a new game
		if (beginNewGame) {
			if (expansionsExist) $('.intro h2').fadeOut(aSpeed);

			// If month selection is shown, hide it too
			$('.date-initial').fadeOut(aSpeed);

			// Hide day selection, show "Start new game" button
			$('.date-more').addClass('hide');
		
			setTimeout(function() {
				$('.begin-holder').delay(aSpeed*1).fadeIn(aSpeed*0.5);
			}, aSpeed*1.5);
		}
		if (skipAnimation) setTimeout(function() { $('body').removeClass('skip-animation'); }, 300);
	}

	function prepareScene($scene) {
		// Don't reset the intro scene with months and days selected
		if (!$scene.hasClass('intro')) {
			$scene.find('.subscene.secondary').hide();
			$scene.find('.subscene').addClass('inactive');
			$scene.find('.subscene, .option').addClass('hidden');
			$scene.find('.subscene.always, .option.always, .subscene.m-'+month+'.d-'+day+', .option.m-'+month+'.d-'+day).removeClass('hidden');
			$scene.find('.subscene.primary.always, .subscene.primary.m-'+month+'.d-'+day).removeClass('inactive').addClass('active');
			$scene.find('.flavour .timed').addClass('hidden');
			$scene.find('.flavour .timed.m-'+month).removeClass('hidden');
			$scene.find('.rules .timed').addClass('hidden');
			$scene.find('.rules .timed.m-'+month).removeClass('hidden');

			// Adjust prestige given
			// $activeSubscene = $scene.find('.subscene.active');
			// var newPrestigeEarned1P = $activeSubscene.data('p1');
			// var newPrestigeEarned2P = $activeSubscene.data('p2');
			// adjustPrestige($activeSubscene, newPrestigeEarned1P, newPrestigeEarned2P);
			adjustPrestige($scene.find('.subscene.active'), 0, 0);
		}
	}

	function generateSessionID() {
		sessionID = new Array(20).join().replace(/(.|$)/g, function(){return ((Math.random()*36)|0).toString(36);});
	}
});

function getSetting(setting) {
	return localStorage.getItem(setting) ? localStorage.getItem(setting) : settings[setting];
}

$.fn.getRealDimensions = function (outer) {
	var $this = $(this);
	if ($this.length == 0) return false;
	var $clone = $this.clone()
		.show()
		.css('visibility','hidden')
		.appendTo('body');
	var result = {
		width:		(outer) ? $clone.outerWidth() : $clone.innerWidth(), 
		height:		(outer) ? $clone.outerHeight() : $clone.innerHeight(), 
		offsetTop:	$clone.offset().top, 
		offsetLeft:	$clone.offset().left
	};
	$clone.remove();
	return result;
}

function getUrlParams(k){
	var p={};
	location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi,function(s,k,v){p[k]=v});
	return k?p[k]:p;
}

// Restricts input for the set of matched elements to the given inputFilter function.
(function($) {
	$.fn.inputFilter = function(inputFilter) {
		return this.on("input keydown keyup mousedown mouseup select contextmenu drop", function() {
			if (inputFilter(this.value)) {
				this.oldValue = this.value;
				this.oldSelectionStart = this.selectionStart;
				this.oldSelectionEnd = this.selectionEnd;
			} else if (this.hasOwnProperty("oldValue")) {
				this.value = this.oldValue;
				this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
			} else {
				this.value = "";
			}
		});
	};
}(jQuery));

function shuffle(array) {
	let currentIndex = array.length,  randomIndex;

	// While there remain elements to shuffle.
	while (currentIndex != 0) {

	// Pick a remaining element.
	randomIndex = Math.floor(Math.random() * currentIndex);
	currentIndex--;

	// And swap it with the current element.
	[array[currentIndex], array[randomIndex]] = [
		array[randomIndex], array[currentIndex]];
	}

	return array;
}

// Disable / Enable scrolling when adjusting volume sliders
function lockScroll(e) {
	e.preventDefault();
}
"use strict";

$('#error').hide();
$('#step4-outro').hide();
var socket;

//pour l'instant le senderID est directement dans l'URL
var senderID = window.location.pathname.replace('/', '');
if (window.location.hostname == "127.0.0.1") {
	socket = io({
		query: 'userID=undefReceiver&senderID=' + senderID + '&role=receiver'
	});
} else {
	socket = io({
		query: 'userID=undefReceiver&senderID=' + senderID + '&role=receiver',
		path: "/_ws/socket.io/"
	});
}

socket.on('alert', function (errorMsg) {
	$('#error').html("Error: " + errorMsg);
});

socket.on('connection_ready', function (senderName) {
	console.log('connection ready');
});

ss(socket).on('forward_file', function (stream, data) {
	console.log('forward file');
});

socket.on('stream_ready', function (url, filename, filesize) {
	$('.filename').html(filename + " (" + Math.round(filesize / 1024 / 1024) + " Mo)");
	//window.open(url, '_blank');
	//meilleur car par d'erreur popup, mais fail sous chrome (les updates ne sont par re!us) 
	//window.location.href = url;
	window.location.assign(url)
		//non testé, au cas ou : setTimeout(function(){document.location.href = "page.html;"},500);
		/** autre popup :         var popup = window.open(url);
-         popup.blur();
-         window.focus();   */
});

socket.on('transfert_in_progress', function (progress) {
	//console.log('progress file ' + progress);
	//update progress bar
	$("#transfertpb").attr('aria-valuenow', progress);
	$("#transfertpb").width(progress + '%');
	$('#transfertpb').html(progress + '%');

	if (progress == 100) {
		$('#step4-outro').show(500);
		$('#transfertdiv').hide(500);
		$("#warning-window").hide(500);
	}

});
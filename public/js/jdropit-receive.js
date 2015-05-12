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
	$('.filename').html(filename + " (" + filesize / 1000 + " ko)");
	window.location.href = url;
});

socket.on('transfert_in_progress', function (progress) {
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
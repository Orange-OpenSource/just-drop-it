$("#clipboardcopyok").hide();
$('#step3').hide();
$('#step2').hide();
$('#step4-outro').hide();
$('#warning-window').hide();
$('#error').hide();

//____ Handling of copy to clipboard with zeroclipboard
var clip = new ZeroClipboard(document.getElementById("copy-button"));
clip.on("ready", function (readyEvent) {
	clip.on("copy", function (event) {
		var clipboard = event.clipboardData;
		clipboard.setData("text/plain", receiverUrl);
	});
	clip.on("aftercopy", function (event) {
		$("#clipboardcopyok").show(300);
	});
});


//----- Handling drag and drop zone style
$('#drop-zone').on('dragover', function (e) {
	this.className = 'upload-drop-zone drop';
	return false;
});

$('#drop-zone').on('dragleave', function (e) {
	this.className = 'upload-drop-zone';
	return false;
});



var socket;
var receiverUrl;
//init du socket vers le serveur
if (window.location.hostname == "127.0.0.1") {
	socket = io({
		query: 'userID=undefined&role=sender'
	});
} else {
	socket = io({
		query: 'userID=undefined&role=sender',
		path: "/_ws/socket.io/"
	});
}

socket.on('receive_url_ready', function (url) {
	receiverUrl = window.location.host + url;
	$('#generatedurl').html("<p>" + receiverUrl + "<p>");

});

socket.on('receiver_ready', function (receiverName) {
	$('#step2').hide(500);
	startUpload(fileToTransfert);
});

socket.on('alert', function (errorMsg) {
	$('#error').html("Error: " + errorMsg);
});


var fileToTransfert;

//soumission du fichier via formulaire
$('#file').change(function (e) {
	fileToTransfert = e.target.files[0];
	fileIsReady();
	//startUpload(e.target.files);
});

//soumission du fichier via drag and drop
$('#drop-zone').on('drop', function (e) {
	if (e.originalEvent.dataTransfer) {
		if (e.originalEvent.dataTransfer.files.length) {
			e.preventDefault();
			e.stopPropagation();
			/*UPLOAD FILES HERE*/
			this.className = 'upload-drop-zone';
			fileToTransfert = e.originalEvent.dataTransfer.files[0];
			fileIsReady();
		}
	}
});

var fileIsReady = function () {
	$('.filename').html(fileToTransfert.name + " (" + Math.round(fileToTransfert.size / 1024 / 1024) + " Mo)");
	$('#step2').show(500);
	$('#step3').show(500);
	$('#warning-window').show(500);
	$('#step1').hide(500);
}

//fonction d'upload du fichier
var startUpload = function (file) {
	console.log(file);

	$('#transfertMessage').html("Transfert in progress...");
	var stream = ss.createStream();

	// upload a file to the server.
	ss(socket).emit('send_file', stream, {
		size: file.size,
		name: file.name
	});

	var blobStream = ss.createBlobReadStream(file);
	var size = 0;

	blobStream.on('data', function (chunk) {
		size += chunk.length;
		//console.log(Math.floor(size / file.size * 100) + '%');
		var progress = Math.floor(size / file.size * 100);

		socket.emit('transfert_in_progress', progress);

		//update progress bar
		$("#transfertpb").attr('aria-valuenow', progress);
		$("#transfertpb").width(progress + '%');
		$('#transfertpb').html(progress + '%');

		if (progress == 100) {
			$('#step4-outro').show(500);
			$('#warning-window').hide(500);
		}
	});

	blobStream.pipe(stream);
}
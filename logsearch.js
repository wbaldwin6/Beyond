var fs = require('fs');

const monthenum = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const errorReport = '<body style="background-color:black;color:white;"><b>An error occurred trying to search the logs. Please try again later.</b><br />';

function escapeRegExp(str) { //Borrowed directly from Stack Overflow, just replaces every special character in a string with the escaped equivalent for use as a regex
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

//stringToFind contains the regex to search for in the file filename
//read contains the directory to search
function searchLogsByFilename(stringToFind, filename, read) {
	if(!filename.endsWith('.html')) { //Not a log file
		return '';
	} else {
		var data = fs.readFileSync("."+read+filename, 'utf8');
		data = data.substr(data.search(/<\w*body[^>]*>/is)); //Trim to the body tag
		data = data.substr(data.search('>') + 1); //Remove the body tag
		if(data.search(stringToFind) !== -1) {
			return filename; //Filename serves as "True" result
		} else {
			return ''; //Empty string serves as "Not Found" value
		}
	}
}
 
//This function takes a string and an HTTP Response object
//Search all the log files, then send the list of good results back to the response
function searchLogs(stringToFind, room) {
	/*Decode and escape characters in string to allow for search of special characters.
	  Additional tags around ensure search is confined to body, without searching inside tags
	  Conversion to RegExp for case-insensitive search*/
	stringToFind = new RegExp("\\b" + escapeRegExp(decodeURIComponent(stringToFind)) + "\\b", 'is');
    var read = "/logs/";
    var intread = "/interactivelogs/";
    if(room){read += room+"/"; intread += room+"/";}
    fs.readdir("."+read, function(err, files) {
        if(err) {
            process.send(errorReport + err + '</body>'); //An error has occured, so tell the user.
            process.exit();
        }
        if(files.length){
            process.send('<body style="background-color:black;color:white;">');
            var success = false;
            for(var i = files.length-1; i >= 0; i--){
                var result = searchLogsByFilename(stringToFind, files[i], read);
                if(result){
                    success = true;
                    process.send('<b><a href="'+read+result+'" style="color:blue;">' + result.replace(/([0-9]+)_([0-9]+)_([0-9]+).html/, function(match, p1, p2, p3, offset, string) {
                        return monthenum[parseInt(p2)-1] + ' ' + p3 + ', ' + p1; //Convert "YYYY_MM_DD.html" into "Monthname DD, YYYY"
                    }) + '</b> <span style="color:white;">(<a href="'+intread+result+'" style="color:blue;">Interactive</a>)</span><br />');
                }
            }
			process.send('<b>End of Search Results</b><br />');
            if(!success){
                process.send('<b>No results found!</b>');
            }
            process.send('</body>');
            process.exit();
        }
    });
}

process.on('message', function(m){
    var mess = JSON.parse(m);
    searchLogs(mess.stf, mess.room);
});
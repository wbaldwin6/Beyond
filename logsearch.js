var fs = require('fs');

var DomParser = require('dom-parser'); //Used in log searching
var parser = new DomParser(); //Also used in log searching

var monthenum = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

//This function returns a "Promise", which will "resolve" when it is done
//When the promise resolves, the searchLogs function will know to send its information to the client
function searchLogsByFilename(stringToFind, filename, read) {
    if(!filename.endsWith('.html')) { //Not a log file
        return '';
    } else {
        var data = fs.readFileSync("."+read+filename, 'utf8');
        if(data){
            var logfile = parser.parseFromString(data); //Convert the file into a DOM object
            var bodyOfFile = logfile.getElementsByTagName("body")[0]; //Grab the body of the DOM
            if(bodyOfFile.textContent.search(stringToFind) !== -1) { //If the string to find is in the body's textContent
                return filename; //We say we found it
            } else {
                return ''; //The empty string works as a "Not Found" value
            }            
        }
    }
}
 
//This function takes a string and an HTTP Response object
//Search all the log files, then send the list of good results back to the response
function searchLogs(stringToFind, room) {
    var errorReport = '<body style="background-color:black;color:white;"><b>An error occurred trying to search the logs. Please try again later.</b><br />';
    var read = "/logs/";
    if(room){read += room+"/";}
    fs.readdir("."+read, function(err, files) {
        if(err) {
            process.send(errorReport + err + '</body>'); //An error has occured, so tell the user.
            process.exit();
        }
        if(files.length){
            process.send('<body style="background-color:black;color:white;">');
            var success = false;
            for(var i = 0; i < files.length; i++){
                var result = searchLogsByFilename(stringToFind, files[i], read);
                if(result){
                    success = true;
                    process.send('<b><a href="'+read+result+'" style="color:blue;">' + result.replace(/([0-9]+)_([0-9]+)_([0-9]+).html/, function(match, p1, p2, p3, offset, string) {
                        return monthenum[parseInt(p2)-1] + ' ' + p3 + ', ' + p1; //Convert "YYYY_MM_DD.html" into "Monthname DD, YYYY"
                    }) + '</b><br />');
                }
            }
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
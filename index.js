var fs = require('fs');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var jsdom = require('jsdom');

try{//make sure the logins file exists BEFORE proceeding.
	fs.accessSync('logins.json', fs.R_OK | fs.W_OK);
	console.log("Logins file found.");
} catch(e) {
	console.log("No Logins file found; creating.");
	fs.writeFileSync('logins.json', JSON.stringify({}));
}

try{//make the logs folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/logs');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;}
}

try{//make the saves folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/saves');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;}
}

var sessions = {};

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.use('/faceicons', express.static(__dirname+'/faceicons'));
app.use('/logs', express.static(__dirname+'/logs'));

openLog = function (logfile){//takes in a Date object
	try{
		fs.accessSync(logfile, fs.R_OK | fs.W_OK);
		jsdom.env(fs.readFileSync(logfile, 'utf8'), function(err, wind){
			if(!err){
				htm = wind;
			}
		});
	} catch(e){//today's logs don't exist, make them!
		//this won't change, so just making it a static string (albeit a long one) is more effiicient.
		var initialhtml = '<html><head><title>Logs for '+new Date().toLocaleString('en-us', {month: "long", day:"2-digit"})+
		'</title><style>body {background-color: black;margin: 0 0 0 0;overflow-y: auto;color:white} .timestamp {float: left; color:#d3d3d3}</style></head><body></body></html>';
		fs.writeFileSync(logfile, initialhtml);
		jsdom.env(initialhtml, function(err, wind){
			if(!err){
				htm = wind;
			}
		});
	}
};
//initial opening when the server is activated
var today = new Date();
var logfile = __dirname+'/logs/'+today.getFullYear()+"_"+today.getMonth()+"_"+today.getDate()+'.html';
var htm = null;
openLog(logfile);

var userdefaults = {
	settings: {
		textcolor: 'blue'
	},
	
	characters: []
};

toLog = function (message){
	var today = new Date();
	if(__dirname+'/logs/'+today.getFullYear()+"_"+today.getMonth()+"_"+today.getDate()+'.html' != logfile){//new day
		logfile = __dirname+'/logs/'+today.getFullYear()+"_"+today.getMonth()+"_"+today.getDate()+'.html';
		openLog(logfile);
		//NOW proceed using htm
		//I'll need to make this into a callback to make it work later, but it only comes up at midnight.
	}//Definitely needs a fix, but low priority.
	var logmsg = htm.document.createElement('div');
	logmsg.setAttribute("class", message.className);
	//the time stamp is added in all cases.
	var ts=htm.document.createElement('div');
	ts.setAttribute("class", "timestamp");
	ts.textContent = '['+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
	logmsg.appendChild(ts);
	var classparam = message.className.split(" ")[1];
	if(classparam == 'message'){
		generateOOCmessage(logmsg, message.username, message.post, message.color);
	} else if(classparam == 'log'){
		generateOOClog(logmsg, message.username, message.post);
	}
	//add different message types later as you set them up.
	htm.document.body.appendChild(logmsg);
	fs.writeFile(logfile, htm.document.documentElement.outerHTML, function(error){
		if(error) throw error;
	});
};

generateOOCmessage = function (message, username, post, color){
	var cur = htm.document.createTextNode("( ");//open parentheses
	message.appendChild(cur);

	cur = htm.document.createElement('b');//create username
	cur.textContent = username+': ';
	message.appendChild(cur);

	cur = htm.document.createElement('font');//create post
	cur.setAttribute("color", color);
	cur.textContent = post;
	message.appendChild(cur);

	cur = htm.document.createTextNode(" )");//close parentheses
	message.appendChild(cur);
};

generateOOClog = function (message, username, post){
	var cur = htm.document.createTextNode("| "+username+" "+post+" |");
	message.appendChild(cur);
};

io.on('connection', function(socket){
	console.log('a user connected');
	socket.on('disconnect', function(){
		console.log(sessions[socket.id]+' disconnected');
		//handle other logoff things if there was a login
		if(sessions[socket.id]){
			var msg = {className: 'OOC log message', username: sessions[socket.id], post: "has logged off"}
			io.emit('OOCmessage', msg);
			toLog(msg);
			sessions[socket.id] = undefined;
		}
	})
	socket.on('login', function(username, password, callback){
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){callback(err);} else {
				logins = JSON.parse(logins);
				if(logins[username]){//valid username
					if(logins[username] == password){//valid login	
						sessions[socket.id] = username;
						//pull up user info
						fs.readFile(__dirname+'/saves/'+username+'.json', 'utf8', function (err, info){
							if(err){callback(err);} else {
								callback(JSON.parse(info));
								console.log(socket.id+" has logged in as "+username);
								var msg = {className: 'OOC log message', username: username, post: "has logged on"};
								io.emit('OOCmessage', msg);
								toLog(msg);
							}
						});
					} else {//invalid login
						callback("Password does not match the given username.");
					}
				} else {//invalid username
					callback(username+" is not in our list yet.");
				}
			}
		});
	});
	socket.on('register', function(username, password, callback){
		fs.readFile('logins.json', 'utf8', function(err, logins){
			logins = JSON.parse(logins);
			if(logins[username]){//username in use
				callback("Username already in use.");
			} else {//new username
				logins[username] = password;
				//something about linking the sessionid too probably
				fs.writeFile('logins.json', JSON.stringify(logins), function(err){
					if(!err){
						sessions[socket.id] = username;
						//create new user info
						fs.writeFile(__dirname+'/saves/'+username+'.json', JSON.stringify(userdefaults), function(err){
							if(err){callback(err);} else {
								callback(userdefaults);
								console.log(socket.id+" has logged in as "+username);
								var msg = {className: 'OOC log message', username: username, post: "has logged on"};
								io.emit('OOCmessage', msg);
								toLog(msg);
							}
						});
					} else {callback(err);}
				});
			}
		});
	});
	socket.on('OOCmessage', function(message, color){
		var username = sessions[socket.id];
		if(username){
			//placeholder test function, will be added to the options menu later.
			if(message.startsWith("/setcolor ")){
				fs.readFile(__dirname+'/saves/'+username+'.json', 'utf8', function(err, save){
					if(!err){
						save = JSON.parse(save);
						save.settings.textcolor = message.split(" ")[1];
						fs.writeFile(__dirname+'/saves/'+username+'.json', JSON.stringify(save), function(err){});
					}
				});
			} else {
				var msg = {className: 'OOC message', username: username, post: message, color: color};
				io.emit('OOCmessage', msg);
				toLog(msg);
			}
		}
	});
});
/*TODO: Add console commands to give admin, ban, etc*/
if(process.argv[2]){
	http.listen(process.argv[2], function(){
	  console.log('listening on *:'+process.argv[2]);
	});
} else {
	http.listen(0, function(){
	  console.log('listening on *:'+http.address().port);
	});
}

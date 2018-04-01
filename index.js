var fs = require('fs');
var express = require('express');
var app = express();
var httputil = require('http');
var http = httputil.Server(app);
var io = require('socket.io')(http);
var jsdom = require('jsdom');
var sanitizeHtml = require('sanitize-html');
var database = require('./database');
var cp = require('child_process');

//Set up the search request for the logs
app.get('/logs/search/:search', function(req, res) {
	var stringToFind = req.params.search;
	var child = cp.fork(__dirname+'/logsearch.js');
	child.send(JSON.stringify({stf: stringToFind}));

	child.on('message', function(m){
		res.write(m);
	});

	child.on('exit', function(){
		res.end();
	});
});

app.get('/logs/:name/search/:search', function(req, res){
	var stringToFind = req.params.search;
	var room = req.params.name;
	var child = cp.fork(__dirname+'/logsearch.js');
	child.send(JSON.stringify({stf: stringToFind, room: room}));

	child.on('message', function(m){
		res.write(m);
	});

	child.on('exit', function(){
		res.end();
	});
});

//Make sure the database exists
database.LoadDatabase(); //TODO: Move this somewhere more appropriate?

try{//make sure the logins file exists BEFORE proceeding.
	fs.accessSync('logins.json', fs.R_OK | fs.W_OK);
} catch(e) {
	fs.writeFileSync('logins.json', JSON.stringify({}));
}
var banlist;
try{//make sure the banlist file exists BEFORE proceeding.
	banlist = JSON.parse(fs.readFileSync('bans.json', 'utf8'));
} catch(e) {
	banlist = {ips: [], users: {}};
	fs.writeFileSync('bans.json', JSON.stringify(banlist));
}

var serversettings;
try{
	serversettings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
	if(serversettings.pub){setImmediate(function() {SendToHub();});}
} catch(e) {
	var profile = '<style>body{background-color:black}</style><font style="font-size:16px;font-family:calibri;color:white;"><img src=""><br><b>Name:</b> <i>Your character\'s name.</i><br><br><b>Age:</b> <i>In years, typically.</i><br><br><b>Gender:</b> <i>____</i><br><br><b>Species:</b> <i> </i><br><br><b>Height:</b> <i> </i><br><br><b>History:</b> <i>Any other relevant information can be have fields added.</i>';
	serversettings = {motd: '', rules: 'Rule 0: Be respectful.', profile: profile, title: 'Beyond'};
	fs.writeFileSync('settings.json', JSON.stringify(serversettings));
}

var adminlogs;
try{
	adminlogs = fs.readFileSync('adminlogs.txt', 'utf8');
} catch(e) {
	adminlogs = '';
	fs.writeFileSync('adminlogs.txt', '');
}

try{
	fs.accessSync('worldinfo.html', fs.R_OK | fs.W_OK);
} catch(e) {
	var worldinfo = '<style>body{background-color:black;color:white} h1{text-align:center}</style><body><h1>Welcome to Beyond!</h1></body>';
	fs.writeFileSync('worldinfo.html', worldinfo);
}

var postnum = 1;
if(!fs.existsSync('./logs')){fs.mkdirSync('./logs');}
if(!fs.existsSync('./logs/postid.txt')){fs.writeFile('./logs/postid.txt', 1);} else {fs.readFile('./logs/postid.txt','utf8',function(err,num){postnum=+num;});}

var iconnum = 0;
if(!fs.existsSync('./faceicons')){fs.mkdirSync('./faceicons');}

if(!fs.existsSync('./faceicons/num.txt')){fs.writeFile('./faceicons/num.txt', 0);} else {fs.readFile('./faceicons/num.txt','utf8',function(err,num){iconnum=+num;});}
if(!fs.existsSync('./faceicons/img_trans.gif')){fs.writeFile('./faceicons/img_trans.gif', 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');}
if(!fs.existsSync('./faceicons/img_trans.png')){fs.writeFile('./faceicons/img_trans.png', 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');}
if(!fs.existsSync('./faceicons/favicon.png')){fs.writeFile('./faceicons/favicon.png', 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gQBDzgSNR5bAgAAAA9QTFRF////AAAAz7E34sE8/9VD2dvC6gAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAAmklEQVQoz22S0Q2FMAhFGcHWCQQXMHYBk+4/0ytQoCXvfp5Q5NwIJQKS+nKQUybonCC19Z0MoBuEHAw+XSbkWQATascCoOLbvw1Q6/sED0C9HZw8MB76UhkY4LKPyMAAOA+jrqejhUqyvSDZGgjbYsBtZx+LbYFku/UhFzwJ/O/jzn2ELWofYUuzD7NF68PjfZh+6oOayuXf4QciHi6tIdMmKQAAAABJRU5ErkJggg==', 'base64');}
if(!fs.existsSync('./faceicons/notice.png')){fs.writeFile('./faceicons/notice.png', 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+IEARACC2OmyfYAAAAPUExURf///wAAAM83O+I8QP9DTK3GnwYAAAABdFJOUwBA5thmAAAAAWJLR0QAiAUdSAAAAJpJREFUKM9tktENhTAIRRnB1gkEFzB2AZPuP9MrUKAl736eUOTcCCUCkvpykFMm6JwgtfWdDKAbhBwMPl0m5FkAE2rHAqDi278NUOv7BA9AvR2cPDAe+lIZGOCyj8jAADgPo66no4VKsr0g2RoI22LAbWcfi22BZLv1IRc8Cfzv4859hC1qH2FLsw+zRevD432YfuqDmsrl3+EHIh4urSHTJikAAAAASUVORK5CYII=', 'base64');}
if(!fs.existsSync('./faceicons/box.png')){fs.writeFile('./faceicons/box.png', 'iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAADXUAAA11AFeZeUIAAABA0lEQVRoge2asYoCMRRFz4i4EUR2FiwUG9n//5SttdVWS1enmy2SgThMkWIhF7kHwp3p7uGle2nuhJ43YJ7yF3iMjjIBWOY5iDyAG3BNeatSr5xP4CvLNhe5AhfgnFKZLbBL2TAxkTNwBE5V6pVzADqgJ16tdixyAU4rup86/cq4E56kSRCvVjerW+n/sIgaFlHDImpYRA2LqGERNSyihkXUsIgaFlHDImpYRA2LqGERNSyihkXUsIgaFlHDImoMe/ZAfA6xBQ5pj63MN7AHNsAaWAwiS+LifUd8UdBUqVfOnleRMDWRPv0rs8nO5ESa7FuZ9ei8TKTNsqtSr5wFseuQH3+zPCfjk5ftQQAAAABJRU5ErkJggg==', 'base64');}
if(!fs.existsSync('./faceicons/handle.png')){fs.writeFile('./faceicons/handle.png', 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAADXUAAA11AFeZeUIAAAAB3RJTUUH4QIUDyUsZQAKFgAAAMpJREFUOMvt1DtrAlEQxfE/+/28IgbiVNaCsIZAHoVv10JFSUifLgckWMwntBlhsVlfjeDpLgw/zp1i4JFHKuNS5lLn8M5uYO6An5uALu2AGjC4GnRpC9SBQTIrrgJd+geawCiZFS59XwwG1ghs6tIG6F4ExjePsRxYng0G1gTmgS0DWyWz97NAl/5KO+sH9hrYW3k2O3Fnz8Akmq0DWxywaF8NRrMGMEtm48B6wFcy+4iZX+CpEnRpAbQCG7qUl7CXEtYGPu/nWOwBIGxhMKJusmIAAAAASUVORK5CYII=', 'base64');}

try{//make the saves folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync('./saves');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;}
}

try{
	fs.mkdirSync('./characters');
	fs.writeFile('./characters/charindex.json', JSON.stringify({}));
} catch(e){
	if(e.code != 'EEXIST'){throw e;}
}

var users = {};//maps username to their sockets and the rooms the sockets are in.
var playerlist = {};//a map of rooms and the users therein, mainly for display purposes.
var playercheck = {};//used for quickly checking permissions and mutedness and who is logged in, such as when sending to the hub.
var idlist = {};

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.get('/rooms/:roomname', function(req, res){
	var name = req.params.roomname;
	if(!name || name == '0'){
		res.send('Invalid room name.');
	} else {
		res.sendFile(__dirname + '/index.html');
	}
});

app.get('/worldinfo', function(req, res){
	res.sendFile('worldinfo.html', {root: '.'});
});

app.get('/idle.js', function(req, res){
	res.sendFile(__dirname + '/idle.js');
});

app.get('/database', function(req, res){
	res.sendFile(__dirname + '/database.html');
});

app.get('/database/*', function(req, res){
	var name = req.originalUrl;
	var page = database.GetEntryContent(name);
	if(page){
		res.send(page);
	} else {
		res.send('Page not found.');
	}
});

app.get('/logs/:name', function(req, res){
	var name = req.params.name;
	if(name.endsWith('.html')){
		res.sendFile(name, {root: './logs/'});
	} else {
		fs.readdir('./logs/'+name, function(err, files){
			if(!err){
				var ret = '<head><title>Logs ('+(serversettings.title || 'Beyond')+')</title><link rel="icon" href="/faceicons/favicon.png"></head><script type="text/javascript">var togglevis = function(id){var e = document.getElementById(id); e.style.display = e.style.display=="none" ? "block" : "none";};</script><body style="background-color:black;">';
				var months = {};
				files.forEach(function(file, index){
					if(file.endsWith('.html')){//make a separate header for each month, THEN worry about collapsibility
						var month = file.substring(0, 7);
						if(!months[month]){
							months[month] = true;
							ret += '</div>';
							var monthname = monthenum[month.split('_')[1]-1]+' '+month.split('_')[0];
							ret += '<h2 style="color: white; cursor: pointer; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;" onclick="togglevis(\''+month+'\')">'+monthname+'</h2>';
							//Make a div starting here and ending when we hit the next month or the end
							ret += '<div id='+month+' style="display: none;">';
						}
						ret += '<a href="/logs/'+name+'/'+file+'" style="color:blue;">'+file.split('.')[0]+'</a><br><br>';
					}
				});
				//Code for sending Search requests and receiving the results go here.
				ret += '</div><script>var searchLogs = function() {var searchTerm = document.getElementById(\'txtSearch\').value; window.open(\'/logs/'+name+'/search/\' + searchTerm);};</script>';
				ret += '<form onsubmit=\'searchLogs()\'><span style="color:white;">Search Logs:</span><input type=\'text\' id=\'txtSearch\'></form><br /><button type=\'button\' onclick=\'searchLogs()\'>Search</button>';
				ret += '</body>';
				res.send(ret);
			} else {
				res.send(err);
			}
		});
	}
});

app.get('/logs/:name/:logfile', function(req, res){
	var room = req.params.name;
	var name = req.params.logfile;
	if(name.endsWith('.html')){
		res.sendFile(name, {root: './logs/'+room+'/'});
	}
});

app.get('/characters/:user/:name', function(req, res){
	var name = req.params.name;
	if(name.endsWith('.html')){
		try{//make sure the logins file exists BEFORE proceeding.
			fs.accessSync('./characters/'+req.params.user+'/'+name, fs.R_OK | fs.W_OK);
			res.sendFile(name, {root: './characters/'+req.params.user});
		} catch(e) {
			res.send("<style>body{background-color: black; color: white;}</style><body>Profile not found!</body>")
		}
	}
});

app.get('/characters', function(req, res){
	fs.readdir('./characters', function(err, files){
		if(!err){
			fs.readFile('./characters/charindex.json', 'utf8', function(err, charindex){
				if(!err){
					charindex = JSON.parse(charindex);
					var ret = '<head><title>Character Database ('+(serversettings.title || 'Beyond')+')</title><link rel="icon" href="/faceicons/favicon.png"></head><script type="text/javascript">var togglevis = function(id){var e = document.getElementById(id); e.style.display = e.style.display=="none" ? "block" : "none";};</script><body style="background-color:black;">';
					files = files.sort(function (a, b){return a.toLowerCase().localeCompare(b.toLowerCase());});
					files.forEach(function(file, index){
						if(!file.endsWith('.json')){
							var f = fs.readdirSync('./characters/'+file);
							if(f.length !== 0){
								ret += '<h2 style="color: white; cursor: pointer; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;" onclick="togglevis(\''+file.replace(/'/g, "\\'")+'\')">'+file+' ('+f.length+')</h2>';
								ret += '<div id="'+file+'" style="display: none;">';
								f.forEach(function(chr){
									var id=file+'-'+chr.slice(0, -5);
									var name = charindex[id].name;
									ret += '<a href="/characters/'+encodeURIComponent(file)+'/'+chr+'" style="color:blue;">'+
									'<img src="/faceicons/img_trans.gif" height="50px" width="50px" style="background-image:url(/faceicons/'+charindex[id].icon+'.png);">'+name+'</a><br><br>';
								});
								ret += '</div>';
							}
						}
					});
					ret += '</body>';
					res.send(ret);
				} else res.send(err);
			});
		} else res.send(err);
	});
});

var monthenum = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

app.get('/logs', function(req, res){
	fs.readdir('./logs', function(err, files){
		if(!err){
			var ret = '<head><title>Logs ('+(serversettings.title || 'Beyond')+')</title><link rel="icon" href="/faceicons/favicon.png"></head><script type="text/javascript">var togglevis = function(id){var e = document.getElementById(id); e.style.display = e.style.display=="none" ? "block" : "none";};</script><body style="background-color:black;">';
			var months = {};
			files.forEach(function(file, index){
				if(file.endsWith('.html')){//make a separate header for each month, THEN worry about collapsibility
					var month = file.substring(0, 7);
					if(!months[month]){
						months[month] = true;
						ret += '</div>';
						var monthname = monthenum[month.split('_')[1]-1]+' '+month.split('_')[0];
						ret += '<h2 style="color: white; cursor: pointer; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;" onclick="togglevis(\''+month+'\')">'+monthname+'</h2>';
						//Make a div starting here and ending when we hit the next month or the end
						ret += '<div id='+month+' style="display: none;">';
					}
					ret += '<a href="/logs/'+file+'" style="color:blue;">'+file.split('.')[0]+'</a><br><br>';
				}
			});
			//Code for sending Search requests and receiving the results go here.
			ret += '</div><script>var searchLogs = function() {var searchTerm = document.getElementById(\'txtSearch\').value; window.open(\'/logs/search/\' + searchTerm);};</script>';
			ret += '<form onsubmit=\'searchLogs()\'><span style="color:white;">Search Logs:</span><input type=\'text\' id=\'txtSearch\'></form><br /><button type=\'button\' onclick=\'searchLogs()\'>Search</button>';
			ret += '</body>';
			res.send(ret);
		} else {
			res.send(err);
		}
	});
});

app.use('/faceicons', express.static('./faceicons'));

var openLog = function (logfile, room){
	try{
		fs.accessSync(logfile, fs.R_OK | fs.W_OK);
		logfiles[room] = {lname: logfile, htm: jsdom.jsdom(fs.readFileSync(logfile, 'utf8'))};
	} catch(e){//today's logs don't exist, make them!
		//this won't change, so just making it a static string (albeit a long one) is more effiicient.
		var style = '<style>body{background-color: black; margin: 0 0 0 0; color: white;} div{display: block; float: left; height: auto; width: 100%;} div.action, div.log, div.narration{font-weight: bold;} div.narration{text-align: center;} div.narration span.timestamp{position: absolute; left: 0;} span.timestamp {font-weight: normal; font-family: monospace; color:#d3d3d3} .IC{} .OOC{} .deleted{}</style>';
		var toggleedit = 'function toggleedit(id){var e=document.getElementById(id); var edit=e.nextElementSibling; if(e.style.display=="none"){e.style.display=null; edit.style.display="none";} else {edit.style.display=null; e.style.display="none";}}';
		var tog = 'function tog(i,o){var x=document.getElementsByTagName("style")[0].sheet.cssRules; x[6].style.display=i?"initial":"none"; x[7].style.display=o?"initial":"none";}';
		var toggledis = 'function te(e,y){if(e.innerHTML.startsWith("Hide")){e.innerHTML=e.innerHTML.replace("Hide","Show");}else{e.innerHTML=e.innerHTML.replace("Show","Hide");} var x=document.getElementsByTagName("style")[0].sheet.cssRules; x[y].style.display=x[y].style.display==="none"?"initial":"none";}';
		var script = '<script>'+toggleedit+' '+tog+' '+toggledis+'</script>';
		var body = '<body><div class="buttons" style="width: auto; position:fixed; bottom: 0; right: 0;"><button onclick="te(this,5)">Hide Timestamps</button><button onclick="te(this,8)">Hide Deletes</button><button onclick="tog(0,1)">OOC Only</button><button onclick="tog(1,0)">IC Only</button><button onclick="tog(1,1)">Both</button></div>'+script+'</body>';
		var initialhtml = '<html><head><title>Logs for '+new Date().toLocaleString('en-us', {month: "long", day:"2-digit"})+
		'</title>'+style+'<link rel="icon" href="/faceicons/favicon.png"></head>'+body+'</html>';
		if(room != '0'){
			try{//attempt to make the room directory.
				fs.mkdirSync('./logs/'+room);
			} catch(e){//do nothing if it already exists.
				if(e.code != 'EEXIST'){throw e;}
			}
		}
		fs.writeFileSync(logfile, initialhtml);
		logfiles[room] = {lname: logfile, htm: jsdom.jsdom(initialhtml)};
	}
};
//initial opening when the server is activated
var logday = function(today, room){
	if(room != '0'){
		return './logs/'+room+'/'+today.getFullYear()+"_"+("0"+(today.getMonth()+1)).slice(-2)+"_"+("0"+today.getDate()).slice(-2)+'.html';
	}
	return './logs/'+today.getFullYear()+"_"+("0"+(today.getMonth()+1)).slice(-2)+"_"+("0"+today.getDate()).slice(-2)+'.html';
};
var today = new Date();
var logfile = logday(today, '0');
var logfiles = {};
openLog(logfile, '0');

var userdefaults = {
	settings: {
		textcolor: 'white',
		characterIDs: 0,
		dice: [],
		rooms: {},
		room: ''
	},
	characters: [
		[]//where ungrouped characters go, this should always exist.
	]
};

var toLog = function (message, room){
	var today = new Date();
	//only use logfiles[room].htm after this check
	if(!logfiles[room] || logday(today, room) != logfiles[room].lname){//file unopened or from yesterday
		openLog(logday(today, room), room);
	}
	var htm = logfiles[room].htm;//the file has been opened or created by this point.
	var logmsg = htm.createElement('div');
	logmsg.className = message.className;
	if(message.id){//no need to do a complicated 'is this an IC post' check if I can do this.
		logmsg.id = message.id;
	}
	//the time stamp is added in all cases.
	var ts=htm.createElement('span');
	ts.setAttribute("class", "timestamp");
	ts.textContent = '['+message.username+' '+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
	logmsg.appendChild(ts);
	var classparam = message.className.split(" ")[1];
	switch(classparam){
		case 'message':
			generateOOCmessage(logmsg, message.username, message.post, message.color, room);
			break;
		case 'log':
			generateOOClog(logmsg, message.username, message.post, room);
			break;
		case 'say':
			generatePost(logmsg, message.username, message.post, message.character, true, message.className.startsWith('O'), message.unnamed, room);
			break;
		case 'action':
			generatePost(logmsg, message.username, message.post, message.character, false, message.className.startsWith('O'), message.unnamed, room);
			break;
		case 'narration':
			generateNarration(logmsg, message.username, message.post, message.color, room);
	}
	htm.body.appendChild(logmsg);
	var br = htm.createElement('br');
	br.className = message.className.split(" ")[0];
	htm.body.appendChild(br);
	fs.writeFile(logfiles[room].lname, htm.documentElement.outerHTML, function(error){
		if(error){console.log(error);}
	});
};

var editLog = function(message, room){
	var today = new Date();
	if(!logfiles[room]){return;}//safety abort.
	var htm = logfiles[room].htm;
	var target = htm.getElementById(message.id);
	if(target && target.children[0].textContent.indexOf('[Deleted at') == -1){
		var logmsg;
		if(message.character){//different character requires new post.
			logmsg = htm.createElement('div');
			logmsg.className = message.className;//if there's a character it'll always have this.
			logmsg.id = message.id;
			//the time stamp is added in all cases.
			var ts=htm.createElement('span');
			ts.setAttribute("class", "timestamp");
			ts.textContent = '['+message.username+' '+'Edited at '+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
			logmsg.appendChild(ts);
			var classparam = logmsg.className.split(" ")[1];
			generatePost(logmsg, message.username, message.post, message.character, (classparam == 'say'), false, message.unnamed, room);
		} else {//quick edit
			if(target.nextElementSibling.id && target.nextElementSibling.id == target.id){//probably the best way to check for edits.
				logmsg = target.nextElementSibling.cloneNode(true);
			} else {
				logmsg = target.cloneNode(true);
			}
			if(message.className && message.className != logmsg.className){//we can ignore class besides this and the post thing
				if(message.className == 'IC say message'){//was previously action
					logmsg.children[2].style.fontWeight = 'bold';
					logmsg.children[2].innerHTML = logmsg.children[2].innerHTML.slice(0, -1) + ': ';
				} else {//was previously say
					logmsg.children[2].style.fontWeight = null;
					logmsg.children[2].innerHTML = logmsg.children[2].innerHTML.slice(0, -2) + ' ';
				}
				logmsg.className = message.className;
			}
			if(typeof message.unnamed === "boolean"){//keep as-is if it's undeclared.
				logmsg.children[2].style.display = message.unnamed ? 'none' : 'initial';
			}
			logmsg.children[0].textContent = '['+message.username+' '+'Edited at '+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
			if(logmsg.className.split(' ')[1] == 'say'){
				logmsg.children[logmsg.children.length-1].innerHTML = '"'+message.post+'"';
			} else {
				logmsg.children[logmsg.children.length-1].innerHTML = message.post;
			}
		}
		var e = target.nextElementSibling;
		logmsg.setAttribute("onclick", "toggleedit("+message.id+")");
		logmsg.style.cursor = "pointer";
		if(e.id && e.id == target.id){//this is the edit and should be replaced.
			htm.body.replaceChild(logmsg, e);
		} else {//no preexisting edits
			target.setAttribute("onclick", "toggleedit("+message.id+")");
			target.style.cursor = "pointer";//only requires a change when it hasn't already had it set.
			target.style.display = "none";
			htm.body.insertBefore(logmsg, e);
		}
		fs.writeFile(logfiles[room].lname, htm.documentElement.outerHTML, function(error){
			if(error){console.log(error);}
		});
	}
};

var addid = function(id, username){
	idlist[id] = username;
	if(id > 100 && idlist[id-100]){
		delete idlist[id-100];
	}
};

var deleteLog = function(id, room){
	var today = new Date();
	if(!logfiles[room]){return;}//safety abort.
	var htm = logfiles[room].htm;
	var target = htm.getElementById(id);
	if(target && target.children[0].textContent.indexOf('[Deleted at') == -1){
		target.className += ' deleted';
		target.children[0].textContent += '[Deleted at '+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
		if(target.nextElementSibling.id && target.nextElementSibling.id == target.id){//has an edit!
			target.nextElementSibling.children[0].textContent += '[Deleted at '+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
		}
		fs.writeFile(logfiles[room].lname, htm.documentElement.outerHTML, function(error){
			if(error){console.log(error);}
		});
	}
};

var generateOOCmessage = function (message, username, post, color, room){
	var htm = logfiles[room].htm;
	message.appendChild(htm.createTextNode("( "));//open parentheses

	cur = htm.createElement('b');//create username
	cur.textContent = username+': ';
	message.appendChild(cur);

	cur = htm.createElement('span');//create post
	cur.style.color = color;
	cur.innerHTML = post;
	message.appendChild(cur);

	message.appendChild(htm.createTextNode(" )"));//close parentheses
};

var generateOOClog = function (message, username, post, room){
	var htm = logfiles[room].htm;
	var cur = htm.createTextNode("| "+username+" "+post+" |");
	message.appendChild(cur);
};

var generateNarration = function (message, username, post, color, room){
	var htm = logfiles[room].htm;
	var cur = htm.createElement('br');
	message.appendChild(cur);
	cur = htm.createElement('span');
	cur.style.color = color;
	cur.innerHTML = post;
	message.appendChild(cur);
}

var generatePost = function (message, username, post, character, say, omit, unnamed, room){
	var htm = logfiles[room].htm;
	message.style.fontFamily = character.fontStyle;
	//image section
	var cur = htm.createElement('img');
	cur.src = '/faceicons/img_trans.gif';
	cur.height=50; cur.width=50;
	cur.style.backgroundImage = 'url(/faceicons/'+character.icon+'.png)';
	cur.style.backgroundPosition = '-'+character.icpos.left+'px -'+character.icpos.top+'px';
	message.appendChild(cur);

	//add the space after the image
	message.appendChild(htm.createTextNode(" "));
	//name section
	cur = htm.createElement('span');
	cur.style.color = character.nameColor;
	if(!character.customHTML){
		if(say){
			cur.style.fontWeight = 'bold';
			cur.textContent = character.name+': ';
		} else {
			cur.textContent = character.name+' ';
		}
	} else {
		if(say){
			cur.style.fontWeight = 'bold';
			cur.innerHTML = character.customHTML+': ';
		} else {
			cur.innerHTML = character.customHTML+' ';
		}
	}
	cur.style.display = unnamed ? 'none' : 'initial';
	message.appendChild(cur);
	//post section
	cur = htm.createElement('span');
	cur.style.color = character.color;
	if(say){
		cur.innerHTML = '"'+post+'"';
	} else {
		cur.innerHTML = post;
	}
	if(omit){
		var om = htm.createElement('b');
		om.textContent = ' (Omit)';
		cur.appendChild(om);
	}
	message.appendChild(cur);
};

var processHTML = function(message){
	var test = /<|>/.test(message);
	message = message.replace(/(\s|^)(https?:\/\/\S+)/ig, "$1<a href=\"$2\" target=\"_blank\">$2</a>");
	message = message.replace(/\r\n?|\n(?!([^<]+)?>)/g, "<br />");
	if(test){//we skip it if we don't even find any tags (prior to potentially adding them ourselves)
		message = sanitizeHtml(message, {allowedTags: ['a', 'b', 'br', 'em', 'font', 'i', 's', 'span', 'strong', 'sup', 'sub', 'u'],
		allowedAttributes: {
			'a': ['href', 'target'],
			'span': ['style'],
			'font': ['color', 'style']
		}});
		message = message.replace(/<(.*?)>/g, function(match, p1, offset, string) {
			return "<" + p1.replace(/style\s*=\s*"(.*?)"/g, function(match, p1, offset, string) {
				return 'style="' + p1.replace(/(^|;)((?!(text-decoration|text-shadow|font-.*|outline-.*|color))[-A-Za-z])*:.+?\b/g, "") + '"'
			}) + ">";
		});
	}
	return message;
};

var addPlayer = function(username, socket, permissions, muted, socketroom){
	if(!users[username]){users[username]={}; playercheck[username] = {permissions: permissions, muted: muted};}
	users[username][socketroom] = socket;
	if(!playerlist[socketroom]){playerlist[socketroom]={};}
	playerlist[socketroom][username] = {permissions: permissions};
};

var removePlayer = function(username, socketroom){
	delete users[username][socketroom];
	//check if the user has any other rooms open, if not, clear it out.
	if (Object.getOwnPropertyNames(users[username]).length == 0){
		delete users[username];
		delete playercheck[username];
	}
	delete playerlist[socketroom][username];
};
process.stdin.setEncoding('utf8');
process.stdin.on('readable', function() {//support for console commands.
	var res = process.stdin.read();
	if(res){
		res = (res.replace(/\r\n?|\n/,'')).split(' ');
		var command = res.shift();
		if(commands[command]){
			commands[command](res.join(' '));//SHOULD call the function at the given index. Hopefully.
		} else if(['Admin', 'Player', 'Guest'].indexOf(command) > -1) {
			commands['Set'](res.join(' '), command);
		} else {
			console.log('Command '+command+' is not recognized.');
		}
	}
});

var disconnectall = function(usersockets){//takes in users[name] and disconnects all sockets, returning IP address. Pretty much for boot/ban purposes.
	var retval = false;
	for (var socket in usersockets){
		// skip loop if the property is from prototype
		if (!usersockets.hasOwnProperty(socket)) continue;
		if (!retval){retval = usersockets[socket].request.connection.remoteAddress;}
		usersockets[socket].disconnect();
	}
	return retval;
};

var commands = {//console command list, formatted this way for convenience.
	"Announce": function(message){
		message = processHTML(message);
		var msg = {className: 'OOC system message', post: '<font color="red" style="font-size:larger"><b>SERVER ANNOUNCEMENT: </b>'+message+'</font>'};
		io.emit('OOCmessage', msg);
	},
	"Remove": function(names){//deletes user logins and saves outright.
		var all = names.split(';');
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err)} else {
				var out = "Deleted files for ";
				logins = JSON.parse(logins);
				all.forEach(function(name, index){
					if(logins[name]){
						if(users[name]){disconnectall(users[name]);}
						delete logins[name];
						out += name+' ';
						fs.unlink('./saves/'+name+'.json', function(err){
							if(err){console.log(err);}
						});
						fs.unlink('./characters/'+name, function(err){
							if(err){console.log(err);}
						});
					}//'shouldn't' need to catch if they have a login.
				});
				fs.writeFile('logins.json', JSON.stringify(logins), function(err){
					if(err){console.log(err);} else {console.log(out);}
				});
			}
		});
	},
	"Mute": function(name){//just set their tag to true
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err);} else {
				logins = JSON.parse(logins);
				if(logins[name]){
					logins[name].muted = true;
					if(playercheck[name]){
						playercheck[name].muted = true;
					}
					fs.writeFile('logins.json', JSON.stringify(logins), function(err){
						if(err){console.log(err);} else {console.log(name+' has been muted.');}
					});
				}
			}
		});
	},
	"Unmute": function(name){//just set their tag to true
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err);} else {
				logins = JSON.parse(logins);
				if(logins[name]){
					logins[name].muted = false;
					if(playercheck[name]){
						playercheck[name].muted = false;
					}
					fs.writeFile('logins.json', JSON.stringify(logins), function(err){
						if(err){console.log(err);} else {console.log(name+' has been unmuted.');}
					});
				}
			}
		});
	},
	"Ban": function(name){//prevents subsequent logins.
		fs.readFile('bans.json', 'utf8', function(err, bans){
			if(err){console.log(err);} else {
				bans = JSON.parse(bans);
				if(users[name]){
					var ip = disconnectall(users[name]);
					if(ip){
						bans.ips.push(ip); banlist.ips.push(ip);
						bans.users[name] = ip; banlist.users[name] = ip;
					}
				} else if(name.startsWith(':')){
					bans.ips.push(name); banlist.ips.push(name);
				} else {
					bans.users[name] = true; banlist.users[name] = true;
				}
				fs.writeFile('bans.json', JSON.stringify(bans), function(err){
					if(err){console.log(err);} else {console.log(name+' has been banned.');}
				});
			}
		});
	},
	"Unban": function(name){
		if(!banlist.users[name] && (banlist.ips.indexOf(name) < 0)){
			console.log(name + ' not found on banlist.');
		} else {
			fs.readFile('bans.json', 'utf8', function(err, bans){
				if(err){console.log(err);} else {
					bans = JSON.parse(bans);
					if(name.startsWith(':')){
						bans.ips.splice(bans.ips.indexOf(name), 1);
						banlist.ips.splice(banlist.ips.indexOf(name), 1);
					} else {
						var ip = bans.users[name];
						delete bans.users[name];
						delete banlist.users[name];
						if(typeof ip === 'string' && bans.ips.indexOf(ip) > -1){
							bans.ips.splice(bans.ips.indexOf(ip), 1);
							banlist.ips.splice(banlist.ips.indexOf(ip), 1);
						}
					}
					fs.writeFile('bans.json', JSON.stringify(bans), function(err){
						if(err){console.log(err);} else {console.log(name+' has been unbanned.');}
					});
				}
			});
		}
	},
	"ListBans": function(){
		console.log(banlist);
	},
	"Boot": function(name){//Just logs them out.
		if(users[name]){
			disconnectall(users[name]);
		} else {
			for (var room in playerlist){
				// skip loop if the property is from prototype
				if (!playerlist.hasOwnProperty(room)) continue;
				if(playerlist[room][name]){//not in users, but on the playerlist.
					delete playerlist[room][name];
				}
			}//this is the best we can do without any socket info, but it gets them off the playerlist.
			console.log(name+' is not logged in.');
		}
	},
	"ListPlayers": function(){//Currently active players and their permissions.
		console.log(playerlist);
	},
	"ListAccounts": function(){//All registered users
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err);} else {
				logins = JSON.parse(logins);
				Object.keys(logins).forEach(function(key){
					delete logins[key].password;
				})
				console.log(logins);
			}
		});
	},
	"Set": function(name, level){//Change to Guest, Player, or Admin.
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err);} else {
				logins = JSON.parse(logins);
				if(logins[name]){
					logins[name].permissions = level;
					for (var room in playerlist){
						if (!playerlist.hasOwnProperty(room)) continue;
						if(playerlist[room][name]){//any room where the user is connected
							playerlist[room][name].permissions = level;
							io.to(room).emit('PlayerList', playerlist[room]);
						}
					}
					if(playercheck[name]){
						playercheck[name].permissions = level;
					}
					fs.writeFile('logins.json', JSON.stringify(logins), function(err){
						if(err){console.log(err);} else {
							console.log(name+' is now a(n) '+level+'.');
							if(users[name] && users[name]['0']){
								var msg = {className: 'OOC system message', post: '<font color="red">You are now a(n) '+level+'.</font>'};
								//It should be sufficient to send this to the default room most of the time.
								users[name]['0'].emit('OOCmessage', msg);
							}
						}
					});
				} else {
					console.log('Username '+name+' not found.');
				}
			}
		});
	},
	"SetPublic": function(yn){
		var res = false;
		console.log(yn);
		if(yn == 'true'){res = true;}
		if(!isNaN(yn)){res = +yn;}
		serversettings.pub = res;
		var pubset = 'private';
		if(res){pubset='public';}
		var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">The server has been set '+pubset+'.</font>'};
		fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
			if(err){console.log(err);} else {io.emit('OOCmessage', msg); setImmediate(function() {SendToHub();});}
		});
	},
	"Shutdown": function(name){//Self-explanatory.
		console.log("Shutting down now.");
		process.exit();
	},
};

var hubfailures = 0;

var SendToHub = function(){
	//acquire title and pub from serversettings, and the playerlist.
	if(hubfailures < 3 && serversettings.pub){//if we've failed to reach the hub three consecutive times or are no longer public, stop trying.
		var hubping = {title: serversettings.title, id: serversettings.pub, playerlist: playercheck, port: http.address().port};
		var data = JSON.stringify(hubping);

		var options = {
			host: '76.28.205.5',
			port: 55555,
			path: '/server',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(data)
			}
		};

		var req = httputil.request(options, function(res){
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				hubfailures = 0;
			});
		});

		req.on('error', function(e) {
			hubfailures++;
			console.log('problem with request: ' + e.message);
			console.log(hubfailures);
		});
		req.write(data);
		req.end();
		setTimeout(function() {SendToHub();}, 120000);//renew this every two minutes.
	}
};

var saveFile = function(filename, data, socket, username){
	fs.writeFile(filename, data, function(err){
		if(!err && socket){
			var msg = {className: 'OOC system message', post: '<font style="color:red;">Data for '+username+' successfully saved.</font>'};
			socket.emit('OOCmessage', msg);
		} else if(err) {
			console.log(err);
			if(err.code == "UNKNOWN"){
				setTimeout(function() {saveFile(filename, data, socket);}, 100);
			}
		}
	});
};

var adminLog = function(username, command, target){
	var today = new Date();
	adminlogs+='['+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+'] '+username+' used the '+command+' command';
	if(target){adminlogs+=' on '+target+'.\r\n';} else {adminlogs+='.\r\n';}
	fs.writeFile('adminlogs.txt', adminlogs, function(err){if(err){console.log(err);} else {}});
};

var CheckUser = function(username, minimumPermission, muteusable, socket){
	if(!username){return false;}
	if(minimumPermission == 'Admin'){
		if(playercheck[username].permissions == 'Admin'){
			return true;
		} else {
			console.log(username+' attempted to use an admin command.');
			return false;
		}
	}
	if(!muteusable && playercheck[username].muted){
		socket.emit('OOCmessage', {className: 'OOC system message', post: '<font style="color:red;">You are currently muted.</font>'});
		return false;
	}
	if(minimumPermission == 'Player'){
		return (['Player', 'Admin'].indexOf(playercheck[username].permissions) > -1);
	}
	return true;//If we're here, username is present, muteusable is true (the command can be used even when muted), and it requires no permissions.
};

var Setconnections = function(socket, user, sroom){//username will definitely be present or something is wrong enough to warrant throwing.
	var username = user;
	var socketroom = sroom;

	socket.on('OOCmessage', function(message, color){
		message = processHTML(message);
		var msg = {className: 'OOC message', username: username, post: message, color: color};
		if(msg.post && CheckUser(username, 'Guest', false, socket)){
			io.to(socketroom).emit('OOCmessage', msg);
			toLog(msg, socketroom);
		}
	});
	socket.on('Narrate', function(message, color, room, callback){//room is deprecated, but removing it causes more potential communication issues than it's worth to remove.
		if(callback){callback();}
		if(CheckUser(username, 'Player', false, socket)){
			message = processHTML(message);
			var msg = {className: 'IC narration message', username: username, post: message, color: color};
			msg.id = postnum++;
			addid(msg.id, username);
			fs.writeFile('./logs/postid.txt', postnum, function(err){if(err){console.log(err);}});
			io.to(socketroom).emit('ICmessage', msg);
			toLog(msg, socketroom);
		}
	});
	socket.on('Whisper', function(message, target){
		if(username && users[target] && users[target][socketroom]){//if they logged out midwhisper or they send an invalid one somehow we need to stop that.
			message = processHTML(message);
			socket.emit('OOCmessage', {className: 'OOC whisper', target: target, post:message});
			users[target][socketroom].emit('OOCmessage', {className: 'OOC whisper', username: username, post: message});
		}//no logging, OBVIOUSLY. What's an admin window?
	});
	socket.on('AFK', function(on){
		if(playerlist[socketroom] && playerlist[socketroom][username] && on != playerlist[socketroom][username].afk){
			playerlist[socketroom][username].afk = on;
			io.to(socketroom).emit('PlayerList', playerlist[socketroom]);
		}
	});
	socket.on('Dice', function(dice, result, color, priv){
		if(CheckUser(username, 'Player', true, socket) && result){//we automatically switch to private instead of just disallowing, so no mute check.
			var post = username+' rolled '+dice+': '+(result.toString().replace(/,/g, ', '));
			if(result.length > 1){
				var total = result.reduce(function(a,b){return a+b;});
				post +=' ('+total+')';
			}
			var msg = {className: 'OOC dice', post: post, color: color};
			if(priv || playercheck[username].muted){
				msg.post = msg.post + ' (Private)';
				socket.emit('OOCmessage', msg);
			} else {
				io.to(socketroom).emit('OOCmessage', msg);
			}
		}
	});
	socket.on('characterPost', function(message, character, type, room, callback){
		if(callback){callback();}
		if(CheckUser(username, 'Guest', false, socket) && character){//We do not check for Player status here, only if it's IC.
			if(character.customHTML){
				character.customHTML = sanitizeHtml(character.customHTML, {allowedTags: ['b', 'br', 'em', 'font', 'i', 's', 'span', 'strong', 'sup', 'u'],
					allowedAttributes: {
						'span': ['style'],
						'font': ['color', 'size', 'style']
					}});
			}//always do a serverside check!
			var className = 'message'; var call;
			if(character.textHTML){
				message = character.textHTML+message;
			}
			message = processHTML(message); //one nice thing processHTML does for us is automatically close the tags.
			var msg = {character: character, post: message, username: username};
			if(type.startsWith('Unnamed')){
				msg.unnamed = true;
				type = type.substr(type.indexOf(' ')+1); //remove the 'Unnamed' from the start, it has done its job.
			}
			if(type.endsWith('Say')){
				className = 'say ' + className;
			} else if(type.endsWith('Action')){
				className = 'action ' + className;
			}
			if(type.startsWith('O') || type.startsWith('T')){//omit say or omit action
				className = 'OOC ' + className;
				call = 'OOCmessage';
			} else if(['Player', 'Admin'].indexOf(playercheck[username].permissions) > -1) {//IC say or action
				msg.id = postnum++;
				addid(msg.id, username);
				className = 'IC ' + className;
				call = 'ICmessage';
				fs.writeFile('./logs/postid.txt', postnum, function(err){if(err){console.log(err);}});
			}
			msg.className = className;
			if(type.startsWith('Test')){
				msg.className = 'Test'+msg.className;
				msg.post += ' (Test)';
				socket.emit(call, msg);
			} else if(call) {//If it doesn't have a call(IE they didn't pass the player/admin test) drop the message
				io.to(socketroom).emit(call, msg);
				toLog(msg, socketroom);
			}
		}
	});
	socket.on('ICedit', function(message, postid){
		if(idlist[postid] != username){
			console.log(username + ' tried to edit a post by '+(idlist[postid] || ''));
			return;
		}
		if(CheckUser(username, 'Player', false, socket)){
			message = processHTML(message);
			var msg = {id: postid, post: message+'*'};
			io.emit('ICedit', msg);
			msg.username = username;
			editLog(msg, socketroom);
		}
	});
	socket.on('Cedit', function(message, character, type, postid){
		if(idlist[postid] != username){
			console.log(username + ' tried to edit a post by '+(idlist[postid] || ''));
			return;
		}
		if(CheckUser(username, 'Player', false, socket)){
			message = processHTML(message);
			className = 'message';
			if(type.endsWith('Say')){
				className = 'say ' + className;
			} else if(type.endsWith('Action')){
				className = 'action ' + className;
			}
			var msg = {id: postid, post: message+'*', character: character, className: 'IC '+className};
			if(type.startsWith('Unnamed')){
				msg.unnamed = true;
				type = type.substr(type.indexOf(' ')+1); //remove the 'Unnamed' from the start, it has done its job.
			} else {
				msg.unnamed = false; //explicitly set this to false, this is important.
			}
			io.emit('ICedit', msg);
			msg.username = username;
			editLog(msg, socketroom);
		}
	});
	socket.on('Delete Post', function(id){
		if(idlist[id] != username){
			console.log(username + ' tried to delete a post by '+(idlist[id] || ''));
			return;
		}
		if(CheckUser(username, 'Player', false, socket)){
			deleteLog(id, socketroom);
			io.emit('ICdel', id);
		}
	});
	socket.on('Update Character', function(character){
		fs.readFile('./characters/charindex.json', 'utf8', function(err, index){
			index = JSON.parse(index);
			index[character.id] = {name: character.name, icon: character.icon};
			fs.writeFileSync('./characters/charindex.json', JSON.stringify(index));
		});
	});
	socket.on('sendimage', function(icons, callback){
		if(username){
			var data = icons.replace(/^data:image\/png;base64,/, "");
			if(icons == 'data:,'){//no image
				callback(null, username);
			} else {//If this breaks something (makes icons load weird, etc), switch it back to sync.
				fs.writeFile('./faceicons/'+iconnum+'.png', data, 'base64', function(err){if(err){console.log(err);}});
				var ids = iconnum++;
				fs.writeFile('./faceicons/num.txt', iconnum, function(err){if(err){console.log(err);}});//update this
				callback(ids, username);
			}
		}
	});
	socket.on('Show Rules', function(callback){
		if(callback){
			callback(serversettings.rules);
		} else {
			var msg = {className: 'OOC system message', post: '<b><u>Rules</u>:</b><br />'+serversettings.rules+'<br /><br />'};
			socket.emit('OOCmessage', msg);
		}
	});
	socket.on('Show MOTD', function(callback){
		if(callback){
			callback(serversettings.motd);
		} else {
			var msg = {className: 'OOC system message', post: '<b><u>Message of the Day</u>:</b><br />'+serversettings.motd+'<br /><br />'};
			socket.emit('OOCmessage', msg);
		}
	});
	socket.on('Show Profile', function(id, callback){
		if(id){
			var n = id.split('-');
			var d = n.pop();
			n = n.join('-');
			fs.readFile('./characters/'+n+'/'+d+'.html', 'utf8', function(err, profile){
				if(err){
					callback(serversettings.profile);
				} else {
					callback(profile);
				}
			});
		} else {//don't bother file checking in this case.
			callback(serversettings.profile);
		}
	});
	socket.on('Show Info', function(callback){
		fs.readFile('worldinfo.html', 'utf8', function(err, info){
			if(!err){
				callback(info);
			} else {
				callback('');
			}
		});
	});
	socket.on('Show Logs', function(callback){
		fs.readFile('adminlogs.txt', 'utf8', function(err, info){
			if(!err){
				callback(info);
			} else {
				callback('');
			}
		});
	});
	socket.on('List Bans', function(callback){
		var msg = {className: 'OOC system message', post: '<font style="color:red;">'+JSON.stringify(banlist)+'<br /></font>'};
		socket.emit('OOCmessage', msg);
	});
	socket.on('Set Profile', function(profile, id){
		var n = id.split('-');
		var d = n.pop();
		n = n.join('-');
		//this is a very unique case, so we don't use CheckUser.
		if(username && (username == n || (playercheck[username].permissions == 'Admin' && fs.readdirSync('./characters').indexOf(n) > -1))){
			var dirmessage = '/characters/'+encodeURIComponent(n)+'/'+d+'.html';
			var dir = './characters/'+n+'/'+d+'.html';
			var msg = {className: 'OOC system message', post: '<font style="color:red;">Profile set. View it '+'<a href="'+dirmessage+'" target="_blank">here.</a>'+'</font>'};
			fs.writeFile(dir, profile.replace(/\r\n?|\n(?!([^<]+)?>)(?!([^<]+)?(<\/style>|<\/script>))/g, "<br />"), function(err){
				if(err){console.log(err);} else {socket.emit('OOCmessage', msg);}
			});
			if(username != n && playercheck[username].permissions == 'Admin'){
				adminLog(username, 'Set Profile', id);
			}
		}
	});
	socket.on('Delete Profile', function(id){
		var n = id.split('-');
		var d = n.pop();
		n = n.join('-');
		//if I add any more 'admin or specific user' commands I may add it to CheckUser, but currently these are the only two.
		if(username && (username == n || (playercheck[username].permissions == 'Admin' && fs.readdirSync('./characters').indexOf(n) > -1))){
			var dir = './characters/'+n+'/'+d+'.html';
			fs.unlink(dir, function(err){
				if(err && err.code != 'ENOENT'){console.log(err);} else {
					if(username != n && playercheck[username].permissions == 'Admin'){
						adminLog(username, 'Delete Profile', id);
					}
				}
			});
		}
	});
	socket.on('Edit Rules', function(message){
		if(CheckUser(username, 'Admin', true, socket)){
			serversettings.rules = processHTML(message);
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the rules.</font>'};
			fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg); adminLog(username, 'Edit Rules', null);}
			});
		}
	});
	socket.on('Edit MOTD', function(message){
		if(CheckUser(username, 'Admin', true, socket)){
			serversettings.motd = processHTML(message);
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the MOTD.</font>'};
			fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg); adminLog(username, 'Edit MOTD', null);}
			});
		}
	});
	socket.on('Edit Default Profile', function(message){
		if(CheckUser(username, 'Admin', true, socket)){
			serversettings.profile = message.replace(/\r\n?|\n(?!([^<]+)?>)(?!([^<]+)?(<\/style>|<\/script>))/g, "<br />");//no HTML checking here
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the default character profile.</font>'};
			fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg); adminLog(username, 'Edit Default Profile', null);}
			});
		}
	});
	socket.on('Edit World Info', function(message){
		if(CheckUser(username, 'Admin', true, socket)){
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the world info.</font>'};
			fs.writeFile('worldinfo.html', message.replace(/\r\n?|\n(?!([^<]+)?>)(?!([^<]+)?(<\/style>|<\/script>))/g, "<br />"), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg); adminLog(username, 'Edit World Info', null);}
			});
		}
	});
	socket.on('Edit Title', function(message){
		if(CheckUser(username, 'Admin', true, socket)){
			serversettings.title = sanitizeHtml(message, {allowedTags: [], allowedAttributes: []}); //allow no html here.
			fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
				if(err){console.log(err);} else {io.emit('Title', serversettings.title); adminLog(username, 'Edit Title', null);}
			});
		}
	});
	socket.on('AdminCommand', function(command, target){
		//before we even consider it: ARE they an admin?
		if(CheckUser(username, 'Admin', true, socket)){
			if(commands[command]){
				commands[command](target);
			} else if(command.startsWith('Make')) {
				commands['Set'](target, command.split(' ')[1]);
			}
			adminLog(username, command, target);
		}
	});
	socket.on('disconnect', function(){
		removePlayer(username, socketroom);
		var msg = {className: 'OOC log message', username: username, post: "has logged off"}
		io.to(socketroom).emit('OOCmessage', msg);
		toLog(msg, socketroom);
		io.to(socketroom).emit('PlayerList', playerlist[socketroom]);
		console.log(username + ' ('+socket.request.connection.remoteAddress+') has disconnected.');
	});
	socket.on('save', function(settings, ret){
		if(username){
			if(ret){
				saveFile('./saves/'+username+'.json', settings, socket, username);
			} else {
				saveFile('./saves/'+username+'.json', settings);
				//go through all user sockets and send an update.
				usersockets = users[username];
				for (var socket in usersockets){
					if (!usersockets.hasOwnProperty(socket)) continue;
					usersockets[socket].emit('UserDataUpdate', settings);
				}
			}
		}
	});
	socket.on('Get Character List', function(callback){
		if(CheckUser(username, 'Admin', true, socket)){
			fs.readdir('./characters', function(err, files){
				if(!err){
					fs.readFile('./characters/charindex.json', 'utf8', function(err, charindex){
						if(!err){
							var ret = [];
							charindex = JSON.parse(charindex);
							files = files.sort(function (a, b){return a.toLowerCase().localeCompare(b.toLowerCase());});
							files.forEach(function(file, index){
								if(!file.endsWith('.json')){
									var f = fs.readdirSync('./characters/'+file);
									if(f.length !== 0){//player with characters
										var player = [];
										f.forEach(function(chr){
											var id=file+'-'+chr.slice(0, -5);
											var name = charindex[id].name;//get character names
											player.push({id: id, name: name});
										});
										ret.push(player);
									}
								}
							});
							callback(ret);
						} else callback(err);
					});
				} else callback(err);
			});
		}
	});
};

io.of('/database').on('connection', function(socket) {
	database.InitializeDatabaseSocket(socket);
	if(serversettings.title){
		socket.emit('Title', serversettings.title);
	}
});

io.on('connection', function(socket){
	if(banlist.ips.indexOf(socket.request.connection.remoteAddress) > -1){//banned IP
		socket.disconnect();
		return;
	}
	if(serversettings.title){
		socket.emit('Title', serversettings.title);
	}
	socket.on('login', function(username, password, room, callback){
		if(username.endsWith(' ')){
			callback("Please do not end your username with a space.");
			return;
		}
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){callback(err);} else {
				logins = JSON.parse(logins);
				var roomname = '0';
				if(room && typeof room === 'string'){
					roomname = room;
				}
				if(logins[username]){//valid username
					if(users[username] && users[username][roomname]){//already on the list?
						callback("User already logged in!");
					} else if(logins[username].password == password){//valid login
						addPlayer(username, socket, logins[username].permissions, logins[username].muted, roomname);
						if(banlist.users[username]){//this is so mean.
							commands['Ban'](username);
							callback("You're still banned.");
						} else {
							//pull up user info
							fs.readFile('./saves/'+username+'.json', 'utf8', function (err, info){
								if(err){callback(err);} else {
									socket.join(roomname);
									setImmediate(function() {Setconnections(socket, username, roomname);});
									info = JSON.parse(info);
									callback(info);
									console.log(socket.id+" has logged in as "+username);
									var msg = {className: 'OOC log message', username: username, post: "has logged on"};
									io.to(roomname).emit('OOCmessage', msg);
									io.to(roomname).emit('PlayerList', playerlist[roomname]);
									if(!room){
										if(serversettings.rules){
											socket.emit('OOCmessage', {className: 'OOC system message', post: '<b><u>Rules</u>:</b><br />'+serversettings.rules+'<br /><br />'});
										}
										if(serversettings.motd){
											socket.emit('OOCmessage', {className: 'OOC system message', post: '<b><u>Message of the Day</u>:</b><br />'+serversettings.motd+'<br /><br />'});
										}
									}
									toLog(msg, roomname);
								}
							});
						}
					} else {//invalid login
						callback("Password does not match the given username.");
					}
				} else {//invalid username
					callback(username+" is not in our list yet.");
				}
			}
		});
	});
	console.log('a user connected');
	socket.on('register', function(username, password, du, callback){
		if(username.endsWith(' ')){
			callback("Please do not end your username with a space.");
			return;
		}
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){callback(err);} else {
				logins = JSON.parse(logins);
				var loginstest = {};
				Object.keys(logins).forEach(function(key){
					loginstest[key.toLowerCase()] = true;
				});//fill it with lowercased
				if(loginstest[username.toLowerCase()]){//username in use
					callback("Username already in use.");
				} else {//new username
					logins[username] = {password: password, permissions: 'Guest', muted: false};
					fs.writeFile('./saves/'+username+'.json', JSON.stringify(userdefaults), function(err){
						if(!err){
							fs.writeFile('logins.json', JSON.stringify(logins), function(err){
								if(!err){
									fs.mkdir('./characters/'+username, function(err){
										if(!err || err.code == 'EEXIST'){
											socket.join('0');
											setImmediate(function() {Setconnections(socket, username);});
											addPlayer(username, socket, 'Guest', false, '0'); //no registration on rooms
											//create new user info
											callback(userdefaults);
											console.log(socket.id+" has logged in as "+username);
											var msg = {className: 'OOC log message', username: username, post: "has logged on"};
											io.to('0').emit('OOCmessage', msg);
											io.to('0').emit('PlayerList', playerlist['0']);
											if(serversettings.rules){
												socket.emit('OOCmessage', {className: 'OOC system message', post: '<b><u>Rules</u>:</b><br />'+serversettings.rules+'<br /><br />'});
											}
											if(serversettings.motd){
												socket.emit('OOCmessage', {className: 'OOC system message', post: '<b><u>Message of the Day</u>:</b><br />'+serversettings.motd+'<br /><br />'});
											}
											toLog(msg, '0');
										} else {callback(err);}
									});
								} else {callback(err);}
							});
						} else {callback(err);}
					});
				}
			}
		});
	});
});

if(process.argv[2]){
	http.listen(process.argv[2], function(){
	  console.log('listening on *:'+process.argv[2]);
	});
} else {
	var prt = process.env.PORT || 0;
	http.listen(prt, function(){
	  console.log('listening on *:'+http.address().port);
	});
}

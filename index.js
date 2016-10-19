var fs = require('fs');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var jsdom = require('jsdom');
var sanitizeHtml = require('sanitize-html');
var database = require('./database');

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
} catch(e) {
	var profile = '<style>body{background-color:black}</style><font style="font-size:16px;font-family:calibri;color:white;"><img src=""><br><b>Name:</b> <i>Your character\'s name.</i><br><br><b>Age:</b> <i>In years, typically.</i><br><br><b>Gender:</b> <i>____</i><br><br><b>Species:</b> <i> </i><br><br><b>Height:</b> <i> </i><br><br><b>History:</b> <i>Any other relevant information can be have fields added.</i>';
	serversettings = {motd: '', rules: 'Rule 0: Be respectful.', profile: profile};
	fs.writeFileSync('settings.json', JSON.stringify(serversettings));
}

try{
	fs.accessSync('worldinfo.html', fs.R_OK | fs.W_OK);
} catch(e) {
	var worldinfo = '<style>body{background-color:black;color:white} h1{text-align:center}</style><body><h1>Welcome to Beyond!</h1></body>';
	fs.writeFileSync('worldinfo.html', worldinfo);
}

var postnum = 1;
try{//make the logs folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/logs');
	fs.writeFile(__dirname+'/logs/postid.txt', 1);	
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;} else {
		fs.readFile(__dirname+'/logs/postid.txt', 'utf8', function(err, num){
			postnum = +num;
		});
	}
}

var iconnum = 0;
try{//make the faceicons folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/faceicons');
	fs.writeFile(__dirname+'/faceicons/num.txt', 0);
	fs.writeFile(__dirname+'/faceicons/img_trans.gif', 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;} else {
		fs.readFile(__dirname+'/faceicons/num.txt', 'utf8', function(err, num){
			iconnum = +num;
		});
	}
}

try{//make the saves folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/saves');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;}
}

try{
	fs.mkdirSync(__dirname+'/characters');
	fs.writeFile(__dirname+'/characters/charindex.json', JSON.stringify({}));
} catch(e){
	if(e.code != 'EEXIST'){throw e;}
}

var sessions = {};//maps session.id to username
var users = {};//maps username to sockets. YES, we need both!
var playerlist = {};//Having three feels superfluous, but I think O(1) is more important than a bit of extra memory.

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.get('/worldinfo', function(req, res){
	res.sendFile(__dirname + '/worldinfo.html');
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
		res.sendFile(name, {root: __dirname+'/logs/'});
	}
});

app.get('/characters/:user/:name', function(req, res){
	var name = req.params.name;
	if(name.endsWith('.html')){
		try{//make sure the logins file exists BEFORE proceeding.
			fs.accessSync(__dirname+'/characters/'+req.params.user+'/'+name, fs.R_OK | fs.W_OK);
			res.sendFile(name, {root: __dirname+'/characters/'+req.params.user});
		} catch(e) {
			res.send("<style>body{background-color: black; color: white;}</style><body>Profile not found!</body>")
		}
	}
});

app.get('/characters', function(req, res){
	fs.readdir(__dirname+'/characters', function(err, files){
		if(!err){
			var ret = '<body style="background-color:black;">';
			files = files.sort();
			files.forEach(function(file, index){
				if(!file.endsWith('.json')){
					ret += '<a href="/characters/'+file+'" style="color:blue;">'+file+'</a><br><br>';
				}
			});
			ret += '</body>';
			res.send(ret);
		}
	});
});
app.get('/characters/:user', function(req, res){
	fs.readdir(__dirname+'/characters/'+req.params.user, function(err, files){
		if(!err){
			fs.readFile(__dirname+'/characters/charindex.json', 'utf8', function(err, charindex){
				if(!err){
					charindex = JSON.parse(charindex);
					var ret = '<body style="background-color:black;">';
					files.forEach(function(file, index){
						var id=req.params.user+'-'+file.slice(0, -5);
						var name = charindex[id].name;
						ret += '<a href="/characters/'+req.params.user+'/'+file+'" style="color:blue;">'+
						'<img src="/faceicons/img_trans.gif" height="50px" width="50px" style="background-image:url(/faceicons/'+charindex[id].icon+'.png);">'+name+'</a><br><br>';
					});
					ret += '</body>';
					res.send(ret);
				} else res.send(err);
			});
		} else res.send(err);
	});
});

app.get('/logs', function(req, res){
	fs.readdir(__dirname+'/logs', function(err, files){
		if(!err){
			var ret = '<body style="background-color:black;">';
			files.forEach(function(file, index){
				if(file.endsWith('.html')){
					ret += '<a href="/logs/'+file+'" style="color:blue;">'+file.split('.')[0]+'</a><br><br>';
				}
			});
			ret += '</body>';
			res.send(ret);
		}
	});
});

app.use('/faceicons', express.static(__dirname+'/faceicons'));

var openLog = function (logfile){//takes in a Date object
	try{
		fs.accessSync(logfile, fs.R_OK | fs.W_OK);
		htm = jsdom.jsdom(fs.readFileSync(logfile, 'utf8'));
	} catch(e){//today's logs don't exist, make them!
		//this won't change, so just making it a static string (albeit a long one) is more effiicient.
		var style = '<style>body{background-color: black; margin: 0 0 0 0; color: white;} div{display: block; float: left; height: auto; width: 100%;} div.action, div.log, div.narration{font-weight: bold;} div.narration{text-align: center;} div.narration span.timestamp{position: absolute; left: 0;} span.timestamp {font-weight: normal; font-family: monospace; color:#d3d3d3} .IC{} .OOC{}</style>';
		var script = '<script>function OOC(){var x = document.getElementsByTagName("style")[0].sheet.cssRules; x[6].style.display = "none"; x[7].style.display = "initial";} function IC(){var x = document.getElementsByTagName("style")[0].sheet.cssRules; x[7].style.display = "none"; x[6].style.display = "initial";}function Both(){var x = document.getElementsByTagName("style")[0].sheet.cssRules; x[6].style.display = "initial"; x[7].style.display = "initial";}</script>'
		var body = '<body><div class="buttons" style="width: auto; position:fixed; bottom: 0; right: 0;"><button onclick="OOC()">OOC Only</button><button onclick="IC()">IC Only</button><button onclick="Both()">Both</button></div>'+script+'</body>';
		var initialhtml = '<html><head><title>Logs for '+new Date().toLocaleString('en-us', {month: "long", day:"2-digit"})+
		'</title>'+style+'</head>'+body+'</html>';
		fs.writeFileSync(logfile, initialhtml);
		htm = jsdom.jsdom(initialhtml);
	}
};
//initial opening when the server is activated
var logday = function(today){
	return __dirname+'/logs/'+today.getFullYear()+"_"+("0"+(today.getMonth()+1)).slice(-2)+"_"+("0"+today.getDate()).slice(-2)+'.html'
};
var today = new Date();
var logfile = logday(today);
var htm = null;
openLog(logfile);

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

var toLog = function (message){
	var today = new Date();
	if(logday(today) != logfile){//new day
		logfile = logday(today);
		openLog(logfile);
		//NOW proceed using htm
	}
	var logmsg = htm.createElement('div');
	logmsg.className = message.className;
	if(message.id){//no need to do a complicated 'is this an IC post' check if I can do this.
		logmsg.id = message.id;
	}
	//the time stamp is added in all cases.
	var ts=htm.createElement('span');
	ts.setAttribute("class", "timestamp");
	ts.textContent = '['+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
	logmsg.appendChild(ts);
	var classparam = message.className.split(" ")[1];
	switch(classparam){
		case 'message':
			generateOOCmessage(logmsg, message.username, message.post, message.color);
			break;
		case 'log':
			generateOOClog(logmsg, message.username, message.post);
			break;
		case 'say':
			generatePost(logmsg, message.username, message.post, message.character, true, message.className.startsWith('O'));
			break;
		case 'action':
			generatePost(logmsg, message.username, message.post, message.character, false, message.className.startsWith('O'));
			break;
		case 'narration':
			generateNarration(logmsg, message.username, message.post, message.color);
	}
	htm.body.appendChild(logmsg);
	var br = htm.createElement('br');
	br.className = message.className.split(" ")[0];
	htm.body.appendChild(br);
	fs.writeFile(logfile, htm.documentElement.outerHTML, function(error){
		if(error) throw error;
	});
};

var editLog = function(message){
	var today = new Date();
	var target = htm.getElementById(message.id);
	if(target){//the message might be from yesterday and then you're just done.
		var type = target.className.split(" ")[1];
		var edit = target.cloneNode(true);
		//don't just do this naively.
		//make the new timestamp
		edit.children[0].textContent = '[ Edited at '+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
		if(type == 'say'){
			edit.children[edit.children.length-1].innerHTML = '"'+message.post+'"';
		} else {
			edit.children[edit.children.length-1].innerHTML = message.post;
		}
		//insert after
		htm.body.insertBefore(edit, target.nextElementSibling);
		var br = htm.createElement('br');
		br.className = 'IC';
		htm.body.insertBefore(br, target.nextElementSibling);
		fs.writeFile(logfile, htm.documentElement.outerHTML, function(error){
			if(error) throw error;
		});
	}

};

var generateOOCmessage = function (message, username, post, color){
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

var generateOOClog = function (message, username, post){
	var cur = htm.createTextNode("| "+username+" "+post+" |");
	message.appendChild(cur);
};

var generateNarration = function (message, username, post, color){
	var cur = htm.createElement('span');
	cur.style.color = color;
	cur.innerHTML = post;
	message.appendChild(cur);
}

var generatePost = function (message, username, post, character, say, omit){
	message.style.fontFamily = character.fontStyle;
	var cur = htm.createElement('img');
	cur.src = '/faceicons/img_trans.gif';
	cur.height=50; cur.width=50;
	cur.style.backgroundImage = 'url(/faceicons/'+character.icon+'.png)';
	cur.style.backgroundPosition = '-'+character.icpos.left+'px -'+character.icpos.top+'px';
	message.appendChild(cur);

	//add the space after the image
	message.appendChild(htm.createTextNode(" "));

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
	message.appendChild(cur);

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
	//message = message.replace(/</g, "&lt;");
	//message = message.replace(/>/g, "&gt;");
	var test = /<|>/.test(message);
	message = message.replace(/\r\n?|\n/g, "<br />");
	message = message.replace(/(https?:\/\/\S+)/ig, "<a href=\"$1\" target=\"_blank\">$1</a>");
	if(test){//we skip it if we don't even find any tags (prior to potentially adding them ourselves)
		message = sanitizeHtml(message, {allowedTags: ['a', 'b', 'br', 'em', 'font', 'i', 's', 'span', 'strong', 'sup', 'u'],
		allowedAttributes: {
			'a': ['href', 'target'],
			'span': ['style'],
			'font': ['color', 'style']
		}});
		message = message.replace(/(^|"|;)((?!(text-decoration|text-shadow|font-.*|outline-.*))[-A-Za-z])*:.+?\b/g, "");
	}
	return message;
};

var addPlayer = function(username, socket, permissions){
	sessions[socket.request.connection.remoteAddress] = username;
	users[username] = socket;
	playerlist[username] = {permissions: permissions};
};

var removePlayer = function(id){
	var username = sessions[id];
	delete sessions[id];
	delete users[username];
	delete playerlist[username];
};
process.stdin.setEncoding('utf8');
process.stdin.on('readable', function() {//support for console commands.
	var res = process.stdin.read();
	if(res){
		res = (res.replace('\r\n','')).split(' ');
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

var commands = {//console command list, formatted this way for convenience.
	"Remove": function(names){//deletes user logins and saves outright.
		var all = names.split(';');
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err)} else {
				var out = "Deleted files for ";
				logins = JSON.parse(logins);
				all.forEach(function(name, index){
					if(logins[name]){
						if(users[name]){users[name].disconnect();}
						delete logins[name];
						out += name+' ';
						fs.unlink(__dirname+'/saves/'+name+'.json', function(err){
							if(err){console.log(err);}
						});
						fs.unlink(__dirname+'/characters/'+name, function(err){
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
	"Ban": function(name){//prevents subsequent logins.
		fs.readFile('bans.json', 'utf8', function(err, bans){
			if(err){console.log(err);} else {
				bans = JSON.parse(bans);
				if(users[name]){
					var ip = users[name].request.connection.remoteAddress;
					bans.ips.push(ip); banlist.ips.push(ip);
					bans.users[name] = ip; banlist.users[name] = ip;
					users[name].disconnect();
				} else {
					bans.users[name] = true; banlist.users[name] = true;
				}
				writeFile('bans.json', JSON.stringify(bans), function(err){
					if(err){console.log(err);} else {console.log(name+' has been banned.');}
				});
			}
		});
	},
	"Unban": function(name){
		if(!banlist.users[name]){
			console.log(name + ' not found on banlist.');
		} else {
			fs.readFile('bans.json', 'utf8', function(err, bans){
				if(err){console.log(err);} else {
					bans = JSON.parse(bans);
					var ip = bans.users[name];
					delete bans.users[name];
					bans.ips.splice(bans.ips.indexOf(ip), 1);
					banlist.ips.splice(banlist.ips.indexOf(ip), 1);
					writeFile('bans.json', JSON.stringify(bans), function(err){
						if(err){console.log(err);} else {console.log(name+' has been unbanned.');}
					});
				}
			});
		}
	},
	"Boot": function(name){//Just logs them out.
		if(users[name]){users[name].disconnect();} else {
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
					if(playerlist[name]){
						playerlist[name].permissions = level;
						io.emit('PlayerList', playerlist);
					}
					fs.writeFile('logins.json', JSON.stringify(logins), function(err){
						if(err){console.log(err);} else {
							console.log(name+' is now a(n) '+level+'.');
							if(users[name]){
								var msg = {className: 'OOC system message', post: '<font color="red">You are now a(n) '+level+'.</font>'};
								users[name].emit('OOCmessage', msg);
							}
						}
					});
				} else {
					console.log('Username '+name+' not found.');
				}
			}
		});
	},
	"Shutdown": function(name){//Self-explanatory.
		console.log("Shutting down now.");
		process.exit();
	},
};

var Setconnections = function(socket){//username will definitely be present or something is wrong enough to warrant throwing.
	socket.on('Join Room', function(room){
		var username = sessions[socket.request.connection.remoteAddress];
		if(['Player', 'Admin'].indexOf(playerlist[username].permissions) > -1){
			socket.join(room);
		}
	});
	socket.on('Leave Room', function(room){
		var username = sessions[socket.request.connection.remoteAddress];
		if(['Player', 'Admin'].indexOf(playerlist[username].permissions) > -1){
			socket.leave(room);
		}
	});
	socket.on('OOCmessage', function(message, color){
		var username = sessions[socket.request.connection.remoteAddress];
		message = processHTML(message);
		var msg = {className: 'OOC message', username: username, post: message, color: color};
		io.emit('OOCmessage', msg);
		toLog(msg);
	});
	socket.on('Narrate', function(message, color, room){
		var username = sessions[socket.request.connection.remoteAddress];
		if(['Player', 'Admin'].indexOf(playerlist[username].permissions) > -1){
			message = processHTML(message);
			var msg = {className: 'IC narration message', username: username, post: message, color: color};
			msg.id = postnum++;
			fs.writeFile(__dirname+'/logs/postid.txt', postnum);
			if(room){
				msg.post = '<span style="color:white;">['+room+']</span> '+msg.post;
				io.to(room).emit('ICmessage', msg);
			} else {
				io.emit('ICmessage', msg);
				toLog(msg);
			}
		}
	});
	socket.on('Whisper', function(message, target){
		var username = sessions[socket.request.connection.remoteAddress];
		if(username && users[target]){//if they logged out midwhisper or they send an invalid one somehow we need to stop that.
			message = processHTML(message);
			var msg = {className: 'OOC whisper', username: username, post: message};
			users[target].emit('OOCmessage', msg);
		}//no logging, OBVIOUSLY. What's an admin window?
	});
	socket.on('Dice', function(dice, result, color){
		var username = sessions[socket.request.connection.remoteAddress];
		if(['Player', 'Admin'].indexOf(playerlist[username].permissions) > -1){
			var post = username+' rolled '+dice+': '+(result.toString().replace(/,/g, ', '));
			if(result.length > 1){
				var total = result.reduce(function(a,b){return a+b;});
				post +=' ('+total+')';
			}
			var msg = {className: 'OOC dice', post: post, color: color};
			io.emit('OOCmessage', msg);
		}
	})
	socket.on('characterPost', function(message, character, type, room){
		var username = sessions[socket.request.connection.remoteAddress];
		if(username){
			if(character.customHTML){
				character.customHTML = sanitizeHtml(character.customHTML, {allowedTags: ['b', 'br', 'em', 'font', 'i', 's', 'span', 'strong', 'sup', 'u'],
					allowedAttributes: {
						'span': ['style'],
						'font': ['color', 'size', 'style']
					}});
			}//always do a serverside check!
			var className = 'message'; var call;
			message = processHTML(message);
			var msg = {character: character, post: message};
			if(type.endsWith('Say')){
				className = 'say ' + className;
			} else if(type.endsWith('Action')){
				className = 'action ' + className;
			}
			if(type.startsWith('O') || type.startsWith('T')){//omit say or omit action
				className = 'OOC ' + className;
				call = 'OOCmessage';
			} else if(['Player', 'Admin'].indexOf(playerlist[username].permissions) > -1) {//IC say or action
				msg.id = postnum++;
				className = 'IC ' + className;
				call = 'ICmessage';
				fs.writeFile(__dirname+'/logs/postid.txt', postnum);
			}
			msg.className = className;
			if(type.startsWith('Test')){
				msg.post += ' (Test)';
				socket.emit(call, msg);
			} else if(typeof room === 'string' && call){
				if(character.customHTML){
					msg.character.customHTML = '<span style="color:white;">['+room+']</span> '+msg.character.customHTML;
				} else {msg.character.customHTML = '<span style="color:white;">['+room+']</span> '+msg.character.name;}
				io.to(room).emit(call, msg);
			} else if(call) {//If it doesn't have a call(IE they didn't pass the player/admin test) drop the message
				io.emit(call, msg);
				toLog(msg);
			}
		}
	});
	socket.on('ICedit', function(message, postid){
		var username = sessions[socket.request.connection.remoteAddress];
		if(['Player', 'Admin'].indexOf(playerlist[username].permissions) > -1){
			message = processHTML(message);
			var msg = {id: postid, post: message+' (Edited)'};
			io.emit('ICedit', msg);
			editLog(msg);
		}
	});
	socket.on('Update Character', function(character){
		fs.readFile(__dirname+'/characters/charindex.json', 'utf8', function(err, index){
			index = JSON.parse(index);
			index[character.id] = {name: character.name, icon: character.icon};
			fs.writeFile(__dirname+'/characters/charindex.json', JSON.stringify(index));
		});
	});
	socket.on('sendimage', function(icons, callback){
		var username = sessions[socket.request.connection.remoteAddress];
		if(username){
			var data = icons.replace(/^data:image\/png;base64,/, "");
			if(icons == 'data:,'){//no image
				callback(null, username);
			} else {//If this breaks something (makes icons load weird, etc), switch it back to sync.
				fs.writeFile(__dirname+'/faceicons/'+iconnum+'.png', data, 'base64');
				var ids = iconnum++;
				fs.writeFile(__dirname+'/faceicons/num.txt', iconnum);//update this
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
			fs.readFile(__dirname+'/characters/'+n+'/'+d+'.html', 'utf8', function(err, profile){
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
	socket.on('Set Profile', function(profile, id){
		var username = sessions[socket.request.connection.remoteAddress];
		var n = id.split('-');
		var d = n.pop();
		n = n.join('-');
		if(username && username == n){
			var dir = '/characters/'+n+'/'+d+'.html';
			var msg = {className: 'OOC system message', post: '<font style="color:red;">Profile set. View it '+'<a href="'+dir+'" target="_blank">here.</a>'+'</font>'};
			fs.writeFile(__dirname+dir, profile.replace(/\r\n?|\n/g, "<br />"), function(err){
				if(err){console.log(err);} else {socket.emit('OOCmessage', msg);}
			});
		}
	});
	socket.on('Delete Profile', function(id){
		var username = sessions[socket.request.connection.remoteAddress];
		var n = id.split('-');
		var d = n.pop();
		n = n.join('-');
		if(username && username == n){
			var dir = '/characters/'+n+'/'+d+'.html';
			fs.unlink(__dirname+dir, function(err){
				if(err){console.log(err);} else {
					fs.readFile(__dirname+'/characters/charindex.json', 'utf8', function(err, index){
						index = JSON.parse(index);
						delete index[id];
						fs.writeFile(__dirname+'/characters/charindex.json', JSON.stringify(index));
					});
				}
			});
		}
	});
	socket.on('Edit Rules', function(message){
		var username = sessions[socket.request.connection.remoteAddress];
		if(username && playerlist[username].permissions == 'Admin'){
			serversettings.rules = processHTML(message);
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the rules.</font>'};
			fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg);}
			});
		} else {
			console.log(username+' attempted to use an admin command.');
		}
	});
	socket.on('Edit MOTD', function(message){
		var username = sessions[socket.request.connection.remoteAddress];
		if(username && playerlist[username].permissions == 'Admin'){
			serversettings.motd = processHTML(message);
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the MOTD.</font>'};
			fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg);}
			});
		} else {
			console.log(username+' attempted to use an admin command.');
		}
	});
	socket.on('Edit Default Profile', function(message){
		var username = sessions[socket.request.connection.remoteAddress];
		if(username && playerlist[username].permissions == 'Admin'){
			serversettings.profile = message.replace(/\r\n?|\n/g, "<br />");//no HTML checking here
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the default character profile.</font>'};
			fs.writeFile('settings.json', JSON.stringify(serversettings), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg);}
			});
		} else {
			console.log(username+' attempted to use an admin command.');
		}
	});
	socket.on('Edit World Info', function(message){
		var username = sessions[socket.request.connection.remoteAddress];
		if(username && playerlist[username].permissions == 'Admin'){
			var msg = {className: 'OOC system message', post: '<font style="color:red;font-weight:bold">'+username+' has edited the world info.</font>'};
			fs.writeFile('worldinfo.html', message.replace(/\r\n?|\n/g, "<br />"), function(err){
				if(err){console.log(err);} else {io.emit('OOCmessage', msg);}
			});
		} else {
			console.log(username+' attempted to use an admin command.');
		}
	});
	socket.on('AdminCommand', function(command, target){
		//before we even consider it: ARE they an admin?
		var username = sessions[socket.request.connection.remoteAddress];
		if(username && playerlist[username].permissions == 'Admin'){
			if(commands[command]){
				commands[command](target);
			} else if(command.startsWith('Make')) {
				commands['Set'](target, command.split(' ')[1]);
			}
		} else {
			console.log(username+' attempted to use an admin command.');
		}
	});
	socket.on('disconnect', function(){
		var username = sessions[socket.request.connection.remoteAddress];
		var msg = {className: 'OOC log message', username: username, post: "has logged off"}
		io.emit('OOCmessage', msg);
		toLog(msg);
		removePlayer(socket.request.connection.remoteAddress);
		io.emit('PlayerList', playerlist);
	});
};

io.on('connection', function(socket){
	if(banlist.ips.indexOf(socket.request.connection.remoteAddress) > -1){//banned IP
		socket.disconnect();
	} else {
		if(serversettings.rules){
			var msg = {className: 'OOC system message', post: '<b><u>Rules</u>:</b><br />'+serversettings.rules+'<br /><br />'};
			socket.emit('OOCmessage', msg);
		}
		if(serversettings.motd){
			var msg = {className: 'OOC system message', post: '<b><u>Message of the Day</u>:</b><br />'+serversettings.motd+'<br /><br />'};
			socket.emit('OOCmessage', msg);
		}
	}
	console.log('a user connected');
	var username = sessions[socket.request.connection.remoteAddress]
	if(username){//logged in, probably a database access
		setImmediate(function() {database.InitializeDatabaseSocket(socket, username, playerlist[username].permissions);})
	} else {
		socket.on('login', function(username, password, callback){
			fs.readFile('logins.json', 'utf8', function(err, logins){
				if(err){callback(err);} else {
					logins = JSON.parse(logins);
					if(logins[username]){//valid username
						if(users[username]){//already on the list?
							callback("User already logged in!");
						} else if(logins[username].password == password){//valid login
							addPlayer(username, socket, logins[username].permissions);
							if(banlist.users[username]){//this is so mean.
								Commands['Ban'](username);
								callback("You're still banned.");
							} else {
								//pull up user info
								fs.readFile(__dirname+'/saves/'+username+'.json', 'utf8', function (err, info){
									if(err){callback(err);} else {
										setImmediate(function() {Setconnections(socket);});
										info = JSON.parse(info);
										callback(info);
										if(info.settings.room){
											socket.join(info.settings.room);
										}
										Object.keys(info.settings.rooms).forEach(function(room){
											if(typeof room === 'string'){
												socket.join(room);
											}
										});
										console.log(socket.id+" has logged in as "+username);
										var msg = {className: 'OOC log message', username: username, post: "has logged on"};
										io.emit('OOCmessage', msg);
										io.emit('PlayerList', playerlist);
										toLog(msg);
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
		socket.on('register', function(username, password, callback){
			fs.readFile('logins.json', 'utf8', function(err, logins){
				if(err){callback(err);} else {
					logins = JSON.parse(logins);
					if(logins[username]){//username in use
						callback("Username already in use.");
					} else {//new username
						logins[username] = {password: password, permissions: 'Guest'};
						fs.writeFile(__dirname+'/saves/'+username+'.json', JSON.stringify(userdefaults), function(err){
							if(!err){
								fs.writeFile('logins.json', JSON.stringify(logins), function(err){
									if(!err){
										fs.mkdir(__dirname+'/characters/'+username, function(err){
											if(!err || err.code == 'EEXIST'){
												setImmediate(function() {Setconnections(socket);});
												addPlayer(username, socket, 'Guest');
												//create new user info
												callback(userdefaults);
												console.log(socket.id+" has logged in as "+username);
												var msg = {className: 'OOC log message', username: username, post: "has logged on"};
												io.emit('OOCmessage', msg);
												io.emit('PlayerList', playerlist);
												toLog(msg);
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
		socket.on('save', function(settings){
			var username = sessions[socket.request.connection.remoteAddress];
			if(username){
				fs.writeFile(__dirname+'/saves/'+username+'.json', settings, function(err){
					if(!err){
					}
				});
			}
		});
	}
});

if(process.argv[2]){
	http.listen(process.argv[2], function(){
	  console.log('listening on *:'+process.argv[2]);
	});
} else {
	http.listen(0, function(){
	  console.log('listening on *:'+http.address().port);
	});
}

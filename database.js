fs = require('fs');

function Directory(name, creator, locked) {
	this.name = name;
	this.creator = creator;
	this.contents = {};
	this.locked = locked;
	this.order = [];
}

function Entry(name, creator) {
	this.name = name;
	this.creator = creator;
}

function BuildOrder(dir) {
	if(("contents" in dir) && !("order" in dir)) {
		dir.order = [];
		for(var entry_name in dir.contents) {
			dir.order.push(entry_name);
			BuildOrder(dir.contents[entry_name]);
		}
	}
}

var toplevel;
var entries;
var databaseSockets = [];

module.exports = {
AddDirectory: function(path, name, creator, locked) {
	var dir = this.GetDirectoryFromPath(path);
	if(!("contents" in dir) || name in dir.contents)
		return undefined;
	dir.contents[name] = new Directory(name, creator, locked);
	dir.order.push(name);
	return dir.contents[name];
},

AddEntry: function(path, name, creator, content) {
	var dir = this.GetDirectoryFromPath(path);
	if(!("contents" in dir) || name in dir.contents)
		return undefined;
	var pathname = this.GetPathnameFromPath(path) + "/" + encodeURIComponent(name) + ".html";
	dir.contents[name] = new Entry(name, creator);
	dir.order.push(name);
	entries[pathname] = content;
	return dir.contents[name];
},

DeleteEntry: function(path) {
	if(path.length === 0)
		return false;
	var dir = this.GetDirectoryFromPath(path.slice(0, -1));
	if(!("contents" in dir) || !(path[path.length-1] in dir.contents)) {
		return false;
	}
	var pathname = this.GetPathnameFromPath(path) + ".html";
	if(pathname in entries) {
		delete entries[pathname];
	}
	delete dir.contents[path[path.length-1]];
	dir.order.splice(dir.order.indexOf(path[path.length-1]), 1);
	return true;
},

GetDirectoryFromPath: function(path) {
	var dir = toplevel;
	for(var i = 0; i < path.length; i++) {
		if(!dir || !("contents" in dir) || !(path[i] in dir.contents)) {
			return {};
		}
		dir = dir.contents[path[i]];
	}
	return dir;
},

GetPathnameFromPath: function(path) {
	var pathname = "/database"
	for(var i = 0; i < path.length; i++) {
		pathname += "/" + encodeURIComponent(path[i]);
	}
	return pathname;
},

GetEntryContent: function(uri) {
	return entries[uri];
},

SetEntryContent: function(uri, content) {
	if(!(uri in entries)) {
		return false;
	}
	entries[uri] = content;
	return true;
},

RenameEntry: function(path, newname) {
	var dir = path.slice(0, -1);
	var dirpath = this.GetPathnameFromPath(dir);
	var oldname = path[path.length - 1];
	dir = this.GetDirectoryFromPath(dir);
	if(!("contents" in dir) || newname in dir.contents || !(oldname in dir.contents)) {
		return false;
	}
	var oldpath = dirpath + "/" + encodeURIComponent(oldname) + ".html";
	if(oldpath in entries) {
		var newpath = dirpath + "/" + encodeURIComponent(newname) + ".html";
		entries[newpath] = entries[oldpath];
		delete entries[oldpath];
	}
	dir.contents[newname] = dir.contents[oldname];
	delete dir.contents[oldname];
	dir.contents[newname].name = newname;
	dir.order[dir.order.indexOf(oldname)] = newname;
	return true;
},

MoveEntry: function(oldpath, newpath) {
	if(oldpath.length === 0) {
		return false;
	}
	var dirname = oldpath[oldpath.length-1];
	var olddir = this.GetDirectoryFromPath(oldpath.slice(0, -1));
	if(!("contents" in olddir) || !(dirname in olddir.contents)) {
		return false;
	}
	var newdir = this.GetDirectoryFromPath(newpath);
	if(!("contents" in newdir) || (dirname in newdir.contents)) {
		return false;
	}
	if(newdir === olddir || newdir === olddir.contents[dirname]) {
		return false;
	}
	this.UpdateMovedEntries(olddir.contents[dirname], this.GetPathnameFromPath(oldpath.slice(0, -1)), this.GetPathnameFromPath(newpath));
	newdir.contents[dirname] = olddir.contents[dirname];
	olddir.order.splice(olddir.order.indexOf(dirname), 1);
	newdir.order.push(dirname);
	delete olddir.contents[dirname];
	return true;
},

DragEntry: function(oldpath, newpath, after) {
	console.log("DragEntry:\noldpath: " + oldpath + "\nnewpath: " + newpath + "\nafter: " + after);
	if(oldpath.length === 0) {
		return false;
	}
	var dirname = oldpath[oldpath.length-1];
	var targetname = newpath[newpath.length-1];
	var olddir = this.GetDirectoryFromPath(oldpath.slice(0, -1));
	if(!("contents" in olddir) || !(dirname in olddir.contents)) {
		return false;
	}
	if(newpath.length === 0) { //Dragging into the toplevel
		if(olddir === toplevel) {
			olddir.order.splice(olddir.order.indexOf(dirname), 1);
			toplevel.order.splice(0, 0, dirname);
		} else {
			this.UpdateMovedEntries(olddir.contents[dirname], this.GetPathnameFromPath(oldpath.slice(0, -1)), this.GetPathnameFromPath(newpath.slice(0, -1)));
			toplevel.contents[dirname] = olddir.contents[dirname];
			olddir.order.splice(olddir.order.indexOf(dirname), 1);
			toplevel.order.splice(0, 0, dirname);
			delete olddir.contents[dirname];
		}
		return true;
	}
	var newdir = this.GetDirectoryFromPath(newpath.slice(0, -1));
	if(!("contents" in newdir) || (newdir !== olddir && (dirname in newdir.contents))) {
		return false;
	}
	if(newdir !== olddir) {
		this.UpdateMovedEntries(olddir.contents[dirname], this.GetPathnameFromPath(oldpath.slice(0, -1)), this.GetPathnameFromPath(newpath.slice(0, -1)));
		newdir.contents[dirname] = olddir.contents[dirname];
		olddir.order.splice(olddir.order.indexOf(dirname), 1);
		newdir.order.splice((after ? newdir.order.indexOf(targetname) + 1 : newdir.order.indexOf(targetname)), 0, dirname);
		delete olddir.contents[dirname];
	} else {
		olddir.order.splice(olddir.order.indexOf(dirname), 1);
		newdir.order.splice((after ? newdir.order.indexOf(targetname) + 1 : newdir.order.indexOf(targetname)), 0, dirname);
	}
	return true;
},

UpdateMovedEntries: function(dir, oldpathname, newpathname) {
	var oldpath = oldpathname + "/" + encodeURIComponent(dir.name) + ".html";
	var newpath = newpathname + "/" + encodeURIComponent(dir.name) + ".html";
	if(oldpath in entries) {
		entries[newpath] = entries[oldpath];
		delete entries[oldpath];
	}
	if("contents" in dir) {
		for(var name in dir.contents) {
			this.UpdateMovedEntries(dir.contents[name], oldpathname + "/" + encodeURIComponent(dir.name), newpathname + "/" + encodeURIComponent(dir.name));
		}
	}
},

RenameDirectory: function(path, newname, togglelock) {
	var oldname = path[path.length - 1];
	if(oldname === newname)
		return false;
	var parentPath = path.slice(0, -1);
	var dir = this.GetDirectoryFromPath(parentPath);
	if(!("contents" in dir) || !(oldname in dir.contents) || newname in dir.contents)
		return false;
	var parentPathname = this.GetPathnameFromPath(parentPath);
	if("contents" in dir.contents[oldname]) {
		for(var name in dir.contents[oldname].contents) {
			this.UpdateMovedEntries(dir.contents[oldname].contents[name], parentPathname + "/" + encodeURIComponent(oldname), parentPathname + "/" + encodeURIComponent(newname));
		}
	}
	dir.contents[newname] = dir.contents[oldname];
	dir.contents[newname].name = newname;
	delete dir.contents[oldname];
	dir.order[dir.order.indexOf(oldname)] = newname;
	this.ToggleDirectoryLock(dir.contents[newname]);
	return true;
},

LoadDatabase: function() {
	try {
		toplevel = JSON.parse(fs.readFileSync('./database/database.json', 'utf8'));
		BuildOrder(toplevel);
		entries = JSON.parse(fs.readFileSync('./database/entries.json', 'utf8'));
		if(typeof toplevel !== 'object') {
			toplevel = new Directory('database', '');
			entries = {};
			fs.mkdirSync('./database', function(err) {
				if(err && err.code !== 'EEXIST') {throw err;}
			});
			this.SaveDatabase();
		}
		
	} catch(err) {
		toplevel = new Directory('database', '');
		entries = {};
		fs.mkdirSync('./database', function(er) {
			if(er && er.code !== 'EEXIST') {throw er;}
		});
		this.SaveDatabase();
	}
},

ToggleDirectoryLock: function(dir) {
	if(!dir || !("contents" in dir))
		return false;
	dir.locked = !dir.locked;
	return true;
},

PathIsLocked: function(path) {
	var curdir = toplevel;
	var i = 0;
	while(i < path.length) {
		if(!("contents" in curdir))
			return false;
		curdir = curdir.contents[path[i]];
		i++;
	}
	return curdir.locked;
},

SaveDatabase: function() {
	savedToplevel = true;
	that = this;
	fs.writeFile('./database/database.json', JSON.stringify(toplevel), 'utf8', function (err) {
		if(err) {
			console.log("Failed to save database directory.");
			console.log(err.stack);
			savedToplevel = false;
			setTimeout(that.SaveDatabase, 1000);
		}
	});
	if(savedToplevel) {
		fs.writeFile('./database/entries.json', JSON.stringify(entries), 'utf8', function (err) {
			if(err) {
				console.log("Failed to save database entries.");
				console.log(err.stack);
				setTimeout(that.SaveDatabase, 1000);
			}
		});
	}
},

InitializeDatabaseSocket: function(socket) {
	var that = this;
	var user = [socket, '', 'Guest'];
	databaseSockets.push(user);
	socket.emit('UpdateDatabase', toplevel);
	socket.on('disconnect', function() {
		databaseSockets.splice(databaseSockets.indexOf(user), 1);
	});
	socket.on('AddDirectory', function(path, name, creator, locked) {
		if(!(user[1]) || !creator || user[2] !== 'Admin') {
			console.log('Attempt to create directory by '+user[1]);
			return;
		}
		var dir = that.AddDirectory(path, name, creator, locked);
		if(dir) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			console.log('Failure to create directory '+name+' on path '+path);
		}
	});
	socket.on('AddEntry', function(path, name, creator, content) {
		if(!(user[1]) || !creator || (user[2] !== 'Admin' && that.PathIsLocked(path))) {
			console.log('Attempt to create entry by '+user[1]+' in path '+path);
			return;
		}
		var dir = that.AddEntry(path, name, creator, content);
		if(dir) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			console.log('Failure to create file '+name+' on path '+path);
		}
	});
	socket.on('DeleteEntry', function(path) {
		if(path.length === 0) {
			console.log('Attempt to call DeleteEntry at toplevel by '+user[1]);
			return;
		}
		var dir = that.GetDirectoryFromPath(path);
		if(!(user[1]) || !(user[2] === 'Admin' || user[1] === dir.creator)) {
			console.log('Attempt to delete entry by '+user[1]+' in path '+path);
			return;
		}
		var success = that.DeleteEntry(path);
		if(success) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
		} else {
			console.log('Failure to delete file on path '+path);
		}
	});
	socket.on('EditEntry', function(path, name, content) {
		var dir = that.GetDirectoryFromPath(path);
		if(!(user[1]) || !(user[2] === 'Admin' || user[1] === dir.creator)) {
			console.log('Attempt to edit entry '+name+' by '+user[1]+' in path '+path);
			return;
		}
		var success = false;
		if(content) {
			var pathname = that.GetPathnameFromPath(path) + ".html";
			if(!that.SetEntryContent(pathname, content)) {
				console.log('Failure to edit entry '+name+' on path '+path);
			} else {
				success = true;
			}
		}
		if(name) {
			if(!that.RenameEntry(path, name)) {
				console.log('Failure to rename entry '+name+' on path '+path);
			} else {
				success = true;
			}
		}
		if(success) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		}
	});
	socket.on('RequestEntry', function(pathname, callback) {
		if(pathname in entries) {
			callback(entries[pathname]);
		} else {
			callback("");
		}
	});
	socket.on('MoveEntry', function(oldpath, newpath) {
		if(!(user[1]) || user[2] !== 'Admin') {
			console.log('Attempt to move entry by '+user[1]+' in path '+oldpath);
			return;
		}
		if(that.MoveEntry(oldpath, newpath)) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			console.log('Failure to move entry on path '+oldpath+' to path '+newpath);
		}
	});
	socket.on('DragEntry', function(oldpath, newpath, after) {
		if(!(user[1]) || user[2] !== 'Admin') {
			console.log('Attempt to move entry by '+user[1]+' in path '+oldpath);
			return;
		}
		if(that.DragEntry(oldpath, newpath, after)) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
		} else {
			console.log('Failure to move entry on path '+oldpath+' to path '+newpath);
		}
	});
	socket.on('RenameDirectory', function(path, newname, togglelock) {
		if(!(user[1]) || user[2] !== 'Admin') {
			console.log('Attempt to rename directory by '+user[1]+' in path '+path);
			return;
		}
		if(that.RenameDirectory(path, newname, togglelock)) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			console.log('Failure to rename directory on path '+path);
		}
	});
	socket.on('LockDirectory', function(path) {
		if(user[1] && user[2] === 'Admin' && that.ToggleDirectoryLock(that.GetDirectoryFromPath(path))) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			console.log('Failure to alter lock by '+user[1]+' on path '+path);
		}
	});
	socket.on('DatabaseLogin', function(username, password, callback) {
		fs.readFile('./logins.json', 'utf8', function(err, logins) {
			if(err) {
				socket.emit('UpdateError', err);
				return;
			}
			logins = JSON.parse(logins);
			if(logins[username]) {
				if(logins[username].password == password) {
					try {
						banlist = JSON.parse(fs.readFileSync('./bans.json', 'utf8'));
						if(user in banlist.users) { //Banned people can still read. They're harmless.
							socket.emit('UpdateError', "You're banned from logging in, but you can still read things. I'm not a jerk.");
							socket.emit('CloseModal');
							return;
						}
					} catch(err) {} //Couldn't read bans.json, so just assume they're fine
					user[1] = username;
					user[2] = logins[username].permissions;
					socket.emit('SetUsername', username, logins[username].permissions, password);
					callback('You have successfully logged in as ' + username + '!');
					socket.emit('CloseModal');
					socket.emit('UpdateDatabase', toplevel);
				} else {
					callback("Your password was incorrect.");
				}
			} else {
				callback("That username was not in our list.");
			}
		});
	});
}
};
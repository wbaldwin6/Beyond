fs = require('fs');

function Directory(name, creator, locked) {
	this.name = name;
	this.creator = creator;
	this.contents = {};
	this.locked = locked;
}

function Entry(name, creator) {
	this.name = name;
	this.creator = creator;
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
	return dir.contents[name];
},

AddEntry: function(path, name, creator, content) {
	var dir = this.GetDirectoryFromPath(path);
	if(!("contents" in dir) || name in dir.contents)
		return undefined;
	var pathname = this.GetPathnameFromPath(path) + "/" + encodeURIComponent(name) + ".html";
	dir.contents[name] = new Entry(name, creator);
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
	delete olddir.contents[dirname];
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
	this.ToggleDirectoryLock(dir.contents[newname]);
	return true;
},

LoadDatabase: function() {
	try {
		toplevel = JSON.parse(fs.readFileSync('./database/database.json', 'utf8'));
		entries = JSON.parse(fs.readFileSync('./database/entries.json', 'utf8'));
		if(typeof toplevel !== 'object') {
			toplevel = new Directory('database', '');
			entries = {};
			fs.mkdirSync('./database', function(err) {
				if(err && err.code != 'EEXIST') throw err;
			});
			this.SaveDatabase();
		}
	} catch(err) {
		console.log(err.stack);
		toplevel = new Directory('database', '');
		entries = {};
		fs.mkdirSync('./database', function(er) {
			if(er && er.code != 'EEXIST') throw er;
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

InitializeDatabaseSocket: function(socket, username, permissions) {
	var that = this;
	var user = [socket, username, permissions];
	databaseSockets.push(user);
	socket.emit('InitializeDatabase', username, permissions, toplevel);
	socket.on('disconnect', function() {
		databaseSockets.splice(databaseSockets.indexOf(user), 1);
	});
	socket.on('AddDirectory', function(path, name, creator, locked) {
		if(user[2] !== 'Admin') {
			socket.emit('UpdateError', 'You do not have permission to create directories!');
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
			socket.emit('UpdateError', 'That directory could not be created.');
		}
	});
	socket.on('AddEntry', function(path, name, creator, content) {
		if(user[2] !== 'Admin' && that.GetDirectoryFromPath(path).locked) {
			socket.emit('UpdateError', 'You do not have permission to create entries in that directory.');
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
			socket.emit('UpdateError', 'That file could not be created.');
		}
	});
	socket.on('DeleteEntry', function(path) {
		if(path.length === 0) {
			socket.emit('UpdateError', 'Trying to delete the whole database, I see.');
			return;
		}
		var dir = that.GetDirectoryFromPath(path);
		if(!(user[2] === 'Admin' || user[1] === dir.creator)) {
			socket.emit('UpdateError', 'You do not have permission to delete that!');
			return;
		}
		var success = that.DeleteEntry(path);
		if(success) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
		} else {
			socket.emit('UpdateError', 'That File Could Not Be Deleted!');
		}
	});
	socket.on('EditEntry', function(path, name, content) {
		var dir = that.GetDirectoryFromPath(path);
		if(!(user[2] === 'Admin' || user[1] === dir.creator)) {
			socket.emit('UpdateError', 'You do not have permission to edit that!');
			return;
		}
		var success = false;
		if(content) {
			var pathname = that.GetPathnameFromPath(path) + ".html";
			if(!that.SetEntryContent(pathname, content)) {
				socket.emit('UpdateError', 'That page could not be editted.');
			} else {
				success = true;
			}
		}
		if(name) {
			if(!that.RenameEntry(path, name)) {
				socket.emit('UpdateError', 'The name of the entry could not be changed.');
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
		if(user[2] !== 'Admin') {
			socket.emit('UpdateError', 'You do not have permission to move that.');
			return;
		}
		if(that.MoveEntry(oldpath, newpath)) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			socket.emit('UpdateError', 'That could not be moved into the selected directory.');
		}
	});
	socket.on('RenameDirectory', function(path, newname, togglelock) {
		if(user[2] !== 'Admin') {
			socket.emit('UpdateError', 'You do not have permission to rename directories.');
			return;
		}
		if(that.RenameDirectory(path, newname, togglelock)) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			socket.emit('UpdateError', 'The directory could not be renamed to the given name.');
		}
	});
	socket.on('LockDirectory', function(path) {
		if(user[2] === 'Admin' && that.ToggleDirectoryLock(that.GetDirectoryFromPath(path))) {
			that.SaveDatabase();
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
			socket.emit('CloseModal');
		} else {
			socket.emit('UpdateError', 'You cannot change the locked status of that directory.');
		}
	});
	socket.on('ReLogin', function(username, permissions) {
		databaseSockets.push(user);
		socket.emit('InitializeDatabase', username, permissions, toplevel);
	});
}
};
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
	this.SaveDatabase();
	return dir.contents[name];
},

AddEntry: function(path, name, creator, content) {
	var dir = this.GetDirectoryFromPath(path);
	if(!("contents" in dir) || name in dir.contents)
		return undefined;
	var pathname = encodeURI(this.GetPathnameFromPath(path) + "/" + name + ".html");
	dir.contents[name] = new Entry(name, creator);
	entries[pathname] = content;
	this.SaveDatabase();
	return dir.contents[name];
},

DeleteEntry: function(path) {
	if(path.length === 0)
		return false;
	var dir = this.GetDirectoryFromPath(path.slice(0, -1));
	if(!("contents" in dir) || !(path[path.length-1] in dir.contents)) {
		return false;
	}
	var pathname = encodeURI(this.GetPathnameFromPath(path)) + ".html";
	if(pathname in entries) {
		delete entries[pathname];
	}
	delete dir.contents[path[path.length-1]];
	this.SaveDatabase();
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
		pathname += "/" + path[i];
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
	this.SaveDatabase();
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
	var oldpath = encodeURI(dirpath + "/" + oldname + ".html");
	if(oldpath in entries) {
		var newpath = encodeURI(dirpath + "/" + newname + ".html");
		entries[newpath] = entries[oldpath];
		delete entries[oldpath];
	}
	dir.contents[newname] = dir.contents[oldname];
	delete dir.contents[oldname];
	dir.contents[newname].name = newname;
	this.SaveDatabase();
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
	this.SaveDatabase();
	return true;
},

UpdateMovedEntries: function(dir, oldpathname, newpathname) {
	var oldpath = encodeURI(oldpathname + "/" + dir.name + ".html");
	var newpath = encodeURI(newpathname + "/" + dir.name + ".html");
	if(oldpath in entries) {
		entries[newpath] = entries[oldpath];
		delete entries[oldpath];
	}
	if("contents" in dir) {
		for(var name in dir.contents) {
			this.UpdateMovedEntries(dir.contents[name], oldpathname + "/" + dir.name, newpathname + "/" + dir.name);
		}
	}
},

RenameDirectory: function(path, newname) {
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
			this.UpdateMovedEntries(dir.contents[oldname].contents[name], parentPathname + "/" + oldname, parentPathname + "/" + newname);
		}
	}
	dir.contents[newname] = dir.contents[oldname];
	dir.contents[newname].name = newname;
	delete dir.contents[oldname];
	this.SaveDatabase();
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
				if(err.code !== 'EEXIST') throw err;
			});
			this.SaveDatabase();
		}
	} catch(err) {
		toplevel = new Directory('database', '');
		entries = {};
		fs.mkdirSync('./database', function(err) {
			if(err.code !== 'EEXIST') throw err;
		});
		this.SaveDatabase();
	}
},

ToggleDirectoryLock: function(dir) {
	if(!dir || !("contents" in dir))
		return false;
	dir.locked = !dir.locked;
	this.SaveDatabase();
	return true;
},

SaveDatabase: function() {
	fs.writeFile('./database/database.json', JSON.stringify(toplevel), 'utf8', function (err) {
		if(err) throw err;
	});
	fs.writeFile('./database/entries.json', JSON.stringify(entries), 'utf8', function (err) {
		if(err) throw err;
	});
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
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
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
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
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
			var pathname = encodeURI(that.GetPathnameFromPath(path) + ".html");
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
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
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
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
		} else {
			socket.emit('UpdateError', 'That could not be moved into the selected directory.');
		}
	});
	socket.on('RenameDirectory', function(path, newname) {
		if(user[2] !== 'Admin') {
			socket.emit('UpdateError', 'You do not have permission to rename directories.');
			return;
		}
		if(that.RenameDirectory(path, newname)) {
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
		} else {
			socket.emit('UpdateError', 'The directory could not be renamed to the given name.');
		}
	});
	socket.on('LockDirectory', function(path) {
		if(user[2] === 'Admin' && that.ToggleDirectoryLock(that.GetDirectoryFromPath(path))) {
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i][0].emit('UpdateDatabase', toplevel);
			}
		} else {
			socket.emit('UpdateError', 'You cannot change the locked status of that directory.');
		}
	});
}
};
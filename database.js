fs = require('fs');

function Directory(name, creator) {
	this.name = name;
	this.creator = creator;
	this.contents = {};
}

function Entry(name, creator) {
	this.name = name;
	this.creator = creator;
}

var toplevel;
var entries;
var databaseSockets = [];

module.exports = {
AddDirectory: function(path, name, creator) {
	var dir = this.GetDirectoryFromPath(path);
	if(!("contents" in dir) || name in dir.contents)
		return undefined;
	dir.contents[name] = new Directory(name, creator);
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
	if(!(contents in dir) || newname in dir.contents || !(oldname in dir.contents)) {
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
},

LoadDatabase: function() {
	try {
		toplevel = JSON.parse(fs.readFileSync('database.json', 'utf8'));
		entries = JSON.parse(fs.readFileSync('entries.json', 'utf8'));
		if(typeof toplevel !== 'object') {
			toplevel = new Directory('database', '');
			entries = {};
			this.SaveDatabase();
		}
	} catch(err) {
		toplevel = new Directory('database', '');
		entries = {};
		this.SaveDatabase();
	}
},

SaveDatabase: function() {
	fs.writeFile('database.json', JSON.stringify(toplevel), 'utf8', function (err) {
		if(err) throw err;
	});
	fs.writeFile('entries.json', JSON.stringify(entries), 'utf8', function (err) {
		if(err) throw err;
	});
},

InitializeDatabaseSocket: function(socket, username, permissions) {
	var that = this;
	databaseSockets.push(socket);
	socket.emit('InitializeDatabase', username, permissions, toplevel);
	socket.on('disconnect', function() {
		databaseSockets.splice(databaseSockets.indexOf(socket), 1);
	});
	socket.on('AddDirectory', function(path, name, creator) {
		var dir = that.AddDirectory(path, name, creator);
		if(dir) {
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i].emit('UpdateDatabase', 'add', {path: path, entry: dir});
			}
		} else {
			socket.emit('UpdateError', 'That Directory Already Exists!');
		}
	});
	socket.on('AddEntry', function(path, name, creator, content) {
		var dir = that.AddEntry(path, name, creator, content);
		if(dir) {
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i].emit('UpdateDatabase', 'add', {path: path, entry: dir});
			}
		} else {
			socket.emit('UpdateError', 'That File Already Exists!');
		}
	});
	socket.on('DeleteEntry', function(path) {
		if(path.length === 0) {
			socket.emit('UpdateDatabase', 'Trying to delete the whole database, I see.');
			return;
		}
		var success = that.DeleteEntry(path);
		if(success) {
			for(var i = 0; i < databaseSockets.length; i++) {
				databaseSockets[i].emit('UpdateDatabase', 'del', {path: path});
			}
		} else {
			socket.emit('UpdateError', 'That File Could Not Be Found!');
		}
	});
	socket.on('EditEntry', function(path, name, content) {
		var success = false;
		if(content) {
			var pathname = encodeURI(that.GetPathnameFromPath(path) + ".html");
			console.log(pathname);
			if(!that.SetEntryContent(pathname, content)) {
				socket.emit('UpdateError', 'That page could not be found to be rewritten.');
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
				databaseSockets[i].emit('UpdateDatabase', 'edit', {path: path, name: name});
			}
		}
	});
	socket.on('RequestEntry', function(pathname, callback) {
		if(pathname in entries) {
			callback(entries[pathname]);
		} else {
			callback("");
		}
	})
}
};
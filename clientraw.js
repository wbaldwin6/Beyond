// To compile this with the devDependencies, use the following command:
// node_modules\.bin\babel --plugins transform-react-jsx clientraw.js --presets=react,minify --watch --out-file client.js

var socket = io();

// scales the image by (float) scale < 1
// returns a canvas containing the scaled image.
var downScaleImage = function(img, scale) {
    var imgCV = document.createElement('canvas');
    imgCV.width = img.naturalWidth;
    imgCV.height = img.naturalHeight;
    var imgCtx = imgCV.getContext('2d');
    imgCtx.drawImage(img, 0, 0);
    if(scale < 1){
		return downScaleCanvas(imgCV, scale);
    } else {
		return imgCV;
    }
};

// scales the canvas by (float) scale < 1
// returns a new canvas containing the scaled image.
var downScaleCanvas = function(cv, scale) {
    if (!(scale < 1) || !(scale > 0)) throw ('scale must be a positive number <1 ');
    var sqScale = scale * scale; // square scale = area of source pixel within target
    var sw = cv.width; // source image width
    var sh = cv.height; // source image height
    var tw = Math.floor(sw * scale); // target image width
    var th = Math.floor(sh * scale); // target image height
    var sx = 0, sy = 0, sIndex = 0; // source x,y, index within source array
    var tx = 0, ty = 0, yIndex = 0, tIndex = 0; // target x,y, x,y index within target array
    var tX = 0, tY = 0; // rounded tx, ty
    var w = 0, nw = 0, wx = 0, nwx = 0, wy = 0, nwy = 0; // weight / next weight x / y
    // weight is weight of current source point within target.
    // next weight is weight of current source point within next target's point.
    var crossX = false; // does scaled px cross its current px right border ?
    var crossY = false; // does scaled px cross its current px bottom border ?
    var sBuffer = cv.getContext('2d').
    getImageData(0, 0, sw, sh).data; // source buffer 8 bit rgba
    var tBuffer = new Float32Array(3 * tw * th); // target buffer Float32 rgb
    var sR = 0, sG = 0,  sB = 0; // source's current point r,g,b
    /* untested !
    var sA = 0;  //source alpha  */    

    for (sy = 0; sy < sh; sy++) {
        ty = sy * scale; // y src position within target
        tY = 0 | ty;     // rounded : target pixel's y
        yIndex = 3 * tY * tw;  // line index within target array
        crossY = (tY != (0 | ty + scale)); 
        if (crossY) { // if pixel is crossing botton target pixel
            wy = (tY + 1 - ty); // weight of point within target pixel
            nwy = (ty + scale - tY - 1); // ... within y+1 target pixel
        }
        for (sx = 0; sx < sw; sx++, sIndex += 4) {
            tx = sx * scale; // x src position within target
            tX = 0 |  tx;    // rounded : target pixel's x
            tIndex = yIndex + tX * 3; // target pixel index within target array
            crossX = (tX != (0 | tx + scale));
            if (crossX) { // if pixel is crossing target pixel's right
                wx = (tX + 1 - tx); // weight of point within target pixel
                nwx = (tx + scale - tX - 1); // ... within x+1 target pixel
            }
            sR = sBuffer[sIndex    ];   // retrieving r,g,b for curr src px.
            sG = sBuffer[sIndex + 1];
            sB = sBuffer[sIndex + 2];

            if (!crossX && !crossY) { // pixel does not cross
                // just add components weighted by squared scale.
                tBuffer[tIndex    ] += sR * sqScale;
                tBuffer[tIndex + 1] += sG * sqScale;
                tBuffer[tIndex + 2] += sB * sqScale;
            } else if (crossX && !crossY) { // cross on X only
                w = wx * scale;
                // add weighted component for current px
                tBuffer[tIndex    ] += sR * w;
                tBuffer[tIndex + 1] += sG * w;
                tBuffer[tIndex + 2] += sB * w;
                // add weighted component for next (tX+1) px                
                nw = nwx * scale
                tBuffer[tIndex + 3] += sR * nw;
                tBuffer[tIndex + 4] += sG * nw;
                tBuffer[tIndex + 5] += sB * nw;
            } else if (crossY && !crossX) { // cross on Y only
                w = wy * scale;
                // add weighted component for current px
                tBuffer[tIndex    ] += sR * w;
                tBuffer[tIndex + 1] += sG * w;
                tBuffer[tIndex + 2] += sB * w;
                // add weighted component for next (tY+1) px                
                nw = nwy * scale
                tBuffer[tIndex + 3 * tw    ] += sR * nw;
                tBuffer[tIndex + 3 * tw + 1] += sG * nw;
                tBuffer[tIndex + 3 * tw + 2] += sB * nw;
            } else { // crosses both x and y : four target points involved
                // add weighted component for current px
                w = wx * wy;
                tBuffer[tIndex    ] += sR * w;
                tBuffer[tIndex + 1] += sG * w;
                tBuffer[tIndex + 2] += sB * w;
                // for tX + 1; tY px
                nw = nwx * wy;
                tBuffer[tIndex + 3] += sR * nw;
                tBuffer[tIndex + 4] += sG * nw;
                tBuffer[tIndex + 5] += sB * nw;
                // for tX ; tY + 1 px
                nw = wx * nwy;
                tBuffer[tIndex + 3 * tw    ] += sR * nw;
                tBuffer[tIndex + 3 * tw + 1] += sG * nw;
                tBuffer[tIndex + 3 * tw + 2] += sB * nw;
                // for tX + 1 ; tY +1 px
                nw = nwx * nwy;
                tBuffer[tIndex + 3 * tw + 3] += sR * nw;
                tBuffer[tIndex + 3 * tw + 4] += sG * nw;
                tBuffer[tIndex + 3 * tw + 5] += sB * nw;
            }
        } // end for sx 
    } // end for sy

    // create result canvas
    var resCV = document.createElement('canvas');
    resCV.width = tw;
    resCV.height = th;
    var resCtx = resCV.getContext('2d');
    var imgRes = resCtx.getImageData(0, 0, tw, th);
    var tByteBuffer = imgRes.data;
    // convert float32 array into a UInt8Clamped Array
    var pxIndex = 0; //  
    for (sIndex = 0, tIndex = 0; pxIndex < tw * th; sIndex += 3, tIndex += 4, pxIndex++) {
        tByteBuffer[tIndex] = Math.ceil(tBuffer[sIndex]);
        tByteBuffer[tIndex + 1] = Math.ceil(tBuffer[sIndex + 1]);
        tByteBuffer[tIndex + 2] = Math.ceil(tBuffer[sIndex + 2]);
        tByteBuffer[tIndex + 3] = 255;
    }
    // writing result to canvas.
    resCtx.putImageData(imgRes, 0, 0);
    return resCV;
};

var title = 'Beyond';

var idleInterval;// = new Worker("idle.js");
var idleresponse = function(e){//sends only when the timer hits the designated point
	socket.emit('AFK', true); idleInterval.terminate(); idleInterval = null;
	document.onmousemove = back;
	document.onkeypress = back;
	document.title = "(AFK) "+title;
};

var resetTimer = function(e){idleInterval.postMessage(0)};

var timersetup = function(){idleInterval = new Worker("/idle.js"); idleInterval.onmessage = idleresponse; document.onmousemove = resetTimer; document.onkeypress = resetTimer;}

var back = function(e){
	if(!idleInterval){socket.emit('AFK', false); timersetup();}
	document.title = title;
	document.getElementsByTagName('link')[0].href = "/faceicons/favicon.png";
};

window.onfocus = back;

timersetup();

var rectimer;

var reconnected = false;

var sanitize = function(string){
	string = string.replace(/<br( \/)?>/g, '\n');
	return string;
};

var roll = function(dice){
	var result = [];
	if(dice[1].indexOf('!') > 0){//we don't know how many characters long dice[1] is.
		dice[1] = dice[1].slice(0, -1);
		dice[2] = '!';
	}
	if(dice[0]=='1' && dice[1]=='100' && dice[2]){//special case because I'm a hack.
		var open = 90;
		do{
			var roll = Math.floor(Math.random()*dice[1])+1;
			result.push(roll);
		} while (roll >= open++)//open roll window decreases each time.
	} else {
		for(var i = 0; i < dice[0]; i++){
			do {
				var roll = Math.floor(Math.random()*dice[1])+1;
				result.push(roll);
			} while (dice[2] && roll == dice[1])//explode at max
		}
	}
	return result;
};

var stopDrag = function(e){
	e.stopPropagation();
	e.preventDefault();
	if(e.touches){
		document.removeEventListener('touchmove', this.drag);
		document.removeEventListener('touchend', this.stopDrag);
	} else {
		document.removeEventListener('mousemove', this.drag);
		document.removeEventListener('mouseup', this.stopDrag);
	}
};

var Outercontainer = React.createClass({
	getInitialState: function(){
		var modals = [{type: 'login'}];
		if(navigator.appName == 'Microsoft Internet Explorer' || /edge|mobi/i.test(navigator.userAgent) || ((!window.chrome) && (typeof InstallTrigger == 'undefined'))){
			modals.push({type: 'warning'});
		}
		var room = document.URL.split('/');
		if(room.indexOf('rooms') >= 0){room = decodeURIComponent(room[room.length-1]);} else {room = '';}
		return {settings: {}, characters: [], modal: modals, selected: null, permissions: 'Guest', username: '', pass: '', players: {}, socketroom: room, posx: 25, posy: 50};
	},

	focusf: function(e){
		if(e.keyCode == 13 && document.activeElement.tagName != "TEXTAREA" && document.activeElement.tagName != "INPUT"){
			this.refs.OOCbar.focus()
		}
		resetTimer(e);
	},

	componentDidMount: function(){
		document.body.onkeypress = this.focusf;
		var that = this;
		this.props.socket.on('PlayerList', function(players, room){
			var ret = null;
			if(room == '0' || room == that.state.socketroom){//only update if it's from the right room
				ret = {players: players};
				if(players[that.state.username]){ret.permissions = players[that.state.username].permissions;}
			} else if(room && !that.state.socketroom){//playerlist from a Set Rooms listen
				ret = {roomplayers: that.state.roomplayers || {}};
				ret.roomplayers[room] = players;
			}
			if(ret){that.setState(ret);}
		});
		this.props.socket.on('UserDataUpdate', function(data){
			data = JSON.parse(data);
			that.setState(data);
		});
		this.props.socket.on('Title', function(message){
			if(document.title.startsWith('(AFK) ')){document.title = '(AFK) '+message;} else {document.title = message;}
			if(that.state.socketroom){
				document.title += ' ('+that.state.socketroom+')'; title = message+' ('+that.state.socketroom+')';
			} else {
				title = message;
			}
		});
		var recfun = function(){
			if(!reconnected){
				console.log('Connected, logging in...');
				that.props.socket.emit('login', that.state.username, that.state.pass, that.state.socketroom ? that.state.socketroom : true, function(res){
					if(res.settings){
						console.log('Logged in successfully (as far as I can tell).');
						//that.handleSettings(res.settings, res.characters);this SHOULDN'T change.
						reconnected = true;//we made it in, stop retrying.
						if(!idleInterval){that.props.socket.emit('AFK', true);}//if the idleInterval is null, leave them AFK until they return.
					} else {
						console.log(res);
					}
				});
				rectimer = setTimeout(recfun, 1000);// we keep trying as long as we're not connected.
			}//if connected it just stops.
		};
		this.props.socket.on('disconnect', function(){
			console.log('Disconnected.');
			reconnected = false;
		});
		this.props.socket.on('reconnect', function(){
			if(that.state.username){
				if(rectimer){clearTimeout(rectimer);}
				rectimer = setTimeout(recfun, 100);
			}
		});
		window.onbeforeunload = function (e){
			e = e || window.event;
			var message = "Logout";
			if(that.state.username){//try to save!
				that.handleSettings(that.state.settings, that.state.characters);
			}
			e.returnValue = message;
			return message;
		};
	},

	handleEnter: function(e){
		if(e.key === 'Enter'){
			//placeholder test function, will be added to the options menu later.
			if(this.refs.OOCbar.value){
				this.props.socket.emit('OOCmessage', this.refs.OOCbar.value, this.state.settings.textcolor);
			}
			this.refs.OOCbar.value = '';
			this.refs.OOCbar.placeholder = '';
		}
	},

	handleSettings: function(settings, characters, ret){
		this.setState({settings: settings, characters: characters});
		this.props.socket.emit('save', JSON.stringify({settings: settings, characters: characters}), ret);
	},

	setUser: function(name, pass){
		this.setState({username: name, pass: pass});
	},

	contextMenu: function(e){
		var target = e.target;
		if(target.tagName != 'TEXTAREA' && !(target.tagName == 'INPUT' && target.type == 'text')){
			e.preventDefault();
			e.stopPropagation();
			var className = target.className;
			while(!className && target.parentNode.getAttribute('id') != 'main'){
				target = target.parentNode;
				className = target.className;
			}
			if(className){
				var position = {x: e.nativeEvent.clientX, y: e.nativeEvent.clientY};
				//we don't go through the option list, we create it based on the clasname
				var options = [];
				switch(className){
					case 'characterclosed':
					case 'character':
						//add a check for 'if we're in doubleclick mode' to put open/close here
						options = ['Modify Derivatives', 'Set Active Character', 'Set Profile'];
						options.push('Delete Character');
						break;
					case 'derivative':
						options = ['Edit Derivative', 'Delete Derivative', 'Mod from Derivative', 'Omit Say', 'Omit Action', 'Unnamed Omit Action', 'Test Say', 'Test Action', 'Unnamed Test Action']
						if(['Player', 'Admin'].indexOf(this.state.permissions) > -1){
							options.splice(3, 0, 'Say', 'Action', 'Unnamed Action');
						}
						break;
					case 'chargroup':
						//add a check for 'if we're in doubleclick mode' to put open/close here
						options = ['New Character', 'Edit Group', 'Delete Group'];
						break;
					case 'charlist':
						//fallthrough
					case 'chargroup ungrouped':
						options = ['New Character', 'New Group'];
						break;
					case 'character admin':
						options = ['Set Profile', 'Delete Profile'];
						break;
					case 'PLentry':
						//add Whisper, check if admin for other commands
						options = ['Whisper'];
						if(this.state.permissions == 'Admin'){
							options.push('Make Player', 'Make Admin', 'Make Guest', 'Mute', 'Unmute', 'Boot', 'Ban');
						}
						break;
					case 'OOC message':
						//fallthrough
					case 'OOC whisper':
						options = ['Whisper'];
						if(this.state.permissions == 'Admin'){
							options.push('Make Player', 'Make Admin', 'Make Guest', 'Mute', 'Unmute', 'Boot', 'Ban');
						}
						//fallthrough
					case 'OOC system message':
						//fallthrough
					case 'OOC log message':
						//fallthrough
					case 'OOC say message':
						//fallthrough
					case 'OOC action message':
						//fallthrough
					case 'OOCbox':
						options.push('Clear OOC');
						break;
					case 'IC say message':
						//fallthrough
					case 'IC action message':
						options.push('View Character Profile');
						//check username in data, add edit if needed
						var charid = target.getAttribute('data').split('-');
						charid.pop(); charid = charid.join('-');//catches names with - in them
						if(charid == this.state.username){
							options.push('Edit', 'Full Edit', 'Delete Post');
						} else { //we only need this if it's not the user's own post.
							if(this.state.settings.notify && this.state.settings.notify[target.getAttribute('data')]){
								options.push('Stop Notifying (C)');
							} else {
								options.push('Notify for Character');
							}
						}
						//fallthrough
					case 'IC narration message':
						if(target.getAttribute('data') == this.state.username){//just name in this case
							options = ['Edit', 'Delete Post'];
						} else {//username doesn't match and not a fallthrough.
							if(this.state.settings.notify && ((!charid && this.state.settings.notify[target.getAttribute('data')]) || this.state.settings.notify[charid])){
								options.push('Stop Notifying (P)');
							} else if(charid != this.state.username) {
								options.push('Notify for Player');
							}
						}
						//fallthrough
					case 'ICbox':
						//add 'Narrate'
						options.unshift('Persistent Narrate');
						options.unshift('Narrate');
						options.push('Clear IC');
						break;
					case 'Dice Command':
						//Delete
						options = ['Private Roll', 'Delete'];
						break;
				}
				if(options.length){
					this.setState({context: {position: position, options: options, target: target}});
				}
			}
		}
	},

	handleContext: function(e){
		var name = e.target.textContent;
		var id = this.state.context.target.getAttribute('id');
		if(id){id = this.state.context.target.getAttribute('id').split(',');}
		var newmodal = {id: id, name: name};
		if(id && id.length >= 2 && !(isNaN(id[0]) || isNaN(id[1])) && name != 'Whisper'){
			newmodal.charid = this.state.characters[id[0]][id[1]][0].id;
			if(id.length === 3){
				var deriv = this.state.characters[id[0]][id[1]][id[2]];
				newmodal.icpos = {left: deriv.icpos.left, top: deriv.icpos.top};
			}
		}
		switch(name){
			case 'Notify for Player':
				if(this.state.context.target.className != 'IC narration message'){
					//get username from data
					var settings = this.state.settings;
					var charid = this.state.context.target.getAttribute('data').split('-');
					charid.pop(); charid = charid.join('-');
					if(!settings.notify){settings.notify = {};}
					settings.notify[charid] = {IC: true, OOC: false};
					this.handleSettings(settings, this.state.characters);
					break;
				} //if it's a narration just use data because that's already a username, fallthrough
			case 'Notify for Character':
				var settings = this.state.settings;
				if(!settings.notify){settings.notify = {};}
				settings.notify[this.state.context.target.getAttribute('data')] = {IC: true, OOC: false};
				this.handleSettings(settings, this.state.characters);
				break;
			case 'Stop Notifying (P)':
				if(this.state.context.target.className != 'IC narration message'){
					//get username from data
					var settings = this.state.settings;
					var charid = this.state.context.target.getAttribute('data').split('-');
					charid.pop(); charid = charid.join('-');
					if(!settings.notify){settings.notify = {};}
					delete settings.notify[charid];
					this.handleSettings(settings, this.state.characters);
					break;
				} //if it's a narration just use data because that's already a username, fallthrough
			case 'Stop Notifying (C)':
				var settings = this.state.settings;
				if(!settings.notify){settings.notify = {};}
				delete settings.notify[this.state.context.target.getAttribute('data')];
				this.handleSettings(settings, this.state.characters);
				break;
			case 'Delete'://just delete it outright.
				var settings = this.state.settings;
				settings.dice.splice(+id[0].substring(4), 1);
				this.handleSettings(settings, this.state.characters);
				break;
			case 'Delete Group':
				newmodal.groupname = this.state.characters[id[0]][0];
				//fallthrough
			case 'Delete Character'://fallthrough
			case 'Delete Derivative'://fallthrough
			case 'Clear OOC':
				newmodal.cb = this.refs.OOCbox.boxClear;
				newmodal.type = 'delete';
				break;
			case 'Clear IC':
				newmodal.cb = this.refs.ICbox.boxClear;
				newmodal.type = 'delete';
				break;
			case 'Delete Post':
				var room = this.state.context.target.getAttribute('data-room');
				if(room){room = room.slice(1, -1);}
				newmodal.room = room;
				newmodal.type = 'delete';
				break;
			case 'Private Roll':
				var dice = this.state.context.target.getAttribute('data').split('d');
				var result = roll(dice);
				this.props.socket.emit('Dice', this.state.context.target.getAttribute('data'), result, this.state.settings.textcolor, true);
				break;
			case 'Mod from Derivative':
				newmodal.type = 'character';
				newmodal.useid = newmodal.id[2];
				newmodal.id = [newmodal.id[0], newmodal.id[1]];//trim off third value
			case 'Modify Derivatives'://fallthrough
			case 'Edit Derivatives'://fallthrough
			case 'Edit Derivative'://fallthrough
			case 'New Character':
				newmodal.type = 'character';
				break;
			case 'Edit Group':
				newmodal.groupname = this.state.characters[id[0]][0];
				//fallthrough
			case 'New Group':
				newmodal.type = 'group';
				break;
			case 'Edit':
				var children = this.state.context.target.children;
				var room = this.state.context.target.getAttribute('data-room');
				if(room){room = room.slice(1, -1);}
				newmodal.room = room;
				newmodal.post = children[children.length-1].innerHTML;
				if(this.state.context.target.className.split(' ')[1] === 'say'){
					newmodal.post = newmodal.post.slice(1, -1);
				}
				if(newmodal.post.endsWith("*")){
					newmodal.post = newmodal.post.slice(0, -1);
				}
				newmodal.post = sanitize(newmodal.post);
				//fallthrough
			case 'Whisper':
				newmodal.id = id.join(',');//doesn't harm edit as long as you make modata.id[0] into modata.id there, it should only be one number
				newmodal.data = this.state.context.target.getAttribute('data');
				//fallthrough
			case 'Say':
				//fallthrough
			case 'Action':
				//fallthrough
			case 'Unnamed Action':
				//fallthrough
			case 'Omit Say':
				//fallthrough
			case 'Omit Action':
				//fallthrough
			case 'Unnamed Omit Action':
				//fallthrough
			case 'Test Say':
				//fallthrough
			case 'Test Action':
				//fallthrough
			case 'Unnamed Test Action':
				//fallthrough
			case 'Narrate':
				//fallthrough
			case 'Persistent Narrate':
				//fallthrough
				newmodal.type = 'action';
				break;
			case 'Full Edit':
				newmodal.charid = this.state.context.target.getAttribute('data');
				var room = this.state.context.target.getAttribute('data-room');
				if(room){room = room.slice(1, -1);}
				newmodal.room = room;
				var t = this.state.context.target.className.split(' ')[1];
				newmodal.pt = t.charAt(0).toUpperCase() + t.slice(1);
				var children = this.state.context.target.children;
				newmodal.post = children[children.length-1].innerHTML;
				if(this.state.context.target.className.split(' ')[1] === 'say'){
					newmodal.post = newmodal.post.slice(1, -1);
				}
				if(newmodal.post.endsWith("*")){
					newmodal.post = newmodal.post.slice(0, -1);
				}
				newmodal.post = sanitize(newmodal.post);
				//fallthrough
			case 'Set Active Character':
				newmodal.type = 'active';//two part charid already in place
				break;
			case 'Set Profile':
				if(!newmodal.charid){newmodal.charid = newmodal.id.join(','); newmodal.charname = this.state.context.target.textContent;}
				var that=this;
				this.props.socket.emit('Show Profile', newmodal.charid, function(response){
					newmodal.post = sanitize(response);
					newmodal.type = 'action';
					that.modalpush(newmodal);//async is just fine thanks to this function.
				});
				break;
			case 'Delete Profile':
				newmodal.charid = newmodal.id.join(','); newmodal.charname = this.state.context.target.textContent;
				newmodal.type = 'delete';
				break;
			case 'Mute':
				//fallthrough
			case 'Unmute':
				//fallthrough
			case 'Ban':
				//fallthrough
			case 'Boot':
				//fallthrough
			case 'Make Player':
				//fallthrough
			case 'Make Admin':
				//fallthrough
			case 'Make Guest':
				this.props.socket.emit('AdminCommand', name, id.join(','));
				break;
			case 'View Character Profile':
				var charid = this.state.context.target.getAttribute('data');
				charid = charid.split('-');
				var charnum = charid.pop();
				charid = charid.join('-');//Catch usernames with '-' in them.
				window.open('/characters/' + charid + '/' + charnum + '.html');
				break;
			default:
				console.log('Unrecognized context command.');
		}
		this.modalpush(newmodal);
	},

	modalpush: function(data){//helper for putting new modals in. Also good for letting other components do it.
		if(data && data.type && data.name){
			var mod = this.state.modal;
			var i=0;
			while(mod[i]){//until we find one that's undefined
				i++;
			}//we leave the loop when mod[i] is undefined, so...
			mod[i] = data;
			this.setState({modal: mod, selected: i});//if mod isn't changed it probably won't even update, and if it does the difference will be irrelevant.
		}
	},

	closeModal: function(n){
		var modal = this.state.modal;
		delete modal[n];
		this.setState({modal: modal});
	},

	selectModal: function(n){
		this.setState({selected: n});
	},

	closeContext: function(e){
		//this function just tells the context menu to close if you click literally anything.
		this.setState({context: null});
	},

	startDrag: function(e){
		e.stopPropagation();
		e.preventDefault();
		this.setState({vertdrag: e.target.getAttribute('class') == 'gutter gutter-vertical'});
		if(e.touches){
			document.addEventListener('touchmove', this.drag);
			document.addEventListener('touchend', this.stopDrag);
		} else {
			document.addEventListener('mousemove', this.drag);
			document.addEventListener('mouseup', this.stopDrag);
		}
	},

	drag: function(e){
		if(e.touches){
			e.clientX = e.touches[0].clientX;
			e.clientY = e.touches[0].clientY;
		}
		e.stopPropagation();
		e.preventDefault();
		if(this.state.vertdrag){
			this.setState({posy: 100*e.clientY/this.refs.OI.clientHeight});
		} else {
			this.setState({posx: 100*e.clientX/document.body.clientWidth});
		}
	},

	stopDrag: stopDrag,

	render: function(){//whenever I need bottom space I can tell left and IO to have their height as 100% - (however many pixels)
		var context = <div className='contextMenu' style={{display: 'none'}}></div>;
		var click = !this.state.context && this.state.settings.buttons ? this.contextMenu : null;
		if(this.state.context){
			var that = this;
			var options = this.state.context.options.map(function(op, i){
				return(<div key={i} className='contextOption' onClick={that.handleContext}>{op}</div>);
			});
			if(this.state.context.position.y > (0.75*window.innerHeight)){
				context = (<div className='contextMenu' style={{left: this.state.context.position.x+'px', bottom:(window.innerHeight-this.state.context.position.y)+'px'}}>{options}</div>);
			} else {
				context = (<div className='contextMenu' style={{left: this.state.context.position.x+'px', top:this.state.context.position.y+'px'}}>{options}</div>);
			}
		}
		return (
			<div style={{height: "calc(100vh - 19px)"}} onContextMenu={this.contextMenu} onClick={this.closeContext}>
				<ModalHandler socket={this.props.socket} handleSettings={this.handleSettings} setUser={this.setUser} modal={this.state.modal} closeModal={this.closeModal} selectModal={this.selectModal} selected={this.state.selected} characters={this.state.characters} settings={this.state.settings} socketroom={this.state.socketroom}/>
				{context}
				<div id="left" style={{width:"calc("+this.state.posx+"% - 5px)"}}>
					<ChartabHandler socket={this.props.socket} handleSettings={this.handleSettings} characters={this.state.characters} settings={this.state.settings} players={this.state.players} roomplayers={this.state.roomplayers} modalpush={this.modalpush} permissions={this.state.permissions} systemmessage={this.refs.OOCbox ? this.refs.OOCbox.systemmessage : null} contextMenu={this.contextMenu} socketroom={this.state.socketroom}/>
				</div>
				<div className="gutter gutter-horizontal" style={{width: '10px'}} onMouseDown={this.startDrag} onTouchStart={this.startDrag}/>
				<div id="OI" ref="OI" style={{width:"calc("+(100-this.state.posx)+"% - 5px)"}}>
					<div id="IC" onClick={click} style={{height:"calc("+this.state.posy+"% - 5px)"}}>
						<IChandler ref="ICbox" socket={this.props.socket} notify={this.state.settings.notify} rooms={this.state.settings.rooms} socketroom={this.state.socketroom ? true : false}/>
					</div>
					<div className="gutter gutter-vertical" style={{height: '10px'}} onMouseDown={this.startDrag} onTouchStart={this.startDrag}/>
					<div id="OOC" onClick={click} style={{height:"calc("+(100-this.state.posy)+"% - 5px)"}}>
						<OOChandler ref="OOCbox" socket={this.props.socket} notify={this.state.settings.notify} rooms={this.state.settings.rooms} socketroom={this.state.socketroom ? true : false}/>
					</div>
				</div>
				<input className="OOCbar" type="text" ref="OOCbar" placeholder="Input an OOC message" onKeyPress={this.handleEnter}/>
			</div>
		);
	}
});

var ModalHandler = React.createClass({
	verifyID: function(charid, id, icpos){
		var i, j, k;
		var characters = this.props.characters;
		if(characters[id[0]] && (id[0] == 0 && characters[0][0] || characters[id[0]][1])){//group exists and isn't empty.
			if(characters[id[0]][id[1]] && characters[id[0]][id[1]][0].id == charid){//id is occupied by the right character
				if(icpos && (!characters[id[0]][id[1]][id[2]] || !(characters[id[0]][id[1]][id[2]].icpos.left == icpos.left) || !(characters[id[0]][id[1]][id[2]].icpos.top == icpos.top))){
					for(k=0; k < characters[id[0]][id[1]].length; k++){//for each deriv in char
						if(characters[id[0]][id[1]][k].icpos.left == icpos.left && characters[id[0]][id[1]][k].icpos.top == icpos.top){//same deriv position
							return [id[0], id[1], k];
						}
					}
					return null;
				} else {
					return id;
				}
			} else {//wrong character or wrong length
				for(i=0; i < characters[id[0]].length; i++){//for each char in group
					if(characters[id[0]][i][0].id == charid){
						if(icpos && (!characters[id[0]][i][id[2]] || !(characters[id[0]][i][id[2]].icpos.left == icpos.left) || !(characters[id[0]][i][id[2]].icpos.top == icpos.top))){
							for(k=0; k < characters[id[0]][i].length; k++){//for each deriv in char
								if(characters[id[0]][i][k].icpos.left == icpos.left && characters[id[0]][i][k].icpos.top == icpos.top){//same deriv position
									return [id[0], i, k];
								}
							}
							return null;//do not check other characters if this fails.
						} else {//non-derivative or derivative matches
							return [id[0], i, id[2]];
						}
					}
				}
			}
		}//group doesn't exist, is empty, or doesn't contain the character
		for(i=0; i < characters.length; i++){//for each group ([i]) in charlist
			if(characters[i] != id[0]){//again, doesn't exist, is empty, or doesn't contain it.
				for(j=0; j < characters[i].length; j++){//for each char ([i][j]) in group
					if(characters[i][j][0].id == charid){
						if(icpos && (!characters[i][j][id[2]] || !(characters[i][j][id[2]].icpos.left == icpos.left) || !(characters[i][j][id[2]].icpos.top == icpos.top))){
							for(k=0; k < characters[i][j].length; k++){//for each deriv in char
								if(characters[i][j][k].icpos.left == icpos.left && characters[i][j][k].icpos.top == icpos.top){//same deriv position
									return [i, j, k];
								}
							}
							return null;//do not check other characters if this fails.
						} else {//non-derivative or derivative matches
							return [i, j, id[2]];
						}
					}
				}
			}
		}
	},

	render: function(){
		var that = this;
		var modals=this.props.modal.map(function (modal, index){
			if(modal){
				switch(modal.type){
					case 'login'://basically hardcoded and single-purpose.
						return(<LoginModal key={index} id={index} socket={that.props.socket} handleSettings={that.props.handleSettings} setUser={that.props.setUser} closeModal={that.props.closeModal} socketroom={that.props.socketroom}/>);
					case 'character'://character creation/edit modal.
						//TODO: Figure out how not to need to send settings.
						return(<CharacterModal key={index} id={index} socket={that.props.socket} modal={modal} characters={that.props.characters} settings={that.props.settings} verifyID={that.verifyID} handleSettings={that.props.handleSettings} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index}/>);
					case 'group'://group creation/edit modal.
						if(modal.accounts){ //admin modal
							return(<GroupModal key={index} id={index} socket={that.props.socket} modal={modal} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index}/>);
						} else {
							return(<GroupModal key={index} id={index} modal={modal} characters={that.props.characters} settings={that.props.settings} verifyID={that.verifyID} handleSettings={that.props.handleSettings} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index}/>);
						}
					case 'delete'://'are you sure?'
						return(<DeleteModal key={index} id={index} socket={that.props.socket} modal={modal} characters={that.props.characters} settings={that.props.settings} verifyID={that.verifyID} handleSettings={that.props.handleSettings} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index}/>);
					case 'action':
						return(<ActionModal key={index} id={index} socket={that.props.socket} modal={modal} characters={that.props.characters} settings={that.props.settings} verifyID={that.verifyID} handleSettings={that.props.handleSettings} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index} socketroom={that.props.socketroom}/>);
					case 'active':
						return(<ActiveModal key={index} id={index} socket={that.props.socket} modal={modal} characters={that.props.characters} settings={that.props.settings} verifyID={that.verifyID} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index} socketroom={that.props.socketroom}/>);
					case 'notifications':
						return(<NotificationModal key={index} id={index} socket={that.props.socket} modal={modal} characters={that.props.characters} settings={that.props.settings} handleSettings={that.props.handleSettings} selectModal={that.props.selectModal} isSelected={that.props.selected === index} closeModal={that.props.closeModal}/>);
					case 'warning':
						return(<WarningModal key={index} id={index} closeModal={that.props.closeModal}/>);
					case 'favicon':
						return(<FaviconModal key={index} id={index} socket={that.props.socket} modal={modal} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index}/>);
					case 'narrate':
						return(<NarrateModal key={index} id={index} socket={that.props.socket} modal={modal} settings={that.props.settings} handleSettings={that.props.handleSettings} closeModal={that.props.closeModal} selectModal={that.props.selectModal} isSelected={that.props.selected === index}/>);
				}
			} else {
				return(<div key={index} className="modal" style={{display:'none'}}></div>);
			}
		});
		return (
			<div className="modalContainer" style={{width:'100%', height:'100%'}}>{modals}</div>
		);
	}
});

var startDrag = function(e){
	if(e.target.getAttribute('class') == "modal" || e.target.getAttribute('class') == "modal selectedmodal"){//only START for the modal containers.
		e.stopPropagation();
		e.preventDefault();
		var rect = this.refs['this'].getBoundingClientRect();
		if(e.touches){
			e.clientX = e.touches[0].clientX;
			e.clientY = e.touches[0].clientY;
			e.nativeEvent.offsetX = e.touches[0].pageX - rect.left;
			e.nativeEvent.offsetY = e.touches[0].pageY - rect.top;
		}
		if(rect.right-e.clientX < 20 && rect.bottom-e.clientY < 20){
			this.setState({initialposition: {x: e.clientX, y: e.clientY}, resize: true});
		} else {
			this.setState({initialposition: {x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY}, resize: false});
		}
		if(e.touches){
			document.addEventListener('touchmove', this.drag);
			document.addEventListener('touchend', this.stopDrag);
		} else {
			document.addEventListener('mousemove', this.drag);
			document.addEventListener('mouseup', this.stopDrag);
		}
	}
};

var drag = function(e){
	if(e.touches){
		e.clientX = e.touches[0].clientX;
		e.clientY = e.touches[0].clientY;
	}
	e.stopPropagation();
	e.preventDefault();
	var initpos = this.state.initialposition;
	var x = e.clientX-initpos.x;
	var y = e.clientY-initpos.y;
	var rect = this.refs['this'].getBoundingClientRect();
	if(this.state.resize){
		x = x+this.state.width;
		y = y+(this.state.height || 0);
		if(this.state.minwidth > +x){x = this.state.minwidth;}
		if(this.state.minheight && this.state.minheight > +y){y = this.state.minheight;}
		if(x+rect.left > document.body.clientWidth){x=document.body.clientWidth-rect.left;}
		if(y+rect.top > document.body.clientHeight){y=document.body.clientHeight-rect.top;}
		this.setState({width: x, height: y, initialposition: {x: e.clientX, y: e.clientY}});
	} else {
		if(x < 0){x=0;} if(y < 0){y=0;}
		if(x+rect.width > document.body.clientWidth){x=document.body.clientWidth-rect.width;}
		if(y+rect.height > document.body.clientHeight){y=document.body.clientHeight-rect.height;}
		this.setState({x: x, y: y});
	}
};

var LoginModal = React.createClass({
	getInitialState: function(){
		return {loginmessage: 'Please input a username and password of at least 6 characters.'};
	},

	submission: function (e){
		var type = e.target.getAttribute('id');
		e.preventDefault();
		var that=this;
		var username = this.refs.username.value;
		var password = this.refs.password.value;
		if(username.length >= 6 && password.length >= 6){
			if(this.refs.Remember.checked){
				document.cookie = "username="+encodeURIComponent(username);
				document.cookie = "password="+encodeURIComponent(md5(password));
			}
			var ind = e.target.parentNode.getAttribute('id');

			this.props.socket.emit(type, username, md5(password), this.props.socketroom ? this.props.socketroom : false, function (response){
				if(response.settings){
					that.props.handleSettings(response.settings, response.characters);
					that.props.setUser(username, md5(password));
					that.props.closeModal(ind);
					reconnected = true;
				} else {
					that.setState({loginmessage: response.code || response});
				}
			});
		}
	},

	discon: function(e){
		e.preventDefault();
		var that=this;
		var username = this.refs.username.value;
		var password = this.refs.password.value;
		if(username.length >= 6 && password.length >= 6){
			this.props.socket.emit('disconnectall', username, md5(password), function(response){
				that.setState({loginmessage: response.code || response});
			});
		}
	},

	componentDidMount: function(){
		if(document.cookie && document.cookie.match(/[; ^]?username=([^\s;]*)/)){
			var c = document.cookie;
			var username = decodeURIComponent(c.match(/[; ^]?username=([^\s;]*)/)[1]);
			var password = decodeURIComponent(c.match(/[; ^]?password=([^\s;]*)/)[1]);
			this.refs.password.focus();
			var that=this;
			this.props.socket.emit('login', username, password, this.props.socketroom, function (response){
				if(response.settings){
					that.props.handleSettings(response.settings, response.characters);
					that.props.setUser(username, password);
					that.props.closeModal(that.refs.this.id);
					reconnected = true;
				} else {
					//failed, might be due to lingering cookie, so make sure they see this.
					that.refs.username.value = username;
					that.refs.password.value = password;
					that.setState({loginmessage: response.code || response});
				}
			});
		} else {
			this.refs.username.focus();
		}
	},

	enterCheck: function(e){
		if(e.keyCode == 13){
			if(e.target.name == 'password'){
				this.submission(e);
			} else if(e.target.value.length >= 6) {
				this.refs.password.focus();
			}
		}
	},

	render: function(){
		return(<div id={this.props.id} ref='this' className="modal" style={{textAlign:'center', height:'100%', width:'100%', paddingTop:'10px'}}>
				<input type="text" name="username" ref="username" placeholder="Username" onKeyDown={this.enterCheck}/><br/>
				<input id="login" type="text" name="password" ref="password" placeholder="Password" onKeyDown={this.enterCheck}/><br/>
				<input type="checkbox" name="Remember" ref="Remember" defaultChecked={false}/><b>Remember me</b><br/>
				<button type="submit" id="login" onClick={this.submission}>Login</button>
				{this.props.socketroom ? null : <button type="submit" id="register" onClick={this.submission}>Register</button>}<br/>
				<button type="submit" id="disconnect" onClick={this.discon}>Disconnect Other Instances</button><br/>
				<b>{this.state.loginmessage}</b><br/>
				<iframe src='/worldinfo' style={{width:'95%', height:'85%'}}/>
			</div>);
	}
});

var WarningModal = React.createClass({
	render: function(){
		return(<div id={this.props.id} className="modal" style={{left: '10%', top: '30%', textAlign:'center', height:'auto', width:'80%', backgroundColor: "rgb(50,50,50)"}}>
				<h1 style={{color: "red", fontSize: "300%"}}><b>WARNING</b></h1><br/>
				Beyond has detected that you are trying to connect from an unsupported browser. Due to shaky support for various HTML functionality and the nature of various 'modern' browsers, Beyond is only set up to support Firefox and Chrome. If you decide you wish to do this anyway, it is at your own risk.<br/>
					<br/>
				If this is a mobile browser in particular, I strongly advise you not to attempt to use Beyond this way, or at least not to report issues that occur when you do so. The only reason this works is because it is browser-based, and 'works' is being generous. This platform has little to no formal support for mobile, and doing so is next to impossible as most mobile browsers are wildly inconsistent about what they support.<br/><br/>
				<button type="submit" id="continue" onClick={this.props.closeModal.bind(null, this.props.id)}>I understand and wish to continue</button><br/>
			</div>);
	}
});

var CharacterModal = React.createClass({
	getInitialState: function(){
		return {x: '25%', y: '25%', width: 300, minwidth: 260, ids: []};
	},

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	handleFIs: function(e){
		var list = e.target.files;
		var img = [];
		for(var i=0; i<list.length; i++){
			if (list[i].type.match(/image.*/)) {
				img.push(window.URL.createObjectURL(list[i]));
			};
		}
		this.setState({images: img});
	},

	testFont: function(e){
		try{
			var d = new Detector();
			if(!e.target.value){
				e.target.style['outline-color'] = '#777'
			} else {
				if(d.detect(e.target.value)){
					e.target.style['outline-color'] = '#0f0';
					e.target.style.fontFamily = e.target.value;
				} else {
					e.target.style['outline-color'] = '#f00';
				}
			}
		} catch(err){
			e.target.style['outline-color'] = '#777';
		}
	},

	fontTest: function(e){
		if(e.ctrlKey && e.keyCode == 66){
			if(e.target.style.fontWeight == 'bold'){
				e.target.style.fontWeight = 'normal';
			} else {
				e.target.style.fontWeight = 'bold';
			}
			
		}
	},

	charEdit: function(e){
		var modal = e.target.parentNode;//the modal containing the save button
		var name = this.refs['name'].value;
		var icons = this.refs['faceicons'].children;
		if((name && this.props.modal.id.length === 1) || (name && icons.length) || (this.props.modal.id.length > 1 && (!this.state.ids.length || !icons.length || this.state.ids.length == icons.length))){//do nothing if they didn't put a name in if it's new
			var fontStyle = this.refs['font'].value;
			var nameColor = this.refs['nameColor'].value;
			var customHTML = this.refs['html'].value;
			var textHTML = this.refs['texthtml'].value;
			var color = this.refs['color'].value;
			var canvas;
			var convertedicons = [];
			var spritecanvas = document.createElement('canvas');
			var gridsize = Math.ceil(Math.sqrt(icons.length));//smallest fitting square
			spritecanvas.width=gridsize*50; spritecanvas.height=gridsize*50;
			var spritectx = spritecanvas.getContext('2d');
			var x, y;
			for(var i=0; i<icons.length; i++){
				var scale = 50/icons[i].naturalWidth;
				var canvas = downScaleImage(icons[i], scale);
				x = (i%gridsize)*50;
				y = Math.floor(i/gridsize)*50;//thought it'd default to integer, but...
				spritectx.drawImage(canvas, x, y, 50, 50);
				convertedicons.push({left: x, top: y});
			}
			var that=this;
			this.props.socket.emit('sendimage', spritecanvas.toDataURL("image/png"), function(picid, un){
				var toedit = that.state.ids;
				if(toedit){
					toedit = toedit.map(function(x){return +x.id});
					toedit.sort(function(a, b){return a-b});
				}
				var modata = that.props.modal;
				var settings = that.props.settings;
				var characters = that.props.characters;
				var character;
				var trueid = [];
				if(modata.id.length === 1){//new char only
					trueid[0] = that.refs['group'].value;
					trueid.push(characters[trueid[0]].length);//put it at the end of the group
					character = [];
				} else {//i1 is group, i2 is character
					trueid = that.props.verifyID(modata.charid, modata.id, modata.icpos);
					if(trueid){
						character = characters[trueid[0]][trueid[1]];
					}
				}
				if(modata.id[2]){//only in the single edit case (we have a deriv) do we NOT add.
					var deriv = character[trueid[2]];
					character[trueid[2]] = {id: deriv.id, name: name || deriv.name, icon: picid || deriv.icon, icpos: convertedicons[0] || deriv.icpos, nameColor: nameColor, color: color, fontStyle: fontStyle || deriv.fontStyle, customHTML: customHTML, textHTML: textHTML};
				} else if(modata.id.length === 2 && toedit.length){
					for(i=0; i<toedit.length; i++){
						var deriv = character[toedit[i]];
						character[toedit[i]] = {id: deriv.id, name: name || deriv.name, icon: picid || deriv.icon, icpos: convertedicons[i] || deriv.icpos, nameColor: nameColor, color: color, fontStyle: fontStyle || deriv.fontStyle, customHTML: customHTML, textHTML: textHTML};
					}
				} else {//but in the add derivatives case we use the 0-ID.
					var charid = character[0] ? character[0].id : un+'-'+settings.characterIDs++;
					for(i=0; i<convertedicons.length; i++){
						character.push({id: charid, name: name || character[0].name, icon: picid, icpos: convertedicons[i], nameColor: nameColor, color: color, fontStyle: fontStyle, customHTML: customHTML, textHTML: textHTML});
					}
					if(!convertedicons.length && modata.id.length === 1){
						character.push({id: charid, name: name || character[0].name, icon: 'img_trans', icpos: {left: 0, top: 0}, nameColor: nameColor, color: color, fontStyle: fontStyle, customHTML: customHTML, textHTML: textHTML});
					}
				}//now we've added all the new derivatives or just modified the one.
				characters[trueid[0]][trueid[1]] = character;//adds new if new, otherwise overwrites
				that.props.handleSettings(settings, characters);
				that.props.socket.emit('Update Character', character[0]);
				that.props.closeModal(that.props.id);
			});
		}
		
	},

	select: function(e){//grab a list of ids
		//switch back to trans when one is removed
		if(e.target.tagName == 'IMG' && !isNaN(e.target.id)){
			if(e.target.src.endsWith('/faceicons/img_trans.gif')){//unselected
				e.target.src = '/faceicons/box.png';
				var ids = this.state.ids;
				ids.push(e.target);
				this.setState({ids: ids});
			} else {//deselect (or invalid and needs fixing)
				e.target.src = '/faceicons/img_trans.gif';
				var ids = this.state.ids;
				ids.splice(ids.indexOf(e.target), 1);
				this.setState({ids: ids});
			}
		}
	},

	selectAll: function(){
		var res = [].slice.call(this.refs.img.children);
		res.forEach(function(element){
			element.src = '/faceicons/box.png';
		});
		this.setState({ids: res});
	},

	deselectAll: function(){
		var res = [].slice.call(this.refs.img.children);
		res.forEach(function(element){
			element.src = '/faceicons/img_trans.gif';
		});
		this.setState({ids: []});
	},

	deleteSelected: function(){
		var ids = this.state.ids;
		if(ids){
			ids = ids.map(function(x){return +x.id});
			ids.sort(function(a, b){return a-b}).reverse();
		}
		var ind = 0;
		var trueid;
		if(ids.length && ids.length != this.refs.img.children.length && this.refs.delsel.className == "Red Button"){//do not allow deleting every icon here, this kills the character.
			var modata = this.props.modal;//option only comes up in multi-edit case, so we're guaranteed to have length 2 here.
			var trueid = this.props.verifyID(modata.charid, modata.id, modata.icpos);
			var characters = this.props.characters.slice();
			for(ind; ind < ids.length; ind++){//array is already reversed, trueid is already handled earlier than this.
				characters[trueid[0]][trueid[1]].splice(ids[ind], 1);
			}
			this.deselectAll();
			this.props.handleSettings(this.props.settings, characters);
			this.refs.delsel.className = "";
		} else {
			this.refs.delsel.className = "Red Button";
		}
	},

	render: function(){
		var modal = this.props.modal;
		var groupdropdown = null;
		var derivatives;
		var sel;
		var FIs = (<input type='file' ref={'FIs'} style={{width:'100%',marginBottom:'1px'}} multiple onChange={this.handleFIs}/>);//by default it allows multiple
		var nameColor; var color; var fontStyle; var customHTML; var textHTML;
		var character;
		var trueid;
		var useid;
		var name;
		if(modal.id.length == 1){//new character
			nameColor = this.props.settings.textcolor || '#ffffff';
			color = this.props.settings.textcolor || '#ffffff';
			fontStyle = 'Times New Roman';
			customHTML = '';
			textHTML = '';
			var grouption = this.props.characters.map(function(group, ind){
				if(!ind){
					return (<option key={ind} value={ind}>None</option>);
				} else {
					return (<option key={ind} value={ind}>{group[0]}</option>);
				}
			});
			groupdropdown = (<select className="rooms" ref={'group'}>{grouption}</select>);
			name = modal.name;
		} else {
			trueid = this.props.verifyID(modal.charid, modal.id, modal.icpos);
			if(trueid){
				character = this.props.characters[trueid[0]][trueid[1]];
				useid = character[modal.useid] ? modal.useid : null;//do not attempt to use it if it doesn't exist for any reason.
				nameColor = character[useid || 0].nameColor;
				color = character[useid || 0].color;
				fontStyle = character[useid || 0].fontStyle;
				customHTML = character[useid || 0].customHTML;
				textHTML = character[useid || 0].textHTML;
				name = modal.name+' - '+character[0].name;
			} else {
				this.props.closeModal(this.props.id);
			}
		}
		if(modal.id.length == 2){//multi-edit
			derivatives = this.props.characters[trueid[0]][trueid[1]].map(function(deriv, i3){
				return(<img key={i3} id={i3} src='/faceicons/img_trans.gif' height='50px' width='50px' style={{backgroundImage: 'url(/faceicons/'+deriv.icon+'.png)', backgroundPosition: '-'+deriv.icpos.left+'px -'+deriv.icpos.top+'px'}}/>);});//grab the derivatives in here
			sel = (
				<div style={{background: 'none'}}>
					<button type="button" id="selectall" onClick={this.selectAll}>Select All</button>
					<button type="button" id="delectall" onClick={this.deselectAll}>Deselect All</button>
					<button ref={'delsel'} type="button" id="delectall" onClick={this.deleteSelected}>Delete Selected</button>
				</div>);
		}
		if(modal.id.length == 3){//only one FI allowed, as it's editing one derivative
			FIs = <input type='file' ref={'FIs'} style={{width:'100%', marginBottom:'1px'}} onChange={this.handleFIs}/>;
			color = character[trueid[2]].color || color;
			nameColor = character[trueid[2]].nameColor || nameColor;
			fontStyle = character[trueid[2]].fontStyle || fontStyle;
			customHTML = character[trueid[2]].customHTML || customHTML;
			textHTML = character[trueid[2]].textHTML || textHTML;
			name = modal.name+' - '+character[trueid[2]].name;
		}
		var previews = null;
		var im = this.state.images;
		if(im && im.length){
			previews = im.map(function(img, index){
				return(<img src={img} key={index} width='50px' height='50px'/>);
			});
		}
		var cname = this.props.isSelected ? "modal selectedmodal" : "modal";
		return(
			<div className={cname} ref="this" style={{left: this.state.x, top: this.state.y, width:this.state.width}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.props.selectModal.bind(null, this.props.id)}><span className="mtitle">{name}</span><br/>
			<div ref="img" onClick={this.select} style={{maxWidth:'100%', background: 'none'}}>{derivatives}</div>
			{sel}
			{FIs}<br/>
			<span ref={'faceicons'}>{previews}</span><br/>
			Name: <input type="text" className="char" ref={'name'} placeholder="Character Name" style={{marginBottom:'1px'}}/><br/>
			Name Color: <input type="color" className="char" ref={'nameColor'} defaultValue={nameColor}/><br/>
			Text Color: <input type="color" className="char" ref={'color'} defaultValue={color}/><br/>
			Font: <input type="text" className="char" ref={'font'} placeholder="Font Style" defaultValue={fontStyle} style={{fontFamily: fontStyle}} onChange={this.testFont} onKeyDown={this.fontTest}/><br/>
			Name HTML: <input type="text" className="char" ref={'html'} placeholder="Name HTML" defaultValue={customHTML} style={{marginBottom:'1px'}}/><br/>
			Text HTML: <input type="text" className="char" ref={'texthtml'} placeholder="Text HTML" defaultValue={textHTML} style={{marginBottom:'1px'}}/><br/>
			{groupdropdown ? 'Select a group: ' : ''}{groupdropdown}<br/>
			<button type="submit" id="save" onClick={this.charEdit}>Save</button>
				<button type="submit" id="cancel" onClick={this.props.closeModal.bind(null, this.props.id)}>Cancel</button><img src='/faceicons/handle.png' width='20px' height='20px' style={{position: 'absolute', right:0, bottom: 0, pointerEvents:'none'}}/></div>
		);
	}
});

/*var NarrateModal = React.createClass({
	getInitialState: function(){
		return {x: '25%', y: '25%'};
	},

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	render: function(){

	}
});*/

var FaviconModal = React.createClass({
	getInitialState: function(){
		return {x: '25%', y: '25%'};
	},

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	handleFavicons: function(e){
		var list = e.target.files;
		var img = [];
		//just make the first one the favicon and the second one the notice. Ignore the rest.
		if (list[0].type.match(/image.*/)) {
			img.push(window.URL.createObjectURL(list[0]));
		};
		if (list.length > 1 && list[1].type.match(/image.*/)) {
			img.push(window.URL.createObjectURL(list[1]));
		};
		this.setState({images: img});
	},

	saveFavicons: function(e){
		if(!this.refs.newfav){
			return;
		}
		var noticecontext = null;
		var canvas;
		var spritecanvas = document.createElement('canvas');
		spritecanvas.width=this.refs.newfav.naturalWidth; spritecanvas.height=this.refs.newfav.naturalWidth; //it better be square, at least.
		var spritectx = spritecanvas.getContext('2d');

		spritectx.drawImage(this.refs.newfav, 0, 0);
		var favicontext = spritecanvas.toDataURL("image/png");
		if(this.refs.newnot){
			spritecanvas.width=this.refs.newnot.naturalWidth; spritecanvas.height=this.refs.newnot.naturalWidth;
			spritectx.clearRect(0, 0, spritecanvas.width, spritecanvas.height);
			spritectx.drawImage(this.refs.newnot, 0, 0);
			noticecontext = spritecanvas.toDataURL("image/png");
		}
		this.props.socket.emit('savefavicon', favicontext, noticecontext);
		this.props.closeModal(this.props.id);
	},

	render: function(){
		var modal = this.props.modal;
		var current = [<span key={0} id={0}>Current Favicon: <img src='/faceicons/favicon.png' height='16px' width='16px'/><br/></span>, <span key={1} id={1}>Current Notice: &nbsp;&nbsp;<img src='/faceicons/notice.png' height='16px' width='16px'/></span>];
		var newicons = [<span key={0} id={0}>Current Favicon: <br/></span>, <span key={1} id={1}>Current Notice: &nbsp;&nbsp;</span>];
		var im = this.state.images;
		if(im && im.length){
			newicons = [<span key={0} id={0}>New Favicon: <img ref="newfav" src={im[0]} height='16px' width='16px'/><br/></span>];
			if(im.length == 2){
				newicons.push(<span key={1} id={1}>New Notice: &nbsp;&nbsp;<img ref="newnot" src={im[1]} height='16px' width='16px'/></span>);
			}
		}
		var cname = this.props.isSelected ? "modal selectedmodal" : "modal";
		return(
			<div className={cname} ref="this" style={{left: this.state.x, top: this.state.y, width: '200px'}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.props.selectModal.bind(null, this.props.id)}><span className="mtitle">{modal.name}</span><br/>
			<div ref="img" style={{maxWidth:'100%', background: 'none'}}>{current}</div>
			<input type='file' ref={'FIs'} style={{width:'100%',marginBottom:'1px'}} multiple onChange={this.handleFavicons}/>
			<span ref={'previews'}>{newicons}</span><br/>
			<button type="submit" id="save" onClick={this.saveFavicons}>Save</button>
				<button type="submit" id="cancel" onClick={this.props.closeModal.bind(null, this.props.id)}>Cancel</button>
			</div>
		);
	}
});

var GroupModal = React.createClass({
	getInitialState: function(){
		return {x: '25%', y: '25%', height: document.body.clientHeight/3, minheight: 90, selected: null};
	},

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	groupEdit: function(e){
		var modal = e.target.parentNode;//the modal containing the save button
		var name = this.refs['name'].value;
		if(name){
			var modata = this.props.modal;
			var characters = this.props.characters.slice();
			var checks = [].slice.call(this.refs['chars'].children);
			if(!modata.name.startsWith('Edit') || (characters[modata.id[0]] && modata.groupname == characters[modata.id[0]][0])){//the name hasn't changed
				var group = modata.name.startsWith('Edit') ? characters[modata.id[0]] : [];
				group[0] = name;
				//move the selected characters
				var n = [];
				checks.forEach(function(chr, index){
					if(chr.style.fontWeight == 'bold'){//selected
						group.push(characters[0][index]);
					} else {//not selected
						n.push(characters[0][index]);
					}
				});
				characters[0] = n;//can't exactly slice them out with varying indices.
				if(modata.name.startsWith('Edit')){
					characters[modata.id[0]] = group;
				} else {
					characters.push(group);//add to end of groups
				}
				this.props.handleSettings(this.props.settings, characters);
			}
			this.props.closeModal(this.props.id);
		}
	},

	acommand: function(e){
		if(this.state.selected){
			this.props.socket.emit('AdminCommand', this.props.modal.name, this.state.selected.textContent);
			this.props.closeModal(this.props.id);
		}
	},

	entrySelect: function(e){
		e.target.style.fontWeight = (e.target.style.fontWeight=='bold') ? 'normal' : 'bold';
	},

	entrySwitch: function(e){// only allow one selection
		e.target.style.fontWeight = 'bold';
		if(this.state.selected){
			this.state.selected.style.fontWeight = 'normal';
			if(e.target.textContent == this.state.selected.textContent){//unselect
				this.setState({selected: null});
				return;
			}
		}
		this.setState({selected: e.target});
	},

	render: function(){
		var modal = this.props.modal;
		var fun = this.groupEdit;
		var prompt = 'Add characters to the group?';
		var placeholder = 'Group Name';
		var that = this;
		if(!this.props.characters){
			var filtername = this.refs['name'] ? this.refs['name'].value : '';
			fun = this.acommand;
			prompt = 'Select who to '+modal.name+'.';
			placeholder = 'Filter';
			var chars = modal.accounts.map(function(ch, index){
				if(!filtername || ch.toLowerCase().startsWith(filtername.toLowerCase())){
					return(<div key={'c'+index} style={{float: 'none', fontWeight: (that.state.selected&&that.state.selected.textContent==ch)?'bold':'normal'}} className='Command' onClick={that.entrySwitch}>{ch}</div>);
				} else {
					return null;
				}
			})
		} else {
			var chars = this.props.characters[0].map(function(ch, index){
				return(<div key={'c'+index} style={{float: 'none'}} className='Command' onClick={that.entrySelect}>{ch[0].name}</div>);
			});//go through the ungrouped characters.
		}
		var def = '';
		var name = modal.name;
		if(modal.id[0] > 0){def = this.props.characters[modal.id[0]][0]; name += ' - '+def;}
		var cname = this.props.isSelected ? "modal selectedmodal" : "modal";
		return(<div ref="this" className={cname} style={{left: this.state.x, top: this.state.y, height: this.state.height}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.props.selectModal.bind(null, this.props.id)}><span className="mtitle">{name}</span><br/>
			<input type='text' ref={'name'} placeholder={placeholder} defaultValue={def} style={{width:'100%'}}/><br/>
			{prompt}<br/>
			<form ref={"chars"} style={{overflowY: 'scroll', height: this.state.height-90}}>
			{chars}
			</form>
			<button type="submit" id="save" onClick={fun}>Save</button>
				<button type="submit" id="cancel" onClick={this.props.closeModal.bind(null, this.props.id)}>Cancel</button>
			</div>);
	}
});

var DeleteModal = React.createClass({
	getInitialState: function(){
		return {x: '25%', y: '25%'};
	},

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	charDelete: function(e){
		var modal = e.target.parentNode;
		var modata = this.props.modal;
		var trueid;
		//modata.id contains the ids involved.
		var characters = this.props.characters.slice();
		if(modata.id.length === 1){//group delete
			if((characters[modata.id[0]] && modata.groupname == characters[modata.id[0]][0])){//the name hasn't changed
				var salvage = characters.splice(modata.id[0], 1)[0];
				salvage.shift();//remove the name
				salvage.forEach(function(slv){
					characters[0].push(slv);
				});//add the characters to the ungrouped section.
			}
		} else if(modata.id.length === 2 || characters[modata.id[0]][modata.id[1]].length == 1){//character delete
			trueid = this.props.verifyID(modata.charid, modata.id, modata.icpos);
			if(trueid){
				characters[trueid[0]].splice(trueid[1], 1);
			}
			//tell it to delete the profile too.
			this.props.socket.emit('Delete Profile', modata.charid);
		} else {
			trueid = this.props.verifyID(modata.charid, modata.id, modata.icpos);
			if(trueid){
				characters[trueid[0]][trueid[1]].splice(trueid[2], 1);
			}
		}
		this.props.handleSettings(this.props.settings, characters);
		this.props.closeModal(this.props.id);
	},

	postDelete: function(e){
		this.props.socket.emit('Delete Post', this.props.modal.id, this.props.modal.room);
		this.props.closeModal(this.props.id);
	},

	clearBox: function(e){
		this.props.modal.cb(e);
		this.props.closeModal(this.props.id);
	},

	adminProfileDelete: function(e){
		this.props.socket.emit('Delete Profile', this.props.modal.charid);
		this.props.closeModal(this.props.id);
	},

	render: function(){
		var modal = this.props.modal;
		var name = modal.name;
		var fun = this.charDelete;
		if(modal.groupname){name += ' - '+modal.groupname;
		} else if(modal.charid){
			if(modal.charname){
				name+=' - '+modal.charname;
			} else {
				var trueid = this.props.verifyID(modal.charid, modal.id, modal.icpos);
				if(trueid){name+=' - '+this.props.characters[trueid[0]][trueid[1]][(trueid[2] || 0)].name;} else {this.props.closeModal(this.props.id);}
			}
		} else if(modal.name == "Delete Post"){
			fun = this.postDelete;
		} else if (modal.name.startsWith("Clear")){
			fun = this.clearBox;
		}
		if (modal.name.startsWith("Delete Profile")){
			fun = this.adminProfileDelete;
		}
		var cname = this.props.isSelected ? "modal selectedmodal" : "modal";
		return(
			<div ref="this" className={cname} style={{left: this.state.x, top: this.state.y}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.props.selectModal.bind(null, this.props.id)}><span className="mtitle">{name}</span><br/>
			Are you sure?<br/><button type="submit" onClick={fun}>Yes</button><button type="submit" onClick={this.props.closeModal.bind(null, this.props.id)}>No</button></div>
		);
	}
});

var ActionModal = React.createClass({
	getInitialState: function(){
		var width = 300;
		return {x: '25%', y: '25%', width: width, minwidth: 140, height: 'auto', wait: false};
	},

	componentDidMount: function(){
		var y = '25%';
		var w = 300;
		var def = this.refs['this'].getBoundingClientRect().height;//initial minimum box size
		var h = def-this.refs['text'].getBoundingClientRect().height;//initial size of non-textarea content
		this.refs['text'].style.height = 'calc(100% - '+h+'px)';
		h += this.refs['text'].scrollHeight+2;
		//if scrollheight is over 50% of the client height, make it increase width too.
		if(h > document.body.clientHeight/2){
			w = this.state.width*2;
		}
		if(h > document.body.clientHeight*0.75){//cannot fit without moving it upward.
			h = document.body.clientHeight*0.6;
			w = document.body.clientWidth*0.6;
		}
		this.setState({height: h, minheight: def, width: w});
	},

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	enterCheck: function(e){
		if(e.keyCode == 13 && !e.shiftKey && !this.refs.toggle.checked){//hit enter without shift or toggle check.
			this.post(e);
		} else if(this.refs.Cancel.className == "Red Button"){//no need to test this if we're about to close it.
			this.refs.Cancel.className = "";
			this.refs.text.style['border-color'] = '';
			this.refs.text.style['outline-color'] = '';
		} else if(this.refs.Send.className == "Red Button"){
			this.refs.Send.className = "";
			this.refs.text.style['border-color'] = '';
			this.refs.text.style['outline-color'] = '';
		}
	},

	preview: function(){
		var frame = "<body style='margin: 0'><iframe width='100%' height='100%' src='data:text/html," + encodeURIComponent(this.refs['text'].value.replace(/\r\n?|\n(?!([^<]+)?(<\/style>|<\/script>))/g, "<br />")).replace(/'/g,"%27") + "'></iframe></body>";
		var myw = window.open();
		myw.document.open();
		myw.document.write(frame);
		myw.document.close();
	},

	post: function(e){
		e.preventDefault();
		var modal = e.target.parentNode;
		var modata = this.props.modal;
		var post = this.refs['text'].value;
		var room = this.refs['roomlist'] && this.refs['roomlist'].value != 'None' ? this.refs['roomlist'].value : null;
		if(post && !this.state.wait){
			if(modata.name.startsWith('Show')){
				return;
			}
			if(modata.name == 'Edit'){
				if(modata.post != post){
					this.props.socket.emit('ICedit', post, modata.id, modata.room);
				}
			} else if(modata.name == 'Whisper'){
				this.props.socket.emit('Whisper', post, modata.id, modata.data);
			} else if(modata.name == 'Narrate'){
				var that = this;
				var to = setTimeout(this.unWait, 1000);
				this.props.socket.emit('Narrate', post, this.props.settings.textcolor, room, function(muted){
					if(!muted) {
						clearTimeout(to);
						that.props.closeModal(that.props.id);
					}
				});
				this.setState({wait: true});
				return;
			} else if(modata.name == 'Persistent Narrate'){
				var that = this;
				this.props.socket.emit('Narrate', post, this.props.settings.textcolor, room, function(muted){
					if(!muted) {
						that.refs['text'].value = '';
					}
				});
				this.setState({wait: true});
				setTimeout(this.unWait, 1000);
				return;
			} else if(['Edit Rules', 'Edit MOTD', 'Edit Default Profile', 'Edit World Info', 'Edit Title'].indexOf(modata.name) > -1){
				this.props.socket.emit(modata.name, post);
			} else if(modata.name == 'CleanLogs'){
				if(Number.isNaN(post)){
					return;
				} else if(post > 8 && this.refs.Send.className != "Red Button"){//safety check: a quick 'are you sure' to prevent people from accidentally deleting everything by mistyping a huge number.
					this.refs.Send.className = "Red Button";
					this.refs.text.style['border-color'] = 'red';
					this.refs.text.style['outline-color'] = 'red';
					return;
				}
				this.props.socket.emit('AdminCommand', modata.name, post);
			} else if(modata.name == 'Set Profile'){
				this.props.socket.emit(modata.name, post, modata.charid);
				return;
			} else if (modata.name == 'Input full Discord ID#'){
				this.props.socket.emit('AdminCommand', 'SetPublic', post);
			} else {//find the right id
				var trueid = this.props.verifyID(modata.charid, modata.id, modata.icpos);
				if(trueid){
					var deriv = this.props.characters[trueid[0]][trueid[1]][trueid[2]];
					var that = this;
					var to = setTimeout(this.unWait, 1000);
					this.props.socket.emit('characterPost', post, deriv, modata.name, room, function(muted){
						if(!muted) {
							clearTimeout(to);
							that.props.closeModal(that.props.id);
						}
					});
					this.setState({wait: true});
					return;
				}
			}
		}
		if(!this.state.wait && !(modata.name == 'Persistent Narrate')){//if it's in a wait loop or is persistent, preserve the modal.
			this.props.closeModal(this.props.id);
		}
	},

	unWait: function(){
		this.setState({wait: false});
	},

	closeCheck: function(){
		if(this.refs['text'].value && this.refs.Cancel.className != "Red Button"){
			this.refs.Cancel.className = "Red Button";
			this.refs.text.style['border-color'] = 'red';
			this.refs.text.style['outline-color'] = 'red';
		} else {
			this.props.closeModal(this.props.id);
		}
	},

	render: function(){
		var roomable = ['Narrate', 'Persistent Narrate', 'Say', 'Action', 'Unnamed Action', 'Omit Say', 'Omit Action', 'Unnamed Omit Action'];
		var modal = this.props.modal;
		var name = modal.name;
		var previewButton = (['Set Profile', 'Edit World Info'].indexOf(this.props.modal.name) > -1) ? <button type="submit" onClick={this.preview}>Preview</button> : null;
		if(modal.charid){
			if(modal.charname){
				name+=' - '+modal.charname;
			} else {
				var trueid = this.props.verifyID(modal.charid, modal.id, modal.icpos);
				if(trueid){name+=' - '+this.props.characters[trueid[0]][trueid[1]][(trueid[2] || 0)].name;} else {this.props.closeModal(this.props.id);}
			}
		} else if(modal.name == 'Whisper') {
			name+=' - '+modal.id;
		}
		var dropdown = null;
		if(!this.props.socketroom && roomable.indexOf(this.props.modal.name) > -1 && Object.keys(this.props.settings.rooms).length){
			var options = [<option key={0}>None</option>];
			var ind = 1;
			Object.keys(this.props.settings.rooms).forEach(function(roomname){
				options.push(<option key={ind}>{roomname}</option>);
				ind++;
			});
			dropdown = (<select className="room" ref={'roomlist'} style={{whiteSpace: 'nowrap'}}>{options}</select>);
		}
		var cname = this.props.isSelected ? "modal selectedmodal" : "modal";
		return(
			<div ref="this" className={cname} style={{left: this.state.x, top: this.state.y, width: this.state.width, height: this.state.height}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.props.selectModal.bind(null, this.props.id)}><span className="mtitle">{name}</span>{dropdown}<br/>
			<textarea defaultValue={modal.post || ''} autoFocus style={{resize: 'none', width:'100%', height:'auto'}} ref={'text'} onKeyDown={this.enterCheck}></textarea><br/>
			<button ref='Send' type="submit" onClick={this.post}>OK</button><button ref='Cancel' onClick={this.closeCheck}>{this.props.modal.name == 'Set Profile' ? 'Close' : 'Cancel'}</button><input title="Check this to disable sending messages on Enter." type="checkbox" ref="toggle" defaultChecked={this.props.settings.echeck || false}/><img src='/faceicons/handle.png' width='20px' height='20px' style={{position: 'absolute', right:0, bottom: 0, pointerEvents:'none'}}/> {previewButton}</div>
		);
	}
});

var ActiveModal = React.createClass({
	getInitialState: function(){
		return {x: '25%', y: '25%', width: 217, minwidth: 217, height: 'auto', scrollheight: 100, scroll: false, wait: false, min: false, post: this.props.modal.post, pt: this.props.modal.pt || 'Action', win: 'IC', rooml: 'None'};
	},

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	enterCheck: function(e){
		if(this.refs.Close.className == "Red Button"){
			this.refs.Close.className = "";
			this.refs.text.style['border-color'] = '';
			this.refs.text.style['outline-color'] = '';
		}
		if(e.keyCode == 13 && !e.shiftKey && !this.refs.toggle.checked){//hit enter
			this.post(e);
		}
	},

	post: function(e){
		e.preventDefault();
		var modal = e.target.parentNode;
		var modata = this.props.modal;
		var post = this.refs['text'].value;
		var name = this.refs['type'].textContent;
		var win = this.refs['win'].textContent;
		var deriv = null;
		var un = false;
		var room = this.refs['roomlist'] && this.refs['roomlist'].value != 'None' ? this.refs['roomlist'].value : null;
		if(win != 'IC'){
			if(name == 'Unnamed'){
				name = 'Unnamed '+win+' Action';//omit or test
			} else {
				name = win+' '+name;
			}
		} else if(name == 'Unnamed') {
			name = 'Unnamed Action';//IC action.
		}
		if(post && this.state.id && !this.state.wait){//find the right id
			var did = this.state.id.id;
			var trueid = this.props.verifyID(modata.charid, modata.id, modata.icpos);
			if(trueid){
				deriv = this.props.characters[trueid[0]][trueid[1]][did];
				if(modata.name != 'Full Edit'){
					var that = this;
					this.props.socket.emit('characterPost', post, deriv, name, room, function(muted){
						if(win != 'Test' && !muted){
							that.refs['text'].value = ''; //just empty it.
						}
					});
					this.setState({wait: true});
					setTimeout(this.unWait, 1000);
				}
			}//if it's undefined the character doesn't exist.
		}
		if(post && modata.name == 'Full Edit'){//if there IS a trueid we have it by this point, else it should default to previous.
			this.props.socket.emit('Cedit', post, deriv, name, modata.id, modata.room);
			this.props.closeModal(this.props.id);
		}
	},

	unWait: function(){
		this.setState({wait: false});
	},

	select: function(e){
		if(e.target.tagName == 'IMG'){
			if(this.state.id){this.state.id.src = '/faceicons/img_trans.gif';}
			e.target.src='/faceicons/box.png';
			this.setState({id: e.target});//we grab the id later to determine the derivative, hopefully.
		}
	},

	toggle: function(e){
		switch(e.target.textContent){
			case 'IC':
				if(this.props.modal.name != "Full Edit"){
					e.target.textContent = 'Omit';
				}
				break;
			case 'Omit':
				e.target.textContent = 'Test';
				break;
			case 'Test':
				e.target.textContent = 'IC';
				break;
			case 'Action':
				e.target.textContent = 'Say';
				break;
			case 'Say':
				e.target.textContent = 'Unnamed';
				break;
			case 'Unnamed':
				e.target.textContent = 'Action';
				break;
		}
	},

	componentDidMount: function(){
		if(ReactDOM.findDOMNode(this).getBoundingClientRect().bottom > document.body.clientHeight){
			this.mode();
		}
		var w = 217;
		var def = this.refs['this'].getBoundingClientRect().height;
		var h = def-this.refs['text'].getBoundingClientRect().height+this.refs['text'].scrollHeight+2;
		if(h > document.body.clientHeight*0.75){//cannot fit without moving it upward.
			h = document.body.clientHeight*0.6;
			w = document.body.clientWidth*0.6;
		}
		var unc = def - this.refs['img'].getBoundingClientRect().height - 34;
		this.setState({width: w, height: h, unc: unc, minheight: unc+100+34});
	},

	mode: function(){
		if(this.refs['scrollb'].textContent == 'Scroll'){
			this.refs['scrollb'].textContent = 'Default';
			this.refs['img'].style.height = this.state.scrollheight;
			this.refs['img'].style['overflow-y'] = 'scroll';
			this.setState({scroll: true});
		} else {
			this.refs['scrollb'].textContent = 'Scroll';
			this.refs['img'].style.height = '';
			this.refs['img'].style['overflow-y'] = 'auto';
			this.setState({scroll: false});
		}
	},

	componentDidUpdate: function(prevProps, prevState){
		if(!this.state.min){
			if(this.state.id){
				var trueid = this.props.verifyID(this.props.modal.charid, this.props.modal.id, null);
				var deriv = this.props.characters[trueid[0]][trueid[1]][this.state.id.id];
				if(deriv){
					this.refs['prev'].style.fontFamily = deriv.fontStyle;
					this.refs['prev'].style.color = deriv.nameColor;
					if(deriv.customHTML){
						this.refs['prev'].innerHTML = deriv.customHTML;
					} else {
						this.refs['prev'].textContent = deriv.name;
					}
				}
			}//img must always exist by this point or we're in an invalid state.
			if(this.refs['img'].childElementCount === 1 && !this.state.id){//exactly one derivative
				this.setState({id: this.refs['img'].childNodes[0]});
			}
			var h = this.state.unc + this.refs['img'].getBoundingClientRect().height + 34;
			if(this.state.height < h){//prevents height from going below a certain point.
				this.setState({height: h});
			}
			if(prevState.min){//was minimized last update.
				this.forceUpdate();
				if(this.state.scroll){
					this.refs['scrollb'].textContent = 'Default';
					this.refs['img'].style.height = this.state.scrollheight;
					this.refs['img'].style['overflow-y'] = 'scroll';
				}
				this.refs.text.focus();
			}
		}
	},

	focus: function(e){
		if(e.target.className != 'room'){//messes up the dropdown otherwise.
			this.refs.text.focus();
			this.props.selectModal(this.props.id);
		}
	},

	minimize: function(){
		if(!this.state.min){
			var room = this.refs['roomlist'] ? this.refs['roomlist'].value : 'None';
			this.setState({min: !this.state.min, post: this.refs['text'].value, pt: this.refs['type'].textContent, win: this.refs['win'].textContent, rooml: room});
		} else {
			this.setState({min: false});
		}
	},

	closeCheck: function(){
		if(this.refs['text'].value && this.refs.Close.className != "Red Button"){
			this.refs.Close.className = "Red Button";
			this.refs.text.style['border-color'] = 'red';
			this.refs.text.style['outline-color'] = 'red';
		} else {
			this.props.closeModal(this.props.id);
		}
	},

	plus: function(){
		var y = this.state.scrollheight + 50;
		//make sure this isn't too large to fit
		var rect = this.refs['this'].getBoundingClientRect();
		if(50+rect.bottom > document.body.clientHeight){return;}
		this.refs['img'].style.height = y;
		this.setState({scrollheight: y, height: this.state.height+50});
	},

	minus: function(){
		var y = this.state.scrollheight - 50;
		if(y < 50){return;}
		this.refs['img'].style.height = y;
		this.setState({scrollheight: y, height: this.state.height-50});
	},

	render: function(){
		var hei='auto';
		var imgheight = '';
		var pm;
		var cname = this.props.isSelected ? "modal selectedmodal" : "modal";
		if(this.refs['img']){
			hei = 'calc(100% - '+(this.refs['img'].getBoundingClientRect().height+this.state.unc)+'px)';
			if(this.refs['img'].style['overflow-y'] == 'scroll'){
				imgheight = this.state.scrollheight;
				pm = (<span style={{position: 'absolute', right:0, cursor: "default"}}><button className="Green Button" onClick={this.plus} style={{height: '18px', width: '21px'}}>+</button><button className="Red Button" onClick={this.minus} style={{height: '18px', width: '21px'}}>-</button></span>);
			}
		}
		var modal = this.props.modal;
		var name = 'Active Character';
		var trueid = this.props.verifyID(modal.charid, modal.id, modal.icpos);
		if(modal.charid){
			if(trueid){name+=' - '+this.props.characters[trueid[0]][trueid[1]][(trueid[2] || 0)].name;} else {this.props.closeModal(this.props.id);}
		}
		if(this.state.min){
		return(
			<div ref="this" className={cname} style={{left: this.state.x, top: this.state.y, width: this.state.width}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.props.selectModal.bind(null, this.props.id)}><span className="mtitle">{name}</span><span onClick={this.minimize} style={{position: 'absolute', right:0, top: 0, cursor: "default"}}>[+]</span></div>
		);
		} else {
		var that = this;
		var images = this.props.characters[trueid[0]][trueid[1]].map(function(deriv, i3){
			if(that.state.id && i3 == that.state.id.id){
				return(<img key={i3} id={i3} src='/faceicons/box.png' height='50px' width='50px' style={{backgroundImage: 'url(/faceicons/'+deriv.icon+'.png)', backgroundPosition: '-'+deriv.icpos.left+'px -'+deriv.icpos.top+'px'}}/>);
			} else {
				return(<img key={i3} id={i3} src='/faceicons/img_trans.gif' height='50px' width='50px' style={{backgroundImage: 'url(/faceicons/'+deriv.icon+'.png)', backgroundPosition: '-'+deriv.icpos.left+'px -'+deriv.icpos.top+'px'}}/>);
			}
		});//grab the derivatives in here
		var dropdown = null;
		if(!this.props.socketroom && this.props.modal.name != 'Full Edit' > -1 && Object.keys(this.props.settings.rooms).length){
			var options = [<option key={0}>None</option>];
			var ind = 1;
			Object.keys(this.props.settings.rooms).forEach(function(roomname){
				options.push(<option key={ind}>{roomname}</option>);
				ind++;
			});
			dropdown = (<select className="room" defaultValue={this.state.rooml} ref={'roomlist'} style={{whiteSpace: 'nowrap', right: 18}} onClick={null}>{options}</select>);
		}
		return(
			<div ref="this" className={cname} style={{left: this.state.x, top: this.state.y, width: this.state.width, height: this.state.height}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.focus}><span className="mtitle">{name}</span>{dropdown}<span onClick={this.minimize} style={{position: 'absolute', right:0, top: 0, cursor: "default"}}>[-]</span><br/>
			<div ref="img" onClick={this.select} style={{height: imgheight, maxWidth:'100%', background: 'none'}}>{images}</div><br/>
			<div style={{width: '100%', whiteSpace: 'nowrap', background:'none'}}><span ref="prev" className="mtitle" style={{fontWeight: 'bold', width:'auto', padding: '2px 5px 0px 0px', background: 'none'}}/><span ref='win' style={{width:'auto', paddingRight: '5px', background: 'none'}} className='Command' onClick={this.toggle}>{this.state.win}</span><span ref='type' style={{width:'auto', background: 'none'}} className='Command' onClick={this.toggle}>{this.state.pt}</span>{pm}</div><br/>
			<textarea defaultValue={this.state.post || ''} autoFocus style={{resize: 'none', width:'100%', height:hei, minHeight:32}} ref={'text'} onKeyDown={this.enterCheck}></textarea><br/>
			<button type="submit" onClick={this.post}>OK</button><button ref="Close" onClick={this.closeCheck}>Close</button><button ref='scrollb' type="submit" onClick={this.mode}>Scroll</button><input title="Check this to disable sending messages on Enter." type="checkbox" ref="toggle" defaultChecked={this.props.settings.echeck || false}/><img src='/faceicons/handle.png' width='20px' height='20px' style={{position: 'absolute', right:0, bottom: 0, pointerEvents:'none'}}/></div>
		);
		}
	}
});

var NotificationModal = React.createClass({
	getInitialState: function(){
		var not = [{name: '', OOC: false, IC: false}];
		var list = null;
		if(this.props.modal.name == 'Set Notifications' && this.props.settings.notify){//notify is an object with usernames mapped to objects with OOC and IC
			list = this.props.settings.notify;
		} else if(this.props.modal.name == 'Set Rooms' && Object.getOwnPropertyNames(this.props.settings.rooms).length) {//rooms are too, now.
			if(this.props.settings.rooms[Object.keys(this.props.settings.rooms)[0]][0]){//any old lingering rooms, which were arrays, must be purged.
				this.props.settings.rooms = {};
			} else {//we test this by seeing if the room key has anything in it besides OOC and IC, by checking the first index of its array.
				list = this.props.settings.rooms;
			}
		}
		if(list){
			not = Object.keys(list).map(function(entry){
				return {name: entry, OOC: list[entry].OOC, IC: list[entry].IC};
			});
		}
		return {x: '25%', y: '25%', notify: not.slice()};//not an anti-pattern for this use case.
	},//We don't WANT it to update with the props, we want it to have its own set for editing.

	startDrag: startDrag,

	drag: drag,

	stopDrag: stopDrag,

	remove: function(e){
		var id = e.target.parentNode.id;
		this.state.notify.splice(id, 1);
		this.setState({notify: this.state.notify});
	},

	increment: function(e){
		this.state.notify.push({name: '', OOC: false, IC: false});
		this.setState({notify: this.state.notify});
	},

	test: function(e){
		var id = e.target.parentNode.id;
		if(e.target.type == 'radio'){
			if(e.target.id == 'Both'){
				this.state.notify[id].IC = true;
				this.state.notify[id].OOC = true;
			} else {
				var t = (e.target.id == 'IC');
				this.state.notify[id].IC = t;
				this.state.notify[id].OOC = !t;
			}
		} else {
			this.state.notify[id].name = e.target.value;
		}
		this.setState({notify: this.state.notify});
	},

	save: function(e){
		var ret = {};
		this.state.notify.forEach(function(note){
			if(note.OOC || note.IC){//only valid ones
				ret[note.name] = {OOC: note.OOC, IC: note.IC};
			}
		});
		if(this.props.modal.name == 'Set Notifications'){
			this.props.settings.notify = ret;
			this.props.handleSettings(this.props.settings, this.props.characters);
		} else if(this.props.modal.name == 'Set Rooms') {
			this.props.socket.emit('Set Rooms', Object.keys(ret), Object.keys(this.props.settings.rooms));
			this.props.settings.rooms = ret;
			this.props.handleSettings(this.props.settings, this.props.characters);
		}
		this.props.closeModal(this.props.id);
	},

	render: function(){
		var notify = this.state.notify;
		var name = this.props.modal.name;
		var that = this;
		var listitems = notify.map(function(note, i){//TODO: Switch the div to have the onChange handler when you go into production and the warning stops being there.
			return(<div key={i} id={i}><input style={{width:'172px'}} type="text" ref={'name'+i} id={i} value={note.name} onChange={that.test}/><input type="radio" checked={note.IC && !note.OOC} id="IC" onChange={that.test}/>IC<input type="radio" checked={note.OOC && !note.IC} id="OOC" onChange={that.test}/>OOC<input type="radio" checked={note.IC && note.OOC} id="Both" onChange={that.test}/>Both <button style={{width:'30px'}} className="Red Button" type="button" onClick={that.remove}>X</button></div>);
		});
		var cname = this.props.isSelected ? "modal selectedmodal" : "modal";
		return(
			<div ref="this" className={cname} style={{width:'350px', left: this.state.x, top: this.state.y}} onMouseDown={this.startDrag} onTouchStart={this.startDrag} onClick={this.props.selectModal.bind(null, this.props.id)}><span className="mtitle">{name}</span><br/>{listitems}<br/>
			<button type="button" className="Green Button" style={{width: '100%'}} onClick={this.increment}>+</button><br/>
			<button type="button" onClick={this.save}>Save</button><button type="button" onClick={this.props.closeModal.bind(null, this.props.id)}>Cancel</button></div>
			);
	}
});

var ChartabHandler = React.createClass({
	getInitialState: function(){//open.characters[ID] will be true if we need to open derivs
		return {tab: 'characters', open:{groups: {}, characters: {}, players: {}}};
	},

	shiftTab: function(e){//It's both a relevant name and a terrible pun!
		this.setState({tab: e.target.getAttribute('id')});
	},

	toggleGroup: function(e){
		e.stopPropagation();
		var op = this.state.open;
		var name = this.props.characters[e.target.getAttribute('id')][0];
		op.groups[name] = !op.groups[name];//works even on undefined!
		this.setState({open: op});
	},

	toggleChar: function(e){
		e.stopPropagation();//make sure it doesn't try to close the group
		var id = e.target.getAttribute('id').split(',');
		var op = this.state.open;
		var name = this.props.characters[id[0]][id[1]][0].id;//characters[0][2][0] for instance.
		op.characters[name] = !op.characters[name];
		this.setState({open: op});
	},

	togglePlayer: function(e){
		e.stopPropagation();
		var id = e.target.getAttribute('id');
		var op = this.state.open;
		op.players[id] = !op.players[id];
		this.setState({open: op});
	},

	setColor: function(e){
		var settings = this.props.settings;
		settings.textcolor = this.refs.OOCcolor.value;
		this.props.handleSettings(settings, this.props.characters);
	},

	toggleecheck: function(e){
		var settings = this.props.settings;
		settings.echeck = !settings.echeck;//works even if completely unset.
		this.props.handleSettings(settings, this.props.characters);
	},

	togglembut: function(e){
		var settings = this.props.settings;
		settings.buttons = !settings.buttons;//works even if completely unset.
		this.props.handleSettings(settings, this.props.characters);
	},
	
	toggleHideIcons: function(e) {
		var settings = this.props.settings;
		settings.hideIcons = !settings.hideIcons;//works even if completely unset
		this.props.handleSettings(settings, this.props.characters);
	},

	togglesetting: function(e){
		var settings = this.props.settings;
		var cmd = e.target.textContent;
		var setting;
		if(cmd.startsWith('Enter Checkbox')){
			setting = 'echeck';
		} else if(cmd.startsWith('Menu Buttons')){
			setting = 'buttons';
		} else if(cmd.startsWith('Compact Characters')){
			setting = 'compchar';
		} else if(cmd.startsWith('Listed Icons')){
			setting = 'showfi';
		} else if(cmd.startsWith('IC/OOC Icons')) {
			setting = 'hideIcons';
		}
		if(setting){
			settings[setting] = !settings[setting];//works even if completely unset.
			this.props.handleSettings(settings, this.props.characters);
		}
	},

	genmodal: function(e){
		var name = e.target.textContent;
		var type = name.split(' '); type = type[type.length-1];
		var that = this;
		if(name == "Clean Logs"){
			this.props.modalpush({id: [], name: 'CleanLogs', type: 'action'});
		} else if(['Rules', 'MOTD', 'Profile', 'Info', 'Logs'].indexOf(type) > -1){//acquire the setting from the server so it can be edited
			var res = function(response){
				if(response){response = sanitize(response);}
				that.props.modalpush({id: [], name: name, type: 'action', post: response});
			};
			if(type == 'Profile'){
				this.props.socket.emit('Show '+type, null, res);
			} else {
				this.props.socket.emit('Show '+type, res);
			}
		} else if(['Mute', 'Unmute', 'Ban', 'Unban', 'Player', 'Admin', 'Guest'].indexOf(type) > -1){//use a groupmodal for the playerlist.
			var res = function(response){
				if(response){that.props.modalpush({id: [], name: name, type: 'group', accounts: response});;}
			};
			this.props.socket.emit('List Accounts', res);
		} else if(type == 'Notifications' || type == 'Rooms'){
			this.props.modalpush({id: [], name: name, type: 'notifications'});
		} else if(type == 'Public'){
			this.props.modalpush({id: [], name: 'Input full Discord ID#', type: 'action'});
		} else if(name == "Edit Favicon"){
			this.props.modalpush({id: [], name: 'Edit Favicon', type: 'favicon'});
		} else if(['Player', 'Admin'].indexOf(this.props.permissions) > -1){//Narrate
			this.props.modalpush({id: [], name: name, type: 'action'});
		}
	},

	setpriv: function(){
		this.props.socket.emit('AdminCommand', 'SetPublic', false);
	},

	gendice: function(e){
		var settings = this.props.settings;
		var dice = this.refs.Nd.value+'d'+this.refs.dN.value;
		if(this.refs.exploding.checked){dice += '!';}
		if(this.refs.Nd.value > 0 && this.refs.dN.value > 1 && ['Player', 'Admin'].indexOf(this.props.permissions) > -1){
			settings.dice.push(dice);
			this.props.handleSettings(settings, this.props.characters);
		}
	},

	show: function(e){
		this.props.socket.emit(e.target.textContent);
	},

	roll: function(e){
		var dice = e.target.getAttribute('data').split('d');// dice[0] is the number, dice[1] is faces (plus ! if it's there)
		var result = roll(dice);
		this.props.socket.emit('Dice', e.target.getAttribute('data'), result, this.props.settings.textcolor);
	},

	dragstart: function(e){
		e.stopPropagation();
		var handler;
		e.dataTransfer.setData("text", 'n');
		if(e.target.className == 'derivative'){handler = e.target.parentNode;} else {handler = document.getElementsByClassName('charlist')[0];}
		handler.addEventListener("dragover", this.dragover, false);
		handler.addEventListener("dragend", this.dragend, false);
		handler.addEventListener("drop", this.drop, false);
		this.setState({dragEl: e.target});
	},

	dragover: function(e){
		//make sure they're the same type but not the same element
		if(e.target.className.startsWith(this.state.dragEl.className) && e.target.id != this.state.dragEl.id){
			e.preventDefault();
		} else if((this.state.dragEl.className == 'character' || this.state.dragEl.className == 'characterclosed') && e.target.className.startsWith('chargroup')){
			e.preventDefault();
		}
	},

	dragend: function(e){
		e.preventDefault();
		var handler;
		if(e.target.className == 'derivative'){handler = e.target.parentNode;} else {handler = document.getElementsByClassName('charlist')[0];}
		handler.removeEventListener("dragover", this.dragover, false);
		handler.removeEventListener("dragend", this.dragend, false);
		handler.removeEventListener("drop", this.drop, false);
		this.setState({dragEl: null});
	},

	drop: function(e){//should only work if we prevented the default.
		e.preventDefault();
		var rect = e.target.getBoundingClientRect();
		var where;
		if(this.props.settings.compchar && !this.props.settings.buttons){
			where = (e.clientX - rect.left)/(rect.left-rect.right) > 0.5;//if it's greater it's to the right
		} else {
			where = (e.clientY - rect.top)/(rect.bottom-rect.top) > 0.5;//if it's greater it's below
		}
		var id1 = this.state.dragEl.id.split(',');
		var id2 = e.target.id.split(',');//length doesn't matter yet, we'll figure out what to do.
		var el;
		switch(this.state.dragEl.className){
			case 'derivative':
				el = this.props.characters[id1[0]][id1[1]].splice(id1[2], 1)[0];
				if(el){
					if(+id1[2] < +id2[2]){id2[2]--;}//if splice shifted the array up, account for this
					if(where){id2[2]++;}
					this.props.characters[id1[0]][id1[1]].splice(id2[2], 0, el);
				}
				break;
			case 'characterclosed':
			case 'character':
				el = this.props.characters[id1[0]].splice(id1[1], 1)[0];
				if(el){
					if(id2[1]){//no need or ability to check this otherwise
						if(id1[0] == id2[0] && +id1[1] < +id2[1]){id2[1]--;}//same group AND higher placement, or there's no shift up.
						if(where){id2[1]++;}//this needs a check regardless.
						this.props.characters[id2[0]].splice(id2[1], 0, el);
					} else {
						if(!where && id2[0] == '1'){//top group and at the top
							this.props.characters[0].push(el);//add it to the end of ungrouped.
						} else {
							this.props.characters[id2[0]].splice(1, 0, el);//add to first non-name position
						}
					}
				}
				break;
			case 'chargroup'://no case for ungrouped, it should never be moved or draggable at all.
				//make sure to never replace the ungrouped either
				if(id2[0] == 0){
					break;
				}
				el = this.props.characters.splice(id1[0], 1)[0];
				if(el){
					if(+id1[0] < +id2[0]){id2[0]--;}
					if(where){id2[0]++;}
					this.props.characters.splice(id2[0], 0, el);
				}
				break;
		}
		this.props.handleSettings(this.props.settings, this.props.characters);
	},

	refresh: function(){
		var that=this;
		this.props.socket.emit('Get Character List', function(charindex){
			that.setState({charindex: charindex});
		});
	},

	charstats: function(){
		var charlist = this.props.characters;
		var groups = charlist.length - 1;
		//Thanks to how group names have to work, we have to ignore the first index of each group for a proper count.
		var characters = 0-groups;
		var derivatives = 0;
		//for each character in each group...
		for(var i = 0; i < groups+1; i++){
			characters += charlist[i].length;
			//for each derivative on each character...
			for(var j = 0; j < charlist[i].length; j++){
				derivatives += charlist[i][j].length;
			}
		}
		this.props.systemmessage("<b>Groups:</b> "+groups+",<br><b>Characters:</b> "+characters+",<br><b>Derivatives:</b> "+derivatives);
	},

	save: function(e){this.props.handleSettings(this.props.settings, this.props.characters, true);},

	render: function(){
		var currenttab = null;
		var that=this;
		var menu = null;
		if(this.props.settings.buttons){
			menu = (<button onClick={that.props.contextMenu} style={{float:'right', pointerEvents:'auto'}}>Menu</button>);
		}
		switch(this.state.tab){//use this to acquire the jsx for each tab
			case 'characters'://case for the characters tab
				var characters = this.props.characters;
				var charlist = characters.map(function(group, i){//groups loop
					if(i==0 || that.state.open.groups[group[0]]){//open group
						var chars = characters[i].map(function(chr, i2){//characters loop
							if(typeof chr !== 'string'){//make sure it's not the name.
								if(that.state.open.characters[chr[0].id]){//open derivative list
									var derivs = characters[i][i2].map(function(deriv, i3){
										if(that.props.settings.compchar && !menu){
											return(<div draggable key={i3} id={i+','+i2+','+i3} className="derivative" style={{width: '50px'}} title={deriv.name}><img src='/faceicons/img_trans.gif' height='50px' width='50px' style={{backgroundImage: 'url(/faceicons/'+deriv.icon+'.png)', backgroundPosition: '-'+deriv.icpos.left+'px -'+deriv.icpos.top+'px', pointerEvents:'none'}}/></div>);
										} else {
											return(<div draggable key={i3} id={i+','+i2+','+i3} className="derivative"><img src='/faceicons/img_trans.gif' height='50px' width='50px' style={{backgroundImage: 'url(/faceicons/'+deriv.icon+'.png)', backgroundPosition: '-'+deriv.icpos.left+'px -'+deriv.icpos.top+'px', pointerEvents:'none'}}/><span>{deriv.name}{menu}</span></div>);
										}
									});
									return(<div draggable onDragStart={that.dragstart} onClick={that.toggleChar} key={i2} id={i+','+i2} className="character"><span style={{pointerEvents:'none', display: that.props.settings.compchar && !menu ? 'block' : ''}}>{chr[0].name} [-]</span>{menu}{derivs}</div>);
								} else {//closed derivative list
									if(that.props.settings.showfi){
										return(<div draggable onClick={that.toggleChar} key={i2} id={i+','+i2} className="characterclosed"><img src='/faceicons/img_trans.gif' height='50px' width='50px' style={{backgroundImage: 'url(/faceicons/'+chr[0].icon+'.png)', backgroundPosition: '-'+chr[0].icpos.left+'px -'+chr[0].icpos.top+'px', pointerEvents:'none'}}/><span style={{pointerEvents:'none'}}>{chr[0].name} [+]</span>{menu}</div>);
									} else {
										return(<div draggable onClick={that.toggleChar} key={i2} id={i+','+i2} className="character"><span style={{pointerEvents:'none'}}>{chr[0].name} [+]</span>{menu}</div>);
									}
								}
							}
						});
						if(typeof group[0] === 'string'){//actual group
							return(<div draggable onClick={that.toggleGroup} key={i} id={i} className="chargroup"><span style={{pointerEvents:'none'}} className='group'>{group[0]} [-]</span>{menu}{chars}</div>);
						} else {//ungrouped
							return(<div id={0} key={i} className="chargroup ungrouped">{chars}</div>);
						}
					} else {//closed group
						return(<div draggable onClick={that.toggleGroup} key={i} id={i} className="chargroup"><span className='group' style={{pointerEvents:'none'}}>{group[0]} [+]</span>{menu}</div>);
					}
				});
				if(characters.length == 1 && characters[0].length == 0){//none
					charlist = [<div id={0} key={0} className="chargroup ungrouped">Right-click to create a character!</div>];
				}
				currenttab = (<div id={0} onDragStart={that.dragstart} onClick={this.props.settings.buttons ? that.props.contextMenu : null} className="charlist">
					{charlist}
					</div>);
				break;
			case 'players'://case for the players online tab
				var players = this.props.players;
				currenttab = Object.keys(players).map(function(player, index){
					return (<div id={player} key={index} className='PLentry'>{players[player].afk ? '(AFK) ' : ''}{player + ' - ' + players[player].permissions}{menu}</div>);
				});
				var ind = currenttab.length;
				if(this.props.roomplayers){
					var roomplayers = this.props.roomplayers;
					var test = Object.keys(roomplayers).forEach(function(room){
						if(that.props.settings.rooms && that.props.settings.rooms[room] && Object.keys(roomplayers[room]).length){//don't list empty rooms or rooms we've left.
							currenttab.push(<h3 key={ind++} style={{pointerEvents:'none', textAlign:'center'}}>-<br/>{room}<br/>-</h3>);
							Object.keys(roomplayers[room]).forEach(function(player){
								currenttab.push(<div id={player} data={room} key={ind++} className='PLentry'>{roomplayers[room][player].afk ? '(AFK) ' : ''}{player + ' - ' + roomplayers[room][player].permissions}{menu}</div>);
							});
						}
					});
				}
				currenttab = (<div className="playlist">
					{currenttab}
					</div>);
				break;
			case 'commands'://case for player commands tab
				currenttab=[<div key='0' className='Command' onClick={this.togglesetting}>{'Enter Checkbox '+(this.props.settings.echeck ? 'ON' : 'OFF')}</div>, <div key='1' className='Command' onClick={this.togglesetting}>{'Menu Buttons '+(this.props.settings.buttons ? 'ON' : 'OFF')}</div>, <div key='2' className='Command' onClick={this.togglesetting}>{'Compact Characters '+(this.props.settings.compchar ? 'ON' : 'OFF')}</div>, <div key='3' className='Command' onClick={this.togglesetting}>{'Listed Icons '+(this.props.settings.showfi ? 'ON' : 'OFF')}</div>, <div key='4' className='Command' onClick={this.togglesetting}>{'IC/OOC Icons '+(this.props.settings.hideIcons ? 'OFF' : 'ON')}</div>, <div key='5' className='Command'><span>Set Text Color</span><input type="color" ref="OOCcolor" style={{backgroundColor:'black'}} onChange={this.setColor} defaultValue={this.props.settings.textcolor}/></div>, <div key='6' className='Command' onClick={function(e){window.open(that.props.socketroom ? '/logs/'+that.props.socketroom : '/logs');}}>Open Logs</div>, <div key='7' className='Command' onClick={function(e){window.open('/database');}}>Open Database</div>, <div key='8' className='Command' onClick={function(e){window.open('/characters');}}>Open Character Database</div>, <div key='9' className='Command' onClick={this.genmodal}>Narrate</div>, <div key='10' className='Command' onClick={this.genmodal}>Set Notifications</div>, <div key='12' className='Command' onClick={this.show}>Show Rules</div>, <div key='13' className='Command' onClick={this.show}>Show MOTD</div>, <div key='14' className='Command' onClick={function(e){window.open('/worldinfo');}}>Show World Info</div>, <div key='15' className='Command' onClick={this.genmodal}>Show Default Profile</div>, <div key='16' className='Command' onClick={this.charstats}>Show Charlist Stats</div>, <div key='17' className='Diceee'><span onClick={this.gendice} className='Command'>Create Dice</span> <input type="number" ref='Nd' min="1" style={{width:'10%', textAlign:'center'}}/>d<input type="number" ref='dN' min="1" style={{width:'10%', textAlign:'center'}}/><input type='checkbox' ref='exploding'/>!</div>];
				if(!this.props.socketroom){currenttab.splice(11, 0, (<div key='11' className='Command' onClick={this.genmodal}>Set Rooms</div>));}
				var that = this;
				this.props.settings.dice.forEach(function(dice, index){
					currenttab.push(<div key={18+index} id={'Dice'+index} className='Dice Command' data={dice} onClick={that.roll}>{dice}{menu}</div>);
				});
				currenttab = (<div className="playlist">
					{currenttab}
					</div>);
				break;
			case 'admin'://case for the administrative commands tab
				currenttab = [<div key='0' className='Command' onClick={this.genmodal}>Edit Rules</div>, <div key='1' className='Command' onClick={this.genmodal}>Edit MOTD</div>, <div key='2' className='Command' onClick={this.genmodal}>Edit Default Profile</div>, <div key='3' className='Command' onClick={this.genmodal}>Edit World Info</div>, <div key='4' className='Command' onClick={this.genmodal}>Edit Title</div>, <div key='5' className='Command' onClick={this.genmodal}>Edit Favicon</div>, <div key='6' className='Command' onClick={this.genmodal}>Set Public</div>, <div key='7' className='Command' onClick={this.setpriv}>Set Private</div>, <div key='8' className='Command' onClick={this.genmodal}>Mute</div>, <div key='9' className='Command' onClick={this.genmodal}>Unmute</div>, <div key='10' className='Command' onClick={this.show}>List Bans</div>, <div key='11' className='Command' onClick={this.genmodal}>Ban</div>, <div key='12' className='Command' onClick={this.genmodal}>Unban</div>, <div key='13' className='Command' onClick={this.genmodal}>Make Player</div>, <div key='14' className='Command' onClick={this.genmodal}>Make Admin</div>, <div key='15' className='Command' onClick={this.genmodal}>Make Guest</div>, <div key='16' className='Command' onClick={this.genmodal}>Clean Logs</div>, <div key='17' className='Command' onClick={this.genmodal}>Show Admin Logs</div>, <div key='18' className='Command' onClick={this.refresh}>Open Lists</div>];
				if(this.state.charindex){
					var characters = this.state.charindex;
					var charlist = characters.map(function(player, i){//players loop
						var charid = characters[i][0].id.split('-');
						charid.pop();
						var playername = charid.join('-');//catches names with - in them
						if(that.state.open.players[playername]){//open player
							var chars = characters[i].map(function(chr, i2){//characters loop
								return(<div key={i2} id={chr.id} className="character admin"><span style={{pointerEvents:'none'}}>{chr.name}</span></div>);
							});
							return(<div onClick={that.togglePlayer} key={i} id={playername} className="chargroup admin"><span style={{pointerEvents:'none'}} className='group'>{playername} [-]</span>{chars}</div>);
						} else {//closed player
							return(<div onClick={that.togglePlayer} key={i} id={playername} className="chargroup admin"><span className='group' style={{pointerEvents:'none'}}>{playername} [+]</span></div>);
						}
					});
					currenttab.push(charlist);
				}
				currenttab = (<div className="playlist">
					{currenttab}
					</div>);
		}
		var admin = this.props.permissions=='Admin'? <li><div className="tablink" id="admin" onClick={this.shiftTab}>Admin Commands</div></li> : null;
		return (
			<div className="options">
				<style>
					{'div#OI img {display:'+(this.props.settings.hideIcons?'none':'inline')+'}'}
				</style>
				<ul className="tab" style={{listStyleType:'none'}}>
					<li><div className="tablink" id="characters" onClick={this.shiftTab}>Characters</div></li>
					<li><div className="tablink" id="players" onClick={this.shiftTab}>Players Online</div></li>
					<li><div className="tablink" id="commands" onClick={this.shiftTab}>Player Commands</div></li>
					{admin}
				</ul>
				{currenttab}
			</div>
		);
	}
});

var Message = React.createClass({
	htmlupdate: function(){//modify content to innerHTML
		var message = this.props.message;
		var classparam = message.className.split(" ")[1];
		var post = message.post;
		if(this.refs.post){
			if(classparam == 'say'){post = '"'+post+'"';}
			this.refs.post.innerHTML = post;
		}
		if(this.refs.name){
			var name = message.character.customHTML || message.character.name;
			switch(classparam){
				case 'say':
					name += ':';
				case 'action':
					name += ' ';
			}
			if(message.character.customHTML){
				this.refs.name.innerHTML = name;
			} else {
				this.refs.name.textContent = name;
			}
			this.refs.name.style.display = message.unnamed ? 'none' : 'initial';
		}
	},

	componentDidMount: function(){
		if(this.props.highlight){
			var node = ReactDOM.findDOMNode(this);
			node.style['transition'] = '0.5s';
			node.style['background-color'] = 'rgba(255,255,0,0.3)';
			setTimeout(this.read, 4000);
		}
		this.htmlupdate();
	},

	read: function(){
		var node = ReactDOM.findDOMNode(this);
		var box = document.getElementById(this.props.message.className.split(" ")[0]).getBoundingClientRect();
		var postbox = node.getBoundingClientRect()
		if(postbox.bottom < box.top || postbox.top > box.bottom){//above or below view
			setTimeout(this.read, 4000);
		} else {
			node.style['background-color'] = null;
		}
	},

	componentDidUpdate: function(){
		this.htmlupdate();
	},

	render: function(){
		var message = this.props.message;
		var socketroom = this.props.socketroom;
		var character = message.character;//worst case it's just null and then it won't be getting used anyway.
		var classparam = message.className.split(" ")[1];
		var room = (!socketroom && message.room && message.room != '0') ? '['+message.room+']' : null;
		switch(classparam){
			case 'message'://ooc message
				return (<div id={message.username} data={message.room} className={message.className}>{room}( <b>{message.username+': '}</b><span ref="post" style={{color: message.color}}></span> ){'\r'}</div>);
			case 'whisper'://ooc whisper
				if(message.username){
					return (<div id={message.username} data={message.room} className={message.className}>( <b>{message.username+' whispered to you: '}</b><span ref="post"></span> ){'\r'}</div>);
				} else if(message.target){
					return (<div className={message.className}>( <b>{'You whispered to '+message.target+': '}</b><span ref="post"></span> ){'\r'}</div>);
				}
			case 'narration'://ic narration message
				return (<div id={message.id} data={message.username} className={message.className}>{room}<br/><span ref="post" style={{color: message.color}}></span>{'\r'}</div>);
			case 'dice'://ooc dice message
				return (<div className={message.className}>{room}<span ref="post" style={{color: message.color}}></span>{'\r'}</div>);
			case 'log':
				return (<div className={message.className}>{room}{"| "+message.username+" "+message.post+" |"}{'\r'}</div>);
			case 'system'://just the post itself.
				return (<div className={message.className}>{room}<span ref="post"></span>{'\r'}</div>);
			case 'say'://fallthrough
			case 'action':
				var charid = character.id.split('-');
				var d = charid.pop();
				charid = charid.join('-');//catches names with - in them
				var edit = [];
				if(message.id){edit.push(character.id);}//worst case message.id is undefined
				//if(!message.className.startsWith('O') && !message.className.startsWith('T')){edit.push('Narrate');}//IC post
				return(<div id={message.id} data={edit} data-room={room} className={message.className} style={{fontFamily: character.fontStyle}}><a href={'/characters/'+charid+'/'+d+'.html'} target="_blank"><img src='/faceicons/img_trans.gif' height='50px' width='50px' style={{cursor: 'pointer', backgroundImage: 'url(/faceicons/'+character.icon+'.png)', backgroundPosition: '-'+character.icpos.left+'px -'+character.icpos.top+'px'}}/></a>{room} <span ref='name' style={{fontWeight: 'bold', color: character.nameColor}}></span><span ref="post" style={{color: character.color}}></span>{'\r'}</div>);
		}
	}
});

var IChandler = React.createClass({
	getInitialState: function(){
		//normally messages would be empty but I want to test this out.
		return {messages: [], ids: {}};
	},

	boxClear: function(e){
		var messages = this.state.messages.slice();
		var ids = this.state.ids;
		this.setState({messages: [], ids: {}});
		this.forceUpdate();
	},

	shouldComponentUpdate: function(nextProps, nextState){
		return(nextState.messages.length !== this.state.messages.length);
	},

	componentWillUpdate: function(){
		this.scroll = Math.ceil(this.refs.box.scrollTop) + this.refs.box.offsetHeight >= this.refs.box.scrollHeight;//already at the bottom.
	},

	componentDidUpdate: function(){
		if(this.scroll){
			this.refs.box.scrollTop = this.refs.box.scrollHeight;
		}
	},

	componentDidMount: function(){
		var that = this;
		this.props.socket.on('ICmessage', function(message){
			if(!that.props.socketroom && message.room && message.room != '0'){//it's from a room.
				//if it doesn't have the IC flag set, drop the post.
				if(!that.props.rooms[message.room] || !that.props.rooms[message.room].IC){
					return;
				}
			}
			var newm = that.state.messages.slice();
			var ids = that.state.ids;
			var target = newm[ids[message.id]];
			if(target){//a message with this id already exists
				var msg = target.props.message;
				msg.post = message.post;//we know it is a full post already in this case
				if(typeof message.unnamed === "boolean"){//if it is not defined, don't touch it.
					msg.unnamed = message.unnamed;
				}
				if(message.character){
					msg.character = message.character;
				}
				if(message.className){
					msg.className = message.className;
				}
				newm[ids[message.id]] = React.cloneElement(target, msg);
			} else {//this is a new message, check if we should notify for it
				ids[message.id] = newm.length;//index this post to its id
				var highlight = false;
				if(that.props.notify){
					if(that.props.notify[message.username] && that.props.notify[message.username].IC){
						highlight = true;
						if(document.visibilityState != 'visible'){//don't do this if they're in window
							document.title = "Post from "+message.username+"!";
							document.getElementsByTagName('link')[0].href = "/faceicons/notice.png";
						}
					} else if(message.character && ((that.props.notify[message.character.name] && that.props.notify[message.character.name].IC) || (that.props.notify[message.character.id] && that.props.notify[message.character.id].IC))){
						highlight = true;
						if(document.visibilityState != 'visible'){//don't do this if they're in window
							document.title = "Post from "+message.character.name+"!";
							document.getElementsByTagName('link')[0].href = "/faceicons/notice.png";
						}
					}
				}
				newm.push(<Message key={newm.length} message={message} highlight={highlight} socketroom={that.props.socketroom}/>);
			}
			that.setState({messages: newm, ids: ids});
			if(target){
				that.forceUpdate();//do this just in case or it may not register the edit.
			}
		});

		this.props.socket.on('ICedit', function(message){
			var messages = that.state.messages.slice();
			var ids = that.state.ids;
			var target = messages[ids[message.id]];
			if(target){//if it isn't in here obviously we aren't doing it.
				var msg = target.props.message;
				msg.post = message.post;
				if(typeof message.unnamed === "boolean"){//if it is not defined, don't touch it.
					msg.unnamed = message.unnamed;
				}
				if(message.character){
					msg.character = message.character;
				}
				if(message.className){
					msg.className = message.className;
				}
				messages[ids[message.id]] = React.cloneElement(target, msg);
				
				that.setState({messages: messages});
				that.forceUpdate();//this is the cheap solution.
			}
		});

		this.props.socket.on('ICdel', function(id){
			var messages = that.state.messages.slice();
			var ids = that.state.ids;
			var target = messages[ids[id]];
			if(target){
				delete messages[ids[id]];
				delete ids[id];
				that.setState({messages: messages, ids: ids});
				that.forceUpdate();
			}
		});
	},

	render: function(){
		return (
			<div ref='box' className='ICbox' id='ICbox'>
				{this.state.messages}
			</div>
		);
	}
});

var OOChandler = React.createClass({
	getInitialState: function(){
		return {messages: []};
	},

	boxClear: function(e){
		this.setState({messages: []});
		this.forceUpdate();
	},

	systemmessage: function(message){
		var newm = this.state.messages.slice();
		newm.push(<Message key={newm.length} message={{post: message, className: 'OOC system message'}}/>)
		this.setState({messages: newm});
	},

	shouldComponentUpdate: function(nextProps, nextState){
		return(nextState.messages.length !== this.state.messages.length);
	},

	componentWillUpdate: function(){
		this.scroll = Math.ceil(this.refs.box.scrollTop) + this.refs.box.offsetHeight >= this.refs.box.scrollHeight;//already at the bottom.
	},

	componentDidUpdate: function(){
		if(this.scroll){
			this.refs.box.scrollTop = this.refs.box.scrollHeight;
		}
	},

	componentDidMount: function(){
		var that = this;
		this.props.socket.on('OOCmessage', function(message){
			if(!that.props.socketroom && message.room && message.room != '0'){//it's from a room.
				//if it doesn't have the OOC flag set, drop the post.
				if(!that.props.rooms[message.room] || !that.props.rooms[message.room].OOC){
					return;
				}
			}
			var newm = that.state.messages.slice();
			var highlight = false;
			if((message.className.split(" ")[1] == 'whisper' && message.username) || (message.character && that.props.notify && ((that.props.notify[message.username] && that.props.notify[message.username].OOC) || (message.character && that.props.notify[message.character.name] && that.props.notify[message.character.name].OOC)))){
				highlight = true;
				if(document.visibilityState != 'visible'){
					document.title = "Post from "+message.username+"!";
					document.getElementsByTagName('link')[0].href = "/faceicons/notice.png";
				}
			}
			newm.push(<Message key={newm.length} message={message} highlight={highlight} socketroom={that.props.socketroom}/>);
			that.setState({messages: newm});
		});
		this.props.socket.on('disconnect', function(){
			var newm = that.state.messages.slice();
			newm.push(<Message key={newm.length} message={{username: 'You', post: 'have disconnected.', className: 'OOC log message'}}/>);
			that.setState({messages: newm});
		});
	},

	render: function(){
		return (
			<div ref='box' className='OOCbox'>
				{this.state.messages}
			</div>
		);
	}
});

ReactDOM.render(
	<Outercontainer socket={socket}/>,
	document.getElementById('main')
);
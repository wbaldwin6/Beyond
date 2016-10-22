var idleTime;

var idleincrement = function(){
	if(++idleTime > 4){
		postMessage(true);
	}
};

var interval = setInterval(idleincrement, 60000);

onmessage = function(e){
	idleTime = e.data;
};
const monthenum = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const container = document.getElementById('outerc');
const logfilelist = container.dataset.logfileList.split(',');
var currententry = container.dataset.logfileStart;
var lastoff = false;
var nextoff = false;
var url = document.URL.split('/');
var room = url.length == 6 ? url[url.length-2]+'/' : '';

function refresh(){
    document.getElementById('fileselect').selectedIndex = currententry;
    document.getElementById('ifrm').setAttribute("src", '/logs/'+room+logfilelist[currententry]);
    var month = logfilelist[currententry].substring(0, 7);
    var monthname = monthenum[month.split('_')[1]-1]+' '+logfilelist[currententry].substring(8, 10)+', '+month.split('_')[0];
    document.getElementById('currentfile').textContent = monthname;

    if(currententry == 0){
        var last = document.getElementById('last');
        last.onclick = null;
        last.style.background = '#A5A5A5';
        last.style.cursor = 'not-allowed';
        lastoff = true;
    }
    //it is POSSIBLE we need to disable both, in the edge case of only one log file.
    if(currententry == logfilelist.length-1){
        var next = document.getElementById('next');
        next.onclick = null;
        next.style.background = '#A5A5A5';
        next.style.cursor = 'not-allowed';
        nextoff = true;
    }

    if(lastoff && currententry != 0){
        var last = document.getElementById('last');
        last.onclick = function(){currententry--; refresh();};
        last.style.background = '#7289DA';
        last.style.cursor = 'pointer';
        lastoff = false;
    }

    if(nextoff && currententry != logfilelist.length-1){
        var next = document.getElementById('next');
        next.onclick = function(){currententry++; refresh();};
        next.style.background = '#7289DA';
        next.style.cursor = 'pointer';
        nextoff = false;
    }
}

//create the 'current file' button
var currentfilelisting = document.createElement('DIV');
currentfilelisting.id = 'currentfile';
currentfilelisting.setAttribute('style', 'color: #fff; width: 35%; float:left; white-space: nowrap; line-height: 25px;');
container.appendChild(currentfilelisting);

//create the 'navigate to previous' button
var lastbutton = document.createElement('DIV');
lastbutton.id = 'last';
lastbutton.textContent = 'Previous Log';
lastbutton.setAttribute('style', "display: inline-block; border-radius: 0px 0px 3px 3px; height: 25px; background: #7289DA; color: #fff; line-height: 25px; width: 30%; cursor: pointer");
lastbutton.onclick = function(){currententry--; refresh();};
container.appendChild(lastbutton);

//create the drop-down menu to immediately select another file
var fileselect = document.createElement('SELECT');
var num = 0;
fileselect.id = 'fileselect';
for(index in logfilelist){
    fileselect.options[num++] = new Option(logfilelist[index], index);
}
//fileselect.selectedIndex = currententry;
fileselect.onchange = function(){currententry = document.getElementById('fileselect').value; refresh();};
fileselect.setAttribute('style', 'display: inline-block; border: 0px; width: 35%; float:right');
container.appendChild(fileselect);

//create the iframe
var ifrm = document.createElement('IFRAME');
ifrm.id = "ifrm";
ifrm.style.width = 100+"%";
ifrm.style.borderWidth = '0px';
ifrm.style.height = 'calc(100% - '+50+'px)';
ifrm.frameborder = '0';
container.appendChild(ifrm);

//create the 'navigate to next' button
var nextbutton = lastbutton.cloneNode(true);
nextbutton.id = 'next';
nextbutton.textContent = 'Next Log';
//nextbutton.setAttribute('style', "display: inline-block; border-radius: 0px 0px 3px 3px; height: 25px; background: #7289DA; color: #fff; line-height: 25px; width: 30%; cursor: pointer");
nextbutton.onclick = function(){currententry++; refresh();};
container.appendChild(nextbutton);

refresh();
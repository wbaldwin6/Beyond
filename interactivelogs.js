const monthenum = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const container = document.getElementById('outerc');
const logfilelist = container.dataset.logfileList.split(',');
var currententry = container.dataset.logfileStart;
var lastoff = false;
var nextoff = false;
var url = document.URL.split('/');
var room = url.length == 6 ? url[url.length-2]+'/' : '';

var io = [1,1];

function refresh(){
    document.getElementById('fileselect').selectedIndex = currententry;
    document.getElementById('ifrm').setAttribute("src", '/logs/'+room+logfilelist[currententry]);
    var month = logfilelist[currententry].substring(0, 7);
    var monthname = monthenum[month.split('_')[1]-1]+' '+logfilelist[currententry].substring(8, 10)+', '+month.split('_')[0];
    document.getElementById('currentfile').textContent = monthname;
    window.history.pushState("object or string", "Title", '/interactivelogs/'+room+logfilelist[currententry]);

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

function onifload(){
    var buttons = ifrm.contentDocument.getElementsByClassName('buttons');
    if(buttons.length){
        buttons[0].style.display = "none";
        var x = ifrm.contentDocument.getElementsByTagName("style")[0].sheet.cssRules;
        //update this to follow how the buttons are currently set if needed
        if(tsbutton.innerHTML.startsWith("Show")){
            x[5].style.display = "none";
        }
        if(delbutton.innerHTML.startsWith("Show")){
            x[8].style.display = "none";
        }
        toggleIO(io[0],io[1]);
    }
}

function toggledisplay(e, y){
    if(e.innerHTML.startsWith("Hide")){
        e.innerHTML = e.innerHTML.replace("Hide", "Show");
    } else {
        e.innerHTML = e.innerHTML.replace("Show", "Hide");
    }
    var x = ifrm.contentDocument.getElementsByTagName("style")[0].sheet.cssRules;
    x[y].style.display = x[y].style.display==="none" ? "initial" : "none";
}

function toggleIO(i, o){
    var x = ifrm.contentDocument.getElementsByTagName("style")[0].sheet.cssRules;
    x[6].style.display = i ? "initial" : "none";
    x[7].style.display = o ? "initial" : "none";
    io = [i,o];
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
ifrm.onload = onifload;
container.appendChild(ifrm);

//create the Hide Timestamps and Hide Deletes buttons
var tsbutton = lastbutton.cloneNode(true);
tsbutton.id = 'ts';
tsbutton.textContent = 'Hide Timestamps';
tsbutton.style.fontSize = 'smaller';
tsbutton.style.width = 'calc(10%)';
tsbutton.style.whiteSpace = 'nowrap';
tsbutton.style.height = '20px';
tsbutton.style.lineHeight = '20px';
tsbutton.style.borderRadius = '3px';
tsbutton.style.marginRight = 'calc(1.5%)';
tsbutton.onclick = function(){toggledisplay(this,5);};
container.appendChild(tsbutton);

var delbutton = tsbutton.cloneNode(true);
delbutton.id = 'del';
delbutton.textContent = 'Hide Deletes';
delbutton.onclick = function(){toggledisplay(this,8);};
container.appendChild(delbutton);

//create the Hide Face Icons button
var fibutton = delbutton.cloneNode(true);
fibutton.id = 'fi';
fibutton.textContent = 'Hide Face Icons';
fibutton.onclick = function(){toggledisplay(this,9);};
container.appendChild(fibutton);

//create the 'navigate to next' button
var nextbutton = lastbutton.cloneNode(true);
nextbutton.id = 'next';
nextbutton.textContent = 'Next Log';
//nextbutton.setAttribute('style', "display: inline-block; border-radius: 0px 0px 3px 3px; height: 25px; background: #7289DA; color: #fff; line-height: 25px; width: 30%; cursor: pointer");
nextbutton.onclick = function(){currententry++; refresh();};
container.appendChild(nextbutton);

var OOCbutton = tsbutton.cloneNode(true);
OOCbutton.id = "OOCb";
OOCbutton.textContent = 'OOC Only';
OOCbutton.style.width = 'calc(10%)';
OOCbutton.style.marginLeft = 'calc(2%)';
OOCbutton.style.marginRight = '0';
OOCbutton.onclick = function(){toggleIO(0,1);};
container.appendChild(OOCbutton);

var ICbutton = OOCbutton.cloneNode(true);
ICbutton.id = "ICb";
ICbutton.textContent = 'IC Only';
ICbutton.style.marginLeft = 'calc(1.5%)';
ICbutton.onclick = function(){toggleIO(1,0);};
container.appendChild(ICbutton);

var bothbutton = ICbutton.cloneNode(true);
bothbutton.id = "bothb";
bothbutton.textContent = 'Both';
bothbutton.onclick = function(){toggleIO(1,1);};
container.appendChild(bothbutton);

refresh();
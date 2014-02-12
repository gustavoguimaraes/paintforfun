tool.minDistance = 10;
tool.maxDistance = 45;


// Initialise Socket.io
var socket = io.connect('/');

// Random User ID
// Used when sending data
var uid =  (function() {
     var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
} () );



// JSON data ofthe users current drawing
// Is sent to the user
var path_to_send = {};

// Calculates colors
var active_color_rgb;
var active_color_json = {};
var $opacity = $('#opacity');
var update_active_color = function() {

    var rgb_array =  $('.active').attr('data-color').split(',');
    var red = rgb_array[0] / 255;
    var green = rgb_array[1] / 255;
    var blue = rgb_array[2] / 255;
    var opacity =  $opacity.val() / 255;

    active_color_rgb =  new RgbColor( red, green, blue, opacity );
    active_color_rgb._alpha = opacity;

    active_color_json = {
        "red" : red,
        "green" : green,
        "blue" : blue,
        "opacity" : opacity
    };

};




// Get the active color from the UI eleements
update_active_color();


//show Images
function changeImage(name, urlFirst) {
 document.getElementById(name).onclick = function() {
    document.getElementById("theImage").style.backgroundImage = urlFirst + ", url('/img/recycled_paper.jpg')";
    document.getElementById("theImage").style.backgroundSize = "auto 90%, 100% 100%";
    }

}

changeImage("showMona", 'url("https://image.spreadshirt.com/image-server/v1/designs/12373990,width%3D190,height%3D190.png/mona-lisa_design.png")')
changeImage("showSeiya", 'url(http://openclipart.org/image/800px/svg_to_png/187799/zeimusu_Santa_and_Reindeer_black_white.png)')

changeImage("showDino", 'url(http://colouringbook.org/SVG/bandicoot/COLOURINGBOOK.ORG/black/D/dragon_flower_black_white_line_art_coloring_sheet_colouring_page-555px.png)')






// --------------------------------- 
// DRAWING EVENTS


var send_paths_timer;
var timer_is_active = false;

function onMouseDown(event) {

    var point = event.point;

    path = new Path();
    path.fillColor = active_color_rgb;
    path.add(event.point);

    // The data we will send every 100ms on mouse drag
    path_to_send = {
        rgba : active_color_json,
        start : event.point,
        path : []
    };


}

function onMouseDrag(event) {
    
    var step = event.delta / 2;
    step.angle += 90;
    
    var top = event.middlePoint + step;
    var bottom = event.middlePoint - step;
    
    path.add(top);
    path.insert(0, bottom);
    path.smooth();

    // Add data to path
    path_to_send.path.push({
        top : top,
        bottom : bottom
    });

    // Send paths every 100ms
    if ( !timer_is_active ) {

        send_paths_timer = setInterval( function() {

            socket.emit('draw:progress', uid, JSON.stringify(path_to_send) );
            path_to_send.path = new Array();

        }, 100);

    }

    timer_is_active = true;

}


function onMouseUp(event) {
   
    // Close the users path
    path.add(event.point);
    path.closed = true;
    path.smooth();

    // Send the path to other users
    path_to_send.end = event.point;
    socket.emit('draw:end', uid, JSON.stringify(path_to_send) );

    // Stop new path data being added & sent
    clearInterval(send_paths_timer);
    path_to_send.path = new Array();
    timer_is_active = false;

}










// --------------------------------- 
// CONTROLS EVENTS

var $color = $('.color');
$color.on('click', function() {

    $color.removeClass('active');
    $(this).addClass('active');

    update_active_color();

});

$opacity.on('change', function() {

    update_active_color();

});











// --------------------------------- 
// SOCKET.IO EVENTS


socket.on('draw:progress', function( artist, data ) {

    // It wasnt this user who created the event
    if ( artist !== uid && data ) {

       progress_external_path( JSON.parse( data ), artist );

    }

}); 

socket.on('draw:end', function( artist, data ) {

    // It wasnt this user who created the event
    if ( artist !== uid && data ) {
       end_external_path( JSON.parse( data ), artist );
    }

}); 

var username = "Guest_" + Math.floor(Math.random()*999);

socket.on('user:connect', function(user_count) {
    update_user_count( user_count );
    
});

socket.on('user:disconnect', function(user_count) {
    update_user_count( user_count );
});

socket.on('connect', function() {
    socket.emit('initClient', username);
}) 

socket.on('updateChat', function(sender, data) {
    console.log(sender + " Sent chat: " + data);
    $('#chatbox').append('<b>'+sender+': </b>' + data + '<br>');
});


// --------------------------------- 
// SOCKET.IO EVENT FUNCTIONS


// Updates the active connections
var $user_count = $('#userCount');
var $user_count_wrapper = $('#userCountWrapper');
function update_user_count( count ) {

    $user_count_wrapper.css('opacity', 1);
    $user_count.text( (count === 1) ? "You are alone :-(" : count + " people online"  );

}


var external_paths = {};

// Ends a path
var end_external_path = function( points, artist ) {

    var path = external_paths[artist];

    if ( path ) {

        // Close the path
        path.add(points.end);
        path.closed = true;
        path.smooth();

        // Remove the old data
        external_paths[artist] = false;

    }

};

// Continues to draw a path in real time
progress_external_path = function( points, artist ) {


    var path = external_paths[artist];

    // The path hasnt already been started
    // So start it
    if ( !path ) {

        // Creates the path in an easy to access way
        external_paths[artist] = new Path();
        path = external_paths[artist];

        // Starts the path
        var start_point = new Point(points.start.x, points.start.y);
        var color = new RgbColor( points.rgba.red, points.rgba.green, points.rgba.blue, points.rgba.opacity );
        path.fillColor = color;
        path.add(start_point);

    }

    // Draw all the points along the length of the path
    var paths = points.path;
    var length = paths.length;
    for (var i = 0; i < length; i++ ) {

        path.add(paths[i].top);
        path.insert(0, paths[i].bottom);

    }

    path.smooth();


    view.draw();



};


$(function() {
    $('#sendBtn').click(function(evt) {
        if($('#chatInput').val() != "") {
            console.log("Sent Chat!");
            socket.emit('sendChat', $("#chatInput").val());
        }
        $('#chatInput').val("");
    });

    $('#chatInput').keypress(function(e) {
        if(e.which == 13) {
            $('#sendBtn').focus().click();
        }
    });
});
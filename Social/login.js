/**
 * Created by bns on 6/30/2017.
 */

var users;

function submit() {
    var val = document.getElementById('password').value;
    console.log(val);
    for (var i = 0; i < users.data.length; i++) {
        console.log(users.data[i][0] + ", " + users.data[i][1]);
        if (val === users.data[i][1]) {

            window.open("house_pages/" + users.data[i][0] + ".html");
        }
    }
}

function parse(text) {
    users = Papa.parse(text);
}

$(document).ready(function () {
    $.ajax({
        type: "GET",
        url: "Users.csv",
        dataType: "text",
        success: function (data) {
            parse(data);
        }
    });
});
// Intended for index.html

var allowedActions = ["time card", "project tracking", "vacation requests"];
var firstName = "Ben";
var lastname = "Scholer";
document.getElementById("welcome").innerText = "Welcome, " + firstName + "!";

var mainContent = document.getElementById("mainContent");

allowedActions.forEach(function (action) {
    var button = document.createElement('paper-button');
    button.innerHTML = action;

    button.addEventListener('click', function () {
        if (action === "time card") {
            location.href = "time-tracking.html";
        } else if (action === "project tracking") {
            location.href = "project-tracking.html";
        } else if (action === "vacation requests") {
            location.href = "vacation-requests.html";
        }
    });

    button.href = "time-tracking.html";
    mainContent.appendChild(button);
});
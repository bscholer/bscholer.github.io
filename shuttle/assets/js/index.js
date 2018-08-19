var stops = [
    // [32, 'Cary Quad (back of Cary)'],
    [2, 'Wiley/Tarkington'],
    [2, 'Co-rec'],
    [2, 'Windsor/Meredith'],
    [2, 'Earhart'],
    [2, 'Shreve/Hillenbrand'],
    [2, 'McCutcheon'],
    [5, 'Honors North/Honors South'],
    [1, 'Corner by Bechtel (Third Street)'],
    [5, 'Hawkins/Young'],
    [4, 'Arrive at church']];

function calculate() {
    var newStopsElement = document.getElementById("newStops");
    var momentMatches = ["hmm", "hmma", "hmm a", "hhmma", "hhmm a", "hhmm", "h:mma", "h:mm a"];
    var momentCorrectFormat = "h:mm A";
    var time = document.getElementById("time").value;
    console.log(moment(time, momentMatches).format(momentCorrectFormat));
    var inputMoment = moment(time, momentMatches);
    if (inputMoment.format() === "Invalid date") {
        newStopsElement.innerHTML = "Invalid Time";
        return;
    }
    var newStops = "Cary Quad (back of Cary) - " + inputMoment.subtract(32, "minutes").format(momentCorrectFormat) +
        "<br />";

    stops.forEach(function (stop) {
        var stopOutput = stop[1] + " - " + inputMoment.add(stop[0], "minutes").format(momentCorrectFormat) + "<br/>";
        console.log(stopOutput.substring(stopOutput.indexOf(":")));
        newStops += stopOutput;
    });
    document.getElementById("newStops").innerHTML = newStops;
}

document.getElementById("calculate").addEventListener("click", calculate);

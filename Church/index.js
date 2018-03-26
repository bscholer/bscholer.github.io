var stops = [
    [32, 'Cary Quad (back of Cary'],
    [30, 'Wiley/Tarkington'],
    [28, 'Co-rec'],
    [26, 'Windsor/Meredith'],
    [24, 'Earhart'],
    [22, 'Shreve/Hillenbrand'],
    [20, 'McCutcheon'],
    [15, 'Honors North/Honors South'],
    [14, 'Corner by Bechtel (Third Street)'],
    [9, 'Hawkins/Young'],
    [5, 'Arrive at church']];

function calculate() {
    var time = document.getElementById("time").valueAsDate;
    var hours = time.getHours();
    // Adjusting for EST
    hours += 5;
    if (hours > 12) hours -= 12;
    var minutes = time.getMinutes();
    var newStops = "";
    for (var i = 0; i < stops.length; i++) {
        var stop = stops[i];
        var stopOutput = "";
        // We need to go to the previous hour.
        if (minutes < stop[0]) {
            stopOutput = stop[1] + " - " + (hours - 1) + ":" + (minutes + 60 - stop[0]) + "<br/>";
        }
        else {
            stopOutput = stop[1] + " - " + hours + ":" + (minutes - stop[0]) + "<br/>";
        }
        newStops += stopOutput;
    }
    console.log(newStops);
    document.getElementById("newStops").innerHTML = newStops;
}

document.getElementById("calculate").addEventListener("click", calculate);

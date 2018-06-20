// Intended for any page that uses week-cards.

var d = moment().startOf("week").subtract(1, 'week');
// d.startOf("year").year();

// y += 1;
// d += 1;

var currWeek = document.getElementById("currentWeek");
// var nexWeek = document.getElementById("nextWeek");
// var prvWeek = document.getElementById("prevWeek");
var weekNumberInput = document.getElementById("weekNumberInput");

// prvWeek.setAttribute("weekNumber", d.week());
// prvWeek.setAttribute("year", d.year());

d.add(1, 'week');
weekNumberInput.value = d.week();

currWeek.setAttribute("weekNumber", d.week());
console.log(d.year());
currWeek.setAttribute("year", d.year());

d.add(1, 'week');

// nexWeek.setAttribute("weekNumber", d.week());
// nexWeek.setAttribute("year", d.year());
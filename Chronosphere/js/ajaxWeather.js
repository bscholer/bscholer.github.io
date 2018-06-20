// Intended for any page that uses cards with weather data.

const zip = "46793";
var forecastWeather;
var currentWeather;
var condensedWeather;

jQuery(document).ready(function ($) {
    $("#currWeek").scrollLeft($("time-card").width() * 4 / 5);

    $.when(
        $.ajax({
            url: "https://api.weatherbit.io/v2.0/forecast/daily?postal_code=" + zip + "&units=I&key=b108fbca3895480ca922d549707433fc",
            dataType: "jsonp",
            success: function (parsed_json) {
                forecastWeather = parsed_json["data"];
            },
        }),
        $.ajax({
            url: "https://api.weatherbit.io/v2.0/current?postal_code=" + zip + "&units=I&key=b108fbca3895480ca922d549707433fc",
            dataType: "jsonp",
            success: function (parsed_json) {
                currentWeather = parsed_json["data"][0];
            },
        })).done(function () {
            condensedWeather = [{
                "datetime": currentWeather["ob_time"].substring(0, currentWeather["ob_time"].indexOf(" ")),
                "weather": {
                    "icon": changeIcon(currentWeather["weather"]["icon"])
                },
                "min_temp": currentWeather["temp"],
                "max_temp": currentWeather["temp"]
            }];
            forecastWeather.forEach(function (day) {
                var newWeather = {
                    "datetime": day["datetime"],
                    "weather": {
                        "icon": changeIcon(day["weather"]["icon"])
                    },
                    "min_temp": day["min_temp"],
                    "max_temp": day["max_temp"]
                };
                condensedWeather.push(newWeather);
            });
            document.querySelectorAll(".curNextWeek").forEach(function (e) {
                e.setAttribute("weatherData", JSON.stringify(condensedWeather));
            });
        });

    function changeIcon(icon) {
        return icon.replace('n', 'd');
    }
});
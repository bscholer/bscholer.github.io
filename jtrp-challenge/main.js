/*
Author: Ben Scholer
License: MIT

At first, I considered using a data structure such as a quadtree or k-d-tree, which would allow for performance of around
O(log(n)). However, after testing a brute force approach that runs at O(n), and with a few performance improvements,
I saw that it ran at around 2 KHz, so I saw no need to make use of a more complex data structure.

Performance improvements:
At first, I was using a very simple distance function, basically finding the length of the hypotenuse between the two points.
This worked great, however I needed the distance in miles. Because of this, I added a function I found that finds the
distance in miles.
The problem with this approach though was that finding the distance in miles required a lot more math, and was therefore
significantly less performant. To combat this, I ended up using the simple distance function for finding the closest point,
and only use the function that returns miles for the user output.
 */

const production = true;

class Refpoints {
    // Loading in the points takes a bit of time and is done in a different thread, so we need a callback.
    constructor(points) {
        this.refpointsArr = points;
    }

    findClosest(searchPoint) {
        let closest, closestDist = 1000000, ctr = 0;

        // For each point in the CSV
        for (let point of this.refpointsArr) {
            ctr++;
            // Use the fast, simple distance function for the bulk of the math
            // Using the one that returns miles takes WAY longer
            let distBetween = this.quickDist(point, searchPoint);
            if (closestDist > distBetween) {
                closest = point;
                closestDist = distBetween;
            }
        }

        // Only use the more complex function that returns the distance in miles for the user output.
        closest.dist = this.distance(closest, searchPoint);
        // No need to return this since it's pass-by-reference.
        searchPoint.closest = closest;
    }

    // Print info about the closest refpoint to the search point
    printClosest(searchPoint) {
        let str = "-------- Closest Point to GPS location --------";
        str += "<br/>Point ID: " + searchPoint.closest.id;
        str += "<br/>Route and Direction: " + searchPoint.closest.name;
        str += "<br/>Milepost: " + searchPoint.closest.mm;
        str += "<br/>Heading: " + searchPoint.closest.heading;
        str += "<br/>Distance: " + searchPoint.closest.dist.toFixed(2) + " miles";
        str += "<br/>Lat, Lon: " + searchPoint.closest.lat + ", " + searchPoint.closest.lon;
        return str;
    }

    // Simple and fast distance function (c = sqrt(a^2 + b^2)) using the Pythagorean theorem
    quickDist(point1, point2) {
        return Math.sqrt(Math.pow(point1.lat - point2.lat, 2) + Math.pow(point1.lon - point2.lon, 2));
    }

    // More complex distance function that returns miles
    // From https://www.geodatasource.com/developers/javascript
    distance(point1, point2, unit) {
        var lat1 = point1.lat,
            lon1 = point1.lon,
            lat2 = point2.lat,
            lon2 = point2.lon;
        if ((lat1 == lat2) && (lon1 == lon2)) {
            return 0;
        } else {
            var radlat1 = Math.PI * lat1 / 180;
            var radlat2 = Math.PI * lat2 / 180;
            var theta = lon1 - lon2;
            var radtheta = Math.PI * theta / 180;
            var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
            if (dist > 1) {
                dist = 1;
            }
            dist = Math.acos(dist);
            dist = dist * 180 / Math.PI;
            dist = dist * 60 * 1.1515;
            if (unit == "K") {
                dist = dist * 1.609344
            }
            if (unit == "N") {
                dist = dist * 0.8684
            }
            if (dist < .1) {
                return dist;
            } else return dist;
        }
    }
}

var count = 0; // Cache the running count
refpoints = []; // Store the parsed points in here

let CSVURL = (production) ? "https://bscholer.github.io/jtrp-challenge/data.csv" : "http://127.0.0.1:8081/jtrp-challenge/data.csv";

// Parse the CSV file
Papa.parse(CSVURL, {
    header: true, // The CSV file has a header
    dynamicTyping: true, // Makes my life a little easier
    download: true,
    // worker: true,
    step: function (result) {
        // Add the point to the array and increment the count.
        refpoints.push(result.data);
        count++;
    },
    complete: function (results, file) { // For some reason, the results object does not behave as expected, hence the refpoints array.
        let refPointsObj = new Refpoints(refpoints);

        if (navigator.geolocation) {
            let findClosestToGPS = function () {
                navigator.geolocation.getCurrentPosition((position) => {
                    // Parse the lat and lon to floats
                    lat = position.coords.latitude;
                    lon = position.coords.longitude;

                    // Make a new search point
                    let searchPoint = {lat: lat, lon: lon};
                    console.log(searchPoint);

                    // Find the closest reference point to the given search point
                    refPointsObj.findClosest(searchPoint);

                    // Print the closest point
                    let str = refPointsObj.printClosest(searchPoint);
                    $("#output").html(str);
                })
            }
            let x = setInterval(findClosestToGPS, 1000)
        } else {
            alert("Sorry, you're browser isn't supported.");
        }


    }
});

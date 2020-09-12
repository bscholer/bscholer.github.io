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


Papa = require("papaparse");        // For parsing the CSV
dayjs = require("dayjs");           // For calculating runtimes (I could've done this with native JS, but I really like this library)
fs = require("fs");                 // For reading the CSV file
readline = require("readline")      // For reading stdin



// For generating random points for stress testing
const MAX_LAT = 41.76226974, MAX_LON = -84.79161827, MIN_LAT = 37.78268022, MIN_LON = -88.02119017;
// Configure readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});


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
        console.log("\n-------- Closest Point to " + searchPoint.lat.toFixed(8) + ", " +
            searchPoint.lon.toFixed(8) + " --------");
        console.log("Point ID: " + searchPoint.closest.id);
        console.log("Route and Direction: " + searchPoint.closest.name);
        console.log("Milepost: " + searchPoint.closest.mm);
        console.log("Heading: " + searchPoint.closest.heading);
        console.log("Distance: " + searchPoint.closest.dist.toFixed(2) + " miles");
        console.log("Lat, Lon: " + searchPoint.closest.lat + ", " + searchPoint.closest.lon);
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

console.log("Initializing...");
// Get the initialization start time
var start1 = dayjs();

const file = fs.createReadStream('data.csv'); // Create the file
var count = 0; // Cache the running count
refpoints = []; // Store the parsed points in here

// Parse the CSV file
Papa.parse(file, {
    header: true, // The CSV file has a header
    dynamicTyping: true, // Makes my life a little easier
    step: function (result) {
        // Add the point to the array and increment the count.
        refpoints.push(result.data);
        count++;
    },
    complete: function (results, file) { // For some reason, the results object does not behave as expected, hence the refpoints array.
        let refPointsObj = new Refpoints(refpoints);

        console.log("Ready! Initialization took " + dayjs().diff(start1, "ms") + "ms for " + refPointsObj.refpointsArr.length + " points");

        console.log("\n-------- MENU --------");
        rl.question("1) Manually input search points\n2) Speed test (random search points)\nOption: ", (input) => {
            switch (input) {
                case "1":
                    rl.question("Search point lat: ", (lat) => {
                        rl.question("Search point lon: ", (lon) => {
                            // Parse the lat and lon to floats
                            lat = parseFloat(lat);
                            lon = parseFloat(lon);

                            // Get the start time
                            let startTime = dayjs();

                            // Make a new search point
                            let searchPoint = {lat: lat, lon: lon};

                            // Find the closest reference point to the given search point
                            refPointsObj.findClosest(searchPoint);

                            // Stop the clock
                            let time = dayjs().diff(startTime, 'ms');

                            // Print the closest point
                            refPointsObj.printClosest(searchPoint);

                            // Print stats
                            stats(time, 1);

                            // Eww, the stream was still open??
                            rl.close();
                        })
                    })

                    break;
                case "2":
                    rl.question("Number of random points to generate in Indiana: ", (num) => {
                        // Parse the input to an int
                        let n = parseInt(num);

                        // Generate n random points to search for
                        let searchPoints = [];
                        for (let i = 0; i < n; i++) {
                            searchPoints.push({
                                lat: getRandNum(MIN_LAT, MAX_LAT),
                                lon: getRandNum(MIN_LON, MAX_LON)
                            })
                        }

                        console.log("Searching for closest neighbor of " + searchPoints.length + " points");

                        // Get the start time
                        let startTime = dayjs();

                        // Brute force search O(n) :/
                        for (let searchPoint of searchPoints) {
                            // Find the closest reference point to the given search point
                            refPointsObj.findClosest(searchPoint);
                        }

                        // Stop the clock
                        let time = dayjs().diff(startTime, 'ms');
                        // Print pretty stats
                        stats(time, n);

                        // Eww, the stream was still open??
                        rl.close();
                    });
                    break;
            }
        });
    }
});

// Print some stats
function stats(time, n) {
    console.log("\n-------- STATISTICS --------");
    console.log("Runtime for " + n + " point(s): " + time + "ms");
    console.log("Speed: " + Math.round(n / (time / 1000)) + " Hz");
}

// Used for generating random points
function getRandNum(min, max) {
    return Math.random() * (max - min) + min;
}


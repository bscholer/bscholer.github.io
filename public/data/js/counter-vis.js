var themes = [
    //teal -> teal
    ["#03DAC6", "#6200EE", "teal-purple"],
    //light blue -> dark blue
    ["#E1F5FE", "#01579B", "light-blue-dark-blue"],
    //yellow -> orange
    ["#FFEE58", "#FF7043", "yellow-orange"]
];
const DEFAULT_TYPE = 0;
const DEFAULT_THEME = 0;

function submitListener() {
    console.log("Hi");
    var dataType = getRadioVal(document.getElementById("data-form"), "data");
    //var themeType = getRadioVal(document.getElementById("theme-form"), "theme");
    dataType = parseInt(dataType);
    //themeType = parseInt(themeType);
    main(dataType, DEFAULT_THEME);
}

var descriptor = document.getElementById("descriptor");
var dataArea = document.getElementById("data");

main(DEFAULT_TYPE, DEFAULT_THEME);

/*
Types:
0: Unemployment Rate
1: Household Income
 */
function main(type, theme) {
    let map = document.getElementById("map");
    if (map) {
        console.log(map.getAttribute("mapType"));
        if (map.getAttribute("mapType") !== type + "" || map.getAttribute("themeType") !== theme + "") {
            map.parentNode.removeChild(map);
            document.getElementById("page-title").innerText = "";
			document.getElementById("legend-container").style.display = "none";
			document.getElementById("loader").style.display = "block";
        } else {
            return;
        }
    }

    $.when(loadUnemployment(), loadEducation(), loadPoverty(), loadUS(), loadFIPS()).done(
        function (unemployment, education, poverty, us, fips) {
            //Pull the arrays from the responses
            unemployment = unemployment[0];
            education = education[0];
            poverty = poverty[0];
            us = us[0];
            fips = fips[0];

            //Calculate percentages and domains
            let unemploymentRateDomain = [1000000000000, 0];
            let householdIncomeDomain = [100000, 0];
            let povertyAllAgesDomain = [100, 0];
            let povertyMinorDomain = [100, 0];
            let educationLTHSDDomain = [100, 0];
            let educationHSDODomain = [100, 0];
            let educationSCADDomain = [100, 0];
            let educationBDHDomain = [100, 0];
            unemployment.forEach(function (area) {
                area.UnemploymentRate = area.Unemployed;
                if (area.UnemploymentRate > 0) {
                    if (area.UnemploymentRate < unemploymentRateDomain[0]) unemploymentRateDomain[0] = area.UnemploymentRate;
                    if (area.UnemploymentRate > unemploymentRateDomain[1]) unemploymentRateDomain[1] = area.UnemploymentRate;
                }
            });
            poverty.forEach(function (area) {
                if (area.MedianHouseholdIncome > 1 && area.MedianHouseholdIncome < 1000000) {
                    if (area.MedianHouseholdIncome < householdIncomeDomain[0]) householdIncomeDomain[0] = area.MedianHouseholdIncome;
                    if (area.MedianHouseholdIncome > householdIncomeDomain[1]) householdIncomeDomain[1] = area.MedianHouseholdIncome;
                }
                if (area.AllAgesPovertyPercent) {
                    if (area.AllAgesPovertyPercent < povertyAllAgesDomain[0]) povertyAllAgesDomain[0] = area.AllAgesPovertyPercent;
                    if (area.AllAgesPovertyPercent > povertyAllAgesDomain[1]) povertyAllAgesDomain[1] = area.AllAgesPovertyPercent;
                }
                if (area.MinorPovertyPercent) {
                    if (area.MinorPovertyPercent < povertyMinorDomain[0]) povertyMinorDomain[0] = area.MinorPovertyPercent;
                    if (area.MinorPovertyPercent > povertyMinorDomain[1]) povertyMinorDomain[1] = area.MinorPovertyPercent;
                }
            });
            education.forEach(function (area) {
                let totalPop = area.LTHSD + area.HSDO + area.SCAD + area.BDH;
                area.LTHSDPercent = area.LTHSD / totalPop * 100;
                area.HSDOPercent = area.HSDO / totalPop * 100;
                area.SCADPercent = area.SCAD / totalPop * 100;
                area.BDHPercent = area.BDH / totalPop * 100;
                if (area.LTHSDPercent < educationLTHSDDomain[0]) educationLTHSDDomain[0] = area.LTHSDPercent;
                if (area.LTHSDPercent > educationLTHSDDomain[1]) educationLTHSDDomain[1] = area.LTHSDPercent;

                if (area.HSDOPercent < educationHSDODomain[0]) educationHSDODomain[0] = area.HSDOPercent;
                if (area.HSDOPercent > educationHSDODomain[1]) educationHSDODomain[1] = area.HSDOPercent;

                if (area.SCADPercent < educationSCADDomain[0]) educationSCADDomain[0] = area.SCADPercent;
                if (area.SCADPercent > educationSCADDomain[1]) educationSCADDomain[1] = area.SCADPercent;

                if (area.BDHPercent < educationBDHDomain[0]) educationBDHDomain[0] = area.BDHPercent;
                if (area.BDHPercent > educationBDHDomain[1]) educationBDHDomain[1] = area.BDHPercent;
            });
            // console.log(unemployment);
            // console.log(education);
            // console.log(poverty);
            // console.log(us);
            // console.log(fips);

            //Use the correct data, and set the disclaimer
            let disclaimerText, domain, title;
            switch (type) {
                case 0:
                    disclaimerText = "unemployment rates";
                    title = "Unemployment Rate";
                    domain = unemploymentRateDomain;
                    break;
                case 1:
                    disclaimerText = "median household income";
                    title = "Median Household Income";
                    domain = householdIncomeDomain;
                    break;
                case 2:
                    disclaimerText = "poverty for all ages";
                    title = "Percent in Poverty - All Ages";
                    domain = povertyAllAgesDomain;
                    break;
                case 3:
                    disclaimerText = "poverty for ages 0-17";
                    title = "Percent in Poverty - Ages 0-17";
                    domain = povertyMinorDomain;
                    break;
                case 4:
                    disclaimerText = "percentages of people with less than a high school diploma";
                    title = "Percent with Less than a High School Diploma";
                    domain = educationLTHSDDomain;
                    break;
                case 5:
                    disclaimerText = "percentages of people with a high school diploma only";
                    title = "Percent with a High School Diploma Only";
                    domain = educationHSDODomain;
                    break;
                case 6:
                    disclaimerText = "percentages of people with some college (1-3 years)";
                    title = "Percent with Some College (1-3 years)";
                    domain = educationSCADDomain;
                    break;
                case 7:
                    disclaimerText = "percentages of people with a bachelor's degree or higher";
                    title = "Percent with a Bachelor's Degree or Higher";
                    domain = educationBDHDomain;
                    break;
            }

            //Set the disclaimer
            document.getElementById("verbose-disclaimer").innerText = disclaimerText;

            //Set the page title
            document.getElementById("page-title").innerText = title;

            console.log(domain);
            //Set the legend
            document.getElementById("legend-min-val").innerText =
                ((type === 1) ? "$" : "") + domain[0].toFixed(0) + ((type === 1) ? "" : "");
            document.getElementById("legend-max-val").innerText =
                ((type === 1) ? "$" : "") + domain[1].toFixed(0) + ((type === 1) ? "" : "");
            // console.log("linear-gradient(to right, " + themes[theme][0] + ", " + themes[theme][1] + ")");
            console.log(document.getElementById("legend"));

            themes.forEach(function (themeData) {
                $("#legend").removeClass(themeData[2]);
            });
            $("#legend").addClass(themes[theme][2]);
			document.getElementById("legend-container").style.display = "grid";
            document.getElementById("loader").style.display = "none";

            //Draw the map
            var width = 960,
                height = 500;

            var fill = d3.scale.log()
                .domain(domain)
                .range(themes[theme]);

            var path = d3.geo.path();

            var svg = d3.select("body").append("svg")
                .attr("width", width)
                .attr("height", height)
                .attr("id", "map")
                .attr("mapType", type)
                .attr("themeType", theme)
                .attr("class", "data-element");

            svg.append("g")
                .attr("class", "counties")
                .selectAll("path")
                .data(topojson.feature(us, us.objects.counties).features)
                .enter().append("path")
                .attr("d", path)
                .style("fill", function (d) {
                    var val;
                    //Add data to each county
                    unemployment.forEach(function (areaData) {
                        if (areaData.FIPS === d.id + "") {
                            d.properties.Unemployment = areaData;
                        }
                    });
                    education.forEach(function (areaData) {
                        if (areaData.FIPS === d.id + "") {
                            d.properties.Education = areaData;
                        }
                    });
                    poverty.forEach(function (areaData) {
                        if (areaData.FIPS === d.id + "") {
                            d.properties.Poverty = areaData;
                        }
                    });
                    fips.forEach(function (areaData) {
                        if (areaData.FIPS === d.id) {
                            d.properties.Area = {
                                "State": areaData.State,
                                "County": areaData.Area.match(/[a-zA-Z\s]+(?=,\s[A-Z])/),
                            };
                        }
                    });

                    //Use the correct data
                    switch (type) {
                        case 0:
                            if (d.properties.Unemployment) {
                                val = d.properties.Unemployment.UnemploymentRate;
                            }
                            break;
                        case 1:
                            if (d.properties.Poverty) {
                                val = d.properties.Poverty.MedianHouseholdIncome;
                            }
                            break;
                        case 2:
                            if (d.properties.Poverty) {
                                val = d.properties.Poverty.AllAgesPovertyPercent;
                            }
                            break;
                        case 3:
                            if (d.properties.Poverty) {
                                val = d.properties.Poverty.MinorPovertyPercent;
                            }
                            break;
                        case 4:
                            if (d.properties.Education) {
                                val = d.properties.Education.LTHSDPercent;
                            }
                            break;
                        case 5:
                            if (d.properties.Education) {
                                val = d.properties.Education.HSDOPercent;
                            }
                            break;
                        case 6:
                            if (d.properties.Education) {
                                val = d.properties.Education.SCADPercent;
                            }
                            break;
                        case 7:
                            if (d.properties.Education) {
                                val = d.properties.Education.BDHPercent;
                            }
                            break;
                    }

                    if (!val) return "#336DDA";
                    return fill(val);
                })
                // .on("mouseover", handleMouseOver)
                .on("mouseover", handleMouseOver)
                .on("mouseout", handleMouseOut);

            svg.append("path")
                .datum(topojson.mesh(us, us.objects.states, function (a, b) {
                    return a.id !== b.id;
                }))
                .attr("class", "states")
                .attr("d", path);

            //Put the map in a container
            map = document.getElementById("map");
            let container = document.getElementById("container");
            container.appendChild(map);
        });
}

function handleMouseOver(d, i) {
    let props = d.properties;
    console.log(d);
    if (props.Area) {
        descriptor.innerText = props.Area.County + ", " + props.Area.State;
    } else {
        descriptor.innerText = "No data";
    }
    let dataStr = "";
    if (props.Unemployment) {
        dataStr += "<b>Unemployment</b><br>";
        dataStr += "Unemployment Rate: <b>" + props.Unemployment.UnemploymentRate + "</b><br>";
    }
    if (props.Poverty) {
        dataStr += "<br><b>Poverty</b><br>";
        dataStr += "Household Income: <b>$" + props.Poverty.MedianHouseholdIncome + "</b><br>";
        dataStr += "Poverty - All Ages: <b>" + props.Poverty.AllAgesPovertyPercent.toFixed(0) + "%</b><br>";
        dataStr += "Poverty - Ages 0-17: <b>" + props.Poverty.MinorPovertyPercent.toFixed(0) + "%</b><br>";
    }
    if (props.Education) {
        dataStr += "<br><b>Education</b><br>";
        dataStr += "Less than a High School Diploma: <b>" + props.Education.LTHSDPercent.toFixed(1) + "%</b><br>";
        dataStr += "High School Diploma Only: <b>" + props.Education.HSDOPercent.toFixed(1) + "%</b><br>";
        dataStr += "Some College (1-3 years): <b>" + props.Education.SCADPercent.toFixed(1) + "%</b><br>";
        dataStr += "Bachelor's degree or higher: <b>" + props.Education.BDHPercent.toFixed(1) + "%</b><br>";
    }
    dataArea.innerHTML = dataStr;
}

function handleMouseOut(d, i) {

}

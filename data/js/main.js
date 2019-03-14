function downloadPoverty() {
    var newData = [];
    $.ajax({
        type: "GET",
        url: "data/poverty.json",
        data: {get_param: 'value'},
        dataType: "json",
        success: function (data) {
            console.log(data);
            data.forEach(function (area) {
                let newArea = {
                    "FIPS": area["FIPStxt"] + "",
                    "AllAgesPoverty": area["POVALL_2016"],
                    "AllAgesPovertyPercent": area["PCTPOVALL_2016"],
                    "MinorPoverty": area["POV017_2016"],
                    "MinorPovertyPercent": area["PCTPOV017_2016"],
                    "MedianHouseholdIncome": area["MEDHHINC_2016"],
                };
                newData.push(newArea);
            });
            document.getElementById("dump").innerText = JSON.stringify(newData);
            console.log(newData);
        }
    })
}

function downloadEducation() {
    var newData = [];
    $.ajax({
        type: "GET",
        url: "data/education.json",
        data: {get_param: 'value'},
        dataType: "json",
        async: "false",
        success: function (data) {
            console.log(data);
            data.forEach(function (area) {
                let newArea = {
                    "FIPS": area["FIPS Code"] + "",
                    "years": [
                        {
                            "year": "1970",
                            "LTHSD": area["LTHSD 1970"],
                            "HSDO": area["HSDO 1970"],
                            "SCAD": area["SCAD 1970"],
                            "BDH": area["BDH, 1970"]
                        },
                        {
                            "year": "1980",
                            "LTHSD": area["LTHSD 1980"],
                            "HSDO": area["HSDO 1980"],
                            "SCAD": area["SCAD 1980"],
                            "BDH": area["BDH, 1980"]
                        },
                        {
                            "year": "1990",
                            "LTHSD": area["LTHSD 1990"],
                            "HSDO": area["HSDO 1990"],
                            "SCAD": area["SCAD 1990"],
                            "BDH": area["BDH, 1990"]
                        },
                        {
                            "year": "2000",
                            "LTHSD": area["LTHSD 2000"],
                            "HSDO": area["HSDO 2000"],
                            "SCAD": area["SCAD 2000"],
                            "BDH": area["BDH, 2000"]
                        },
                        {
                            "year": "2016",
                            "LTHSD": area["LTHSD 2012-2016"],
                            "HSDO": area["HSDO 2012-2016"],
                            "SCAD": area["SCAD 2012-2016"],
                            "BDH": area["BDH, 2012-2016"]
                        }
                    ]
                };
                newData.push(newArea);
            });
            document.getElementById("dump").innerText = JSON.stringify(newData);
            console.log(newData);
        }
    });
}

function downloadUnemployment() {
    var newData = [];
    $.ajax({
        type: "GET",
        url: "data/unemployment.json",
        data: {get_param: 'value'},
        dataType: "json",
        async: "false",
        success: function (data) {
            console.log(data);
            data.forEach(function (area) {
                let newArea = {
                    "FIPS": area["FIPStxt"] + "",
                    "LaborForce": area["Civilian_labor_force_2016"],
                    "Employed": area["Employed_2016"],
                    "Unemployed": area["Unemployed_2016"],
                };
                newData.push(newArea);
            });
            document.getElementById("dump").innerText = JSON.stringify(newData);
            console.log(newData);
        }
    });

}

function loadUnemployment() {
    return $.ajax({
        type: "GET",
        url: "data/unemployment2016.json",
        data: {get_param: "value"},
        dataType: "json",
        async: "false",
        success: function (data) {
        }
    });
}

function loadPoverty() {
    return $.ajax({
        type: "GET",
        url: "data/poverty2016.json",
        data: {get_param: "value"},
        dataType: "json",
        async: "false",
        success: function (data) {
        }
    });
}

function loadEducation() {
    return $.ajax({
        type: "GET",
        url: "data/education2016.json",
        data: {get_param: "value"},
        dataType: "json",
        async: "false",
        success: function (data) {
        }
    });
}

function loadUS() {
    return $.ajax({
        type: "GET",
        url: "data/us.json",
        data: {get_param: "value"},
        dataType: "json",
        async: "false",
        success: function (data) {
        }
    });
}

function loadFIPS() {
    return $.ajax({
        type: "GET",
        url: "data/fips.json",
        data: {get_param: "value"},
        dataType: "json",
        async: "false",
        success: function (data) {
        }
    });
}

function getRadioVal(form, name) {
    var radios = form.querySelectorAll("input");
    var val;

    for (var i = 0, len = radios.length; i < len; i++) {
        if (radios[i].checked === true) {
            val = radios[i].value;
            break;
        }
    }
    return val;
}

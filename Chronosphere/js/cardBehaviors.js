function openTimePicker(input) {
    currentTimeInput = input;
    timePicker = document.getElementById("timePicker");
    timePickerDialog = document.getElementById("timePickerDialog");
    timePicker.value = currentTimeInput.value;
    timePickerDialog.toggle();
}

function closeTimePicker(button) {
    //TODO This should update the DB
    //TODO force in time to be before out time
    if (button.id === "timePickerClear") {
        currentTimeInput.value = "";
    } else {
        console.log("Trying to set the time to " + timePicker.time);
        currentTimeInput.value = timePicker.time;
        // currentTimeInput.hour = "" + timePicker.hour;
        // currentTimeInput.min = "" + timePicker.minute;
        // currentTimeInput.amPm = timePicker.period;
    }
    currentTimeInput = null;
}

function init() {
    var zip = "46793";
    var temp;

    var currentTimeInput;
    var timePicker;
    var timePickerDialog;

    var monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    var d = new Date();

    document.getElementById("mondayHeading").innerText = monthNames[d.getMonth()] + " " + d.getDay();
}

jQuery(document).ready(function ($) {
    $.ajax({
        url: "http://api.wunderground.com/api/11174fa7be59d747/geolookup/conditions/q/" + zip + ".json",
        dataType: "jsonp",
        success: function (parsed_json) {
            temp = parsed_json['current_observation']['temp_f'];
            document.getElementById("temp").innerText = temp;
        }
    });
});
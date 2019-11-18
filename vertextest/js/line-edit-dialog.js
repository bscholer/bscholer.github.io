// Find the modal
let lineEditModal = document.getElementById("line-edit-dialog");

// Find the close button
let lineEditCloseButton = document.getElementById("line-edit-dialog-close-button");

// Find the elements in the dialog
let lineEditTypeSelect = document.getElementById("line-edit-type-select");
let lineEditNameInput = document.getElementById("line-edit-name-input");
let lineEditColorSelect = document.getElementById("line-edit-color-select");
let lineEditStrokeSelect = document.getElementById("line-edit-stroke-select");
let lineEditWeightInput = document.getElementById("line-edit-weight-input");
let lineEditBiDirectionalityInput = document.getElementById("line-edit-bi-directionality-input");

// Open up the dialog
function openLineEditDialog() {
    // Figure out the lineID we're editing
    let lineTooltip = document.getElementById("line-tooltip");
    let lineID = lineTooltip.lineID;

    // Set the display
    let lineEditDialog = document.getElementById("line-edit-dialog");
    lineEditDialog.style.display = "block";

    // Populate it
    populateLineEditDialog(lineID);
}

// Populate the edit dialog
function populateLineEditDialog(lineID) {
    // Populate colors
    populateColorSelect(lineEditColorSelect);

    // Get the line object
    let line = findLine(lineID);

    // Set the title
    let lineEditTitle = document.getElementById("line-edit-dialog-title");
    lineEditTitle.innerText = "Edit Line #" + lineID + " (" + line.name + ")";

    // Add in line types
    while (lineEditTypeSelect.firstChild) {
        lineEditTypeSelect.removeChild(lineEditTypeSelect.firstChild);
    }
    for (let lineType of features.lineTypes) {
        let newLineTypeOption = document.createElement("option");
        newLineTypeOption.value = lineType.lineTypeID;
        newLineTypeOption.innerText = lineType.name;
        lineEditTypeSelect.appendChild(newLineTypeOption);
    }

    // Set everything else
    lineEditTypeSelect.value = line.lineTypeID;
    lineEditNameInput.value = line.name;
    lineEditColorSelect.value = line.color;
    lineEditStrokeSelect.value = line.stroke;
    lineEditWeightInput.value = line.weight;
    lineEditBiDirectionalityInput.value = line.bi_directionality;
}

// Called when the user changes the type of a line
function lineEditChangeType() {
    let lineID = document.getElementById("line-tooltip").lineID;

    // Get the lineType object
    let lineType;
    for (let lineTypeI of features.lineTypes) {
        if (lineEditTypeSelect.value === lineTypeI.lineTypeID) {
            lineType = lineTypeI;
        }
    }

    // Find the right line and change its attributes.
    for (let line of features.lines) {
        if (line.lineID === lineID) {
            line.lineTypeID = lineEditTypeSelect.value;
            line.color = lineType.color;
            line.stroke = lineType.stroke;
            line.weight = lineType.weight;
        }
    }

    // Repopulate the dialog
    populateLineEditDialog(lineID);

    // Redraw
    reset(svg);
}

// Save the lines
function autoSaveLines() {
    let lineID = document.getElementById("line-tooltip").lineID;

    for (let line of features.lines) {
        if (line.lineID === lineID) {
            // Set stuff
            line.name = lineEditNameInput.value;
            line.color = lineEditColorSelect.value;
            line.stroke = lineEditStrokeSelect.value;
            line.weight = lineEditWeightInput.value;
            line.bi_directionality = lineEditBiDirectionalityInput.value;
        }
    }

    // Repopulate the dialog
    populateLineEditDialog(lineID);

    // Update the title of the tooltip
    document.getElementById("line-tooltip-title").innerText = lineEditNameInput.value;

    // Redraw
    reset(svg);
}

// When the user clicks on <span> (x), close the lineEditModal
lineEditCloseButton.onclick = function () {
    lineEditModal.style.display = "none";
};

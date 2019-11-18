// Find the modal
let nodeEditModal = document.getElementById("node-edit-dialog");

// Find the close button
let closeButton = document.getElementById("node-edit-dialog-close-button");

// Find the elements in the dialog
let nodeEditTypeSelect = document.getElementById("node-edit-type-select");
let nodeEditNameInput = document.getElementById("node-edit-name-input");
let nodeEditShapeSelect = document.getElementById("node-edit-shape-select");
let nodeEditColorSelect = document.getElementById("node-edit-color-select");
let nodeEditSizeInput = document.getElementById("node-edit-size-input");
let nodeEditPositionInput = document.getElementById("node-edit-position-input");

// Open up the dialog
function openNodeEditDialog() {
    // Figure out the nodeID we're editing
    let nodeTooltip = document.getElementById("node-tooltip");
    let nodeID = nodeTooltip.nodeID;

    // Set the display
    let nodeEditDialog = document.getElementById("node-edit-dialog");
    nodeEditDialog.style.display = "block";

    // Populate it
    populateNodeEditDialog(nodeID);
}

// Populate the edit dialog
function populateNodeEditDialog(nodeID) {
    // Populate colors
    populateColorSelect(nodeEditColorSelect);

    // Get the node object
    let node = findNode(nodeID);

    // Set the title
    let nodeEditTitle = document.getElementById("node-edit-dialog-title");
    nodeEditTitle.innerText = "Edit Node #" + nodeID + " (" + node.name + ")";

    // Add in node types
    while (nodeEditTypeSelect.firstChild) {
        nodeEditTypeSelect.removeChild(nodeEditTypeSelect.firstChild);
    }
    for (let nodeType of features.nodeTypes) {
        let newNodeTypeOption = document.createElement("option");
        newNodeTypeOption.value = nodeType.nodeTypeID;
        newNodeTypeOption.innerText = nodeType.name;
        nodeEditTypeSelect.appendChild(newNodeTypeOption);
    }

    // Set everything else
    nodeEditTypeSelect.value = node.nodeTypeID;
    nodeEditNameInput.value = node.name;
    nodeEditShapeSelect.value = node.shape;
    nodeEditColorSelect.value = node.color;
    nodeEditSizeInput.value = node.size;
    nodeEditPositionInput.value = node.x + ", " + node.y;
}

// Called when the user changes the type of a node
function nodeEditChangeType() {
    let nodeID = document.getElementById("node-tooltip").nodeID;

    // Get the nodeType object
    let nodeType;
    for (let nodeTypeI of features.nodeTypes) {
        if (nodeEditTypeSelect.value === nodeTypeI.nodeTypeID) {
            nodeType = nodeTypeI;
        }
    }

    // Find the right node and change its attributes
    for (let node of features.nodes) {
        if (node.nodeID === nodeID) {
            node.nodeTypeID = nodeEditTypeSelect.value;
            node.color = nodeType.color;
            node.shape = nodeType.shape;
        }
    }

    // Repopulate the dialog
    populateNodeEditDialog(nodeID);

    // Redraw
    reset(svg);
}

// Save the lines
function autoSaveNodes() {
    let nodeID = document.getElementById("node-tooltip").nodeID;

    for (let node of features.nodes) {
        if (node.nodeID === nodeID) {
            // Set stuff
            node.name = nodeEditNameInput.value;
            node.shape = nodeEditShapeSelect.value;
            node.size = nodeEditSizeInput.value;
            node.color = nodeEditColorSelect.value;
            node.x = nodeEditPositionInput.value.match(/([0-9]+), ?([0-9]+)/)[1];
            node.y = nodeEditPositionInput.value.match(/([0-9]+), ?([0-9]+)/)[2];
        }
    }

    // Repopulate the dialog
    populateNodeEditDialog(nodeID);

    // Update the title of the tooltip
    document.getElementById("node-tooltip-title").innerText = nodeEditNameInput.value;

    // Redraw
    reset(svg);
}

// When the user clicks on <span> (x), close the nodeEditModal
closeButton.onclick = function () {
    nodeEditModal.style.display = "none";
};

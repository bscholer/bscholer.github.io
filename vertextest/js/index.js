// Masking a few inputs throughout the site, preventing users from entering huge numbers.
$(document).ready(function () {
    $("#line-edit-weight-input").mask('00');
    $("#line-weight-input").mask('00');
    $("#node-edit-size-input").mask('00');
});

let floorPlanBackground = document.querySelector('#floor-plan-background');

// Get the defaults' selects
let defaultLineTypeSelect = document.getElementById("default-line-type-select");
let defaultNodeTypeSelect = document.getElementById("default-node-type-select");

// Create the features variable
var features = {
    floorPlanBounds: {},
    nodes: [],
    lines: [],
    floorPlanSrc: "floor%20plan.jpg",
    lineTypes: [
        {
            lineTypeID: "0",
            name: "line0",
            color: "pink",
            weight: 5,
            stroke: "solid"
        },
        {
            lineTypeID: "1",
            name: "line1",
            color: "blue",
            weight: 5,
            stroke: "solid"
        },
        {
            lineTypeID: "2",
            name: "line2",
            color: "skyblue",
            weight: 5,
            stroke: "dashed"
        },
        {
            lineTypeID: "3",
            name: "line3",
            color: "green",
            weight: 5,
            stroke: "dashed"
        },
        {
            lineTypeID: "4",
            name: "line4",
            color: "teal",
            weight: 5,
            stroke: "dashed"
        },
        {
            lineTypeID: "5",
            name: "line5",
            color: "orange",
            weight: 5,
            stroke: "dashed"
        },
        {
            lineTypeID: "6",
            name: "line6",
            color: "lightsalmon",
            weight: 5,
            stroke: "dashed"
        },
        {
            lineTypeID: "7",
            name: "line7",
            color: "coral",
            weight: 5,
            stroke: "dotted"
        },
        {
            lineTypeID: "8",
            name: "line8",
            color: "blueviolet",
            weight: 5,
            stroke: "dotted"
        },
        {
            lineTypeID: "9",
            name: "line9",
            color: "crimson",
            weight: 5,
            stroke: "dotted"
        },
    ],
    nodeTypes: [
        {
            nodeTypeID: "0",
            name: "node0",
            shape: "circle",
            color: "red"
        },
        {
            nodeTypeID: "1",
            name: "node1",
            shape: "rect",
            color: "pink"
        },
        {
            nodeTypeID: "2",
            name: "node2",
            shape: "circle",
            color: "green"
        },
        {
            nodeTypeID: "3",
            name: "node3",
            shape: "circle",
            color: "orange"
        },
        {
            nodeTypeID: "4",
            name: "node4",
            shape: "circle",
            color: "teal"
        },
        {
            nodeTypeID: "5",
            name: "node5",
            shape: "circle",
            color: "lightsalmon"
        },
        {
            nodeTypeID: "6",
            name: "node6",
            shape: "circle",
            color: "purple"
        },
        {
            nodeTypeID: "7",
            name: "node7",
            shape: "circle",
            color: "blueviolet"
        },
        {
            nodeTypeID: "8",
            name: "node8",
            shape: "circle",
            color: "darkgreen"
        },
        {
            nodeTypeID: "9",
            name: "node9",
            shape: "circle",
            color: "skyblue"
        },
    ]
};

let nodeCounter = 0;
let lineCounter = 0;

// Used only if a click is starting a line
let lineStartNodeID;

// Listen for attribute changes to the floor plan background.
// For whatever reason, width and height weren't being updated when the src was set.
let floorPlanBackgroundObserver = new MutationObserver(function (mutations) {
    floorPlanBackground = document.querySelector('#floor-plan-background');
    features.floorPlanBounds.w = floorPlanBackground.width;
    features.floorPlanBounds.h = floorPlanBackground.height;
    svg.width = floorPlanBackground.width;
    svg.height = floorPlanBackground.height;
    reset(svg);
});

floorPlanBackgroundObserver.observe(floorPlanBackground, {
    attributes: true // Listen for attribute changes
});

// Populate the default line type select
for (let lineType of features.lineTypes) {
    let newLineTypeOption = document.createElement("option");
    newLineTypeOption.value = lineType.lineTypeID;
    newLineTypeOption.innerText = lineType.name;
    defaultLineTypeSelect.appendChild(newLineTypeOption);
}

// Populate the default node type select
for (let nodeType of features.nodeTypes) {
    let newNodeTypeOption = document.createElement("option");
    newNodeTypeOption.value = nodeType.nodeTypeID;
    newNodeTypeOption.innerText = nodeType.name;
    defaultNodeTypeSelect.appendChild(newNodeTypeOption);
}

if (localStorage.getItem("defaultLineType")) {
    defaultLineTypeSelect.value = localStorage.getItem("defaultLineType") + "";
} else {
    localStorage.setItem("defaultLineType", "0");
}

if (localStorage.getItem("defaultNodeType")) {
    defaultNodeTypeSelect.value = localStorage.getItem("defaultNodeType");
} else {
    localStorage.setItem("defaultNodeType", "0");
}

var svg = d3.select("#floor-plan-container").append("svg")
    .attr("width", floorPlanBackground.width)
    .attr("height", floorPlanBackground.height);

function openImage() {
    let file = document.querySelector('#floor-plan-upload-input').files[0];
    let reader = new FileReader();

    reader.addEventListener("load", function () {
        floorPlanBackground.src = reader.result;
        features.floorPlanSrc = reader.result;
    });

    if (file) {
        reader.readAsDataURL(file);
    }
}

function openDrawing() {
    let file = document.querySelector('#drawing-upload-input').files[0];
    let reader = new FileReader();

    reader.addEventListener("load", function () {
        // Parse the JSON
        let upload = JSON.parse(reader.result);

        // Use the uploaded data
        features.floorPlanSrc = upload.floorPlanSrc;
        features.floorPlanBounds = upload.floorPlanBounds;
        floorPlanBackground.src = features.floorPlanSrc;
        features.nodes = upload.nodes;

        let highestNodeID = 0;
        for (let node of features.nodes) {
            // Find the highest nodeID
            if (node.nodeID > highestNodeID) highestNodeID = node.nodeID;

            // Set all nodes to visible
            node.invisible = false;
        }

        features.lines = upload.lines;

        let highestLineID = 0;
        for (let line of features.lines) {
            // Find the highest lineID
            if (line.lineID > highestLineID) highestLineID = line.lineID;

            // Set all lines to visible
            line.invisible = false;
        }

        nodeCounter = highestNodeID;
        lineCounter = highestLineID;

        reset(svg);
    });

    if (file) {
        reader.readAsText(file);
    }
}

function openTypes() {
    let file = document.querySelector('#types-upload-input').files[0];
    let reader = new FileReader();

    reader.addEventListener("load", function () {
        // Parse the uploaded JSON
        let upload = JSON.parse(reader.result);

        // Do something with the data
        features.nodeTypes = upload.nodeTypes;
        features.lineTypes = upload.lineTypes;
        // Update the localStorage items
        localStorage.setItem("lineTypes", JSON.stringify(upload.lineTypes));
        localStorage.setItem("nodeTypes", JSON.stringify(upload.nodeTypes));

        // Update the node type select in the settings menu.
        while (nodeTypeSelect.firstChild) {
            nodeTypeSelect.removeChild(nodeTypeSelect.firstChild);
        }
        for (let nodeType of features.nodeTypes) {
            let newNodeTypeOption = document.createElement("option");
            newNodeTypeOption.value = nodeType.nodeTypeID;
            newNodeTypeOption.innerText = nodeType.name;
            nodeTypeSelect.appendChild(newNodeTypeOption);
        }

        // Update the node type select in the settings menu.
        while (lineTypeSelect.firstChild) {
            lineTypeSelect.removeChild(lineTypeSelect.firstChild);
        }
        for (let lineType of features.lineTypes) {
            let newLineTypeOption = document.createElement("option");
            newLineTypeOption.value = lineType.lineTypeID;
            newLineTypeOption.innerText = lineType.name;
            lineTypeSelect.appendChild(newLineTypeOption);
        }

        reset(svg);
    });

    if (file) {
        reader.readAsText(file);
    }
}

// Function for changing node type visibility.
function nodeVisibilityChange() {
    let nodeTypeID = document.getElementById("node-type-select").value;
    for (let node of features.nodes) {
        if (node.nodeTypeID === nodeTypeID) {
            // Add an invisible attribute to the nodes
            node.invisible = !document.getElementById("node-visibility").checked;
        }
    }

    // Redraw
    reset(svg);
}

// Function for changing line type visibility
function lineVisibilityChange() {
    let lineTypeID = document.getElementById("line-type-select").value;
    for (let line of features.lines) {
        if (line.lineTypeID === lineTypeID) {
            // Add an invisible attribute to the lines
            line.invisible = !document.getElementById("line-visibility").checked;
        }
    }

    // Redraw
    reset(svg);
}

// Called on change of the show floor plan checkbox.
function showFloorPlan() {
    floorPlanBackground.style.display = (document.getElementById("show-floor-plan-input").checked) ? "block" : "none";
}


// Handling clicks
svg.on("click", function () {
    // Get the coordinates of the click
    let coords = d3.mouse(this);

    // Find the tooltip DOM elements
    let nodeTooltip = document.getElementById("node-tooltip");
    let lineTooltip = document.getElementById("line-tooltip");

    // If the tooltip is open, close it, and absorb the click
    if (nodeTooltip.style.display === "block") {
        nodeTooltip.style.display = "none";
        nodeTooltip.nodeID = null;
        return;
    }

    // If the tooltip is open, close it, and absorb the click
    if (lineTooltip.style.display === "block") {
        lineTooltip.style.display = "none";
        lineTooltip.lineID = null;
        return;
    }

    // If there is a node collision, pull up the tooltip
    if (findNodeCollision(coords[0], coords[1])) {
        nodeTooltip.style.top = coords[1] + "px";
        nodeTooltip.style.left = coords[0] + "px";
        nodeTooltip.style.display = "block";
        nodeTooltip.nodeID = findNodeCollision(coords[0], coords[1], 100);
        let nodeTooltipTitle = document.getElementById("node-tooltip-title");
        nodeTooltipTitle.innerText = findNode(nodeTooltip.nodeID).name;
    }
    // If there is a line collision, pull up the tooltip
    else if (findLineCollision(coords[0], coords[1])) {
        lineTooltip.style.top = coords[1] + "px";
        lineTooltip.style.left = coords[0] + "px";
        lineTooltip.style.display = "block";
        lineTooltip.lineID = findLineCollision(coords[0], coords[1], 100);
        let lineTooltipTitle = document.getElementById("line-tooltip-title");
        lineTooltipTitle.innerText = findLine(lineTooltip.lineID).name;
    }

    //Make a new node
    else {
        let nodeTypeID = defaultNodeTypeSelect.value;
        let nodeType = getNodeType(nodeTypeID);

        // This is what will go in the features variable
        let newNode = {
            nodeTypeID: nodeTypeID,
            nodeID: ++nodeCounter,
            name: nodeType.name,
            size: 10,
            x: coords[0],
            y: coords[1],
            color: nodeType.color,
            shape: nodeType.shape
        };

        features.nodes.push(newNode);

        // No need to do a full refresh
        drawNode(newNode, svg);
    }
});

// User starts dragging the mouse
function dragStarted(d) {
    let startCoords = d3.mouse(this);
    lineStartNodeID = findClosestNode(startCoords[0], startCoords[1], 100)
}

// Here just in case it needs to be used one day
function dragged(d) {
}

// User lifts button and ends drag--draw a line
function dragEnded(d) {
    if (lineStartNodeID) {
        // Ending coordinates
        let endCoords = d3.mouse(this);

        // Find the closest node, within 100px
        let lineEndNodeID = findClosestNode(endCoords[0], endCoords[1], 100);

        // Don't error out if there is no node close enough
        if (!lineEndNodeID) return;

        // Make sure we aren't making tons of tiny lines accidentally
        if (lineStartNodeID === lineEndNodeID) return;

        // Find the actual node objects
        let startNode = findNode(lineStartNodeID);
        let endNode = findNode(lineEndNodeID);

        let lineTypeID = defaultLineTypeSelect.value;
        let lineType = getLineType(lineTypeID);

        // Make a new line object
        let newLine = {
            lineTypeID: lineTypeID,
            startNodeID: startNode.nodeID,
            endNodeID: endNode.nodeID,
            lineID: ++lineCounter,
            name: lineType.name,
            bi_directionality: false,
            color: lineType.color,
            stroke: lineType.stroke,
            weight: lineType.weight
        };

        // Reset and prepare for more lines
        lineStartNodeID = null;

        features.lines.push(newLine);

        // Redraw
        reset(svg);
    }
}

// Downloading the nodes and lines
function downloadDrawing() {
    // Make a place to put nodes and lines
    let drawing = {};

    // Put them there
    drawing.floorPlanSrc = features.floorPlanSrc;
    drawing.floorPlanBounds = features.floorPlanBounds;
    drawing.nodes = features.nodes;
    drawing.lines = features.lines;

    // Make from_node_id and to_node_id. These serve no purpose except to fulfill the requirements
    for (let line of drawing.lines) {
        let startNode = findNode(line.startNodeID);
        let endNode = findNode(line.endNodeID);
        line.from_node_id = {
            x: startNode.x,
            y: startNode.y
        };
        line.to_node_id = {
            x: endNode.x,
            y: endNode.y
        };
    }

    // Download it
    let drawingData = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(drawing));
    let downloadAnchor = document.getElementById("downloadDrawingAnchor");
    downloadAnchor.setAttribute("href", drawingData);
    downloadAnchor.setAttribute("download", "drawing.json");
    downloadAnchor.click();
}

function downloadTypes() {
    // Make a place to put types
    let types = {};

    // Put them there
    types.lineTypes = features.lineTypes;
    types.nodeTypes = features.nodeTypes;

    // Download it
    let typesData = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(types));
    let downloadAnchor = document.getElementById("downloadTypesAnchor");
    downloadAnchor.setAttribute("href", typesData);
    downloadAnchor.setAttribute("download", "types.json");
    downloadAnchor.click();
}

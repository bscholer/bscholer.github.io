let floorPlanBackground = document.querySelector('#floor-plan-background');
let features = {
    "floorPlanBounds": {},
    "nodes": [],
    "lines": []
};

let nodeTypes = [
    {
        name: "node0",
        color: "red"
    },
    {
        name: "node1",
        color: "pink"
    },
    {
        name: "node2",
        color: "green"
    },
    {
        name: "node3",
        color: "orange"
    },
    {
        name: "node4",
        color: "teal"
    },
    {
        name: "node5",
        color: "lightsalmon"
    },
    {
        name: "node6",
        color: "purple"
    },
    {
        name: "node7",
        color: "blueviolet"
    },
    {
        name: "node8",
        color: "darkgreen"
    },
    {
        name: "node9",
        color: "skyblue"
    },
];
// TODO this needs to be update when loading in data
let nodeCounter = 0;

// Used only if a click is starting a line
let lineStartNodeID;

function openImage() {
    console.log("sup");
    let file = document.querySelector('#floor-plan-upload-input').files[0];
    let reader = new FileReader();

    reader.addEventListener("load", function () {
        floorPlanBackground.src = reader.result;
    });

    if (file) {
        reader.readAsDataURL(file);
    }
    features.floorPlanBounds.w = floorPlanBackground.width;
    features.floorPlanBounds.h = floorPlanBackground.height;
}

var svg = d3.select("#floor-plan-container").append("svg")
    .attr("width", floorPlanBackground.width)
    .attr("height", floorPlanBackground.height);

// Creating nodes
svg.on("click", function () {
    let coords = d3.mouse(this);

    if (features.nodes.length > 1 && (findNodeCollision(coords[0], coords[1]) || lineStartNodeID)) {
        // Checking if click is within an existing node
        console.log(lineStartNodeID);
        if (!lineStartNodeID && findNodeCollision(coords[0], coords[1])) {
            lineStartNodeID = findNodeCollision(coords[0], coords[1]);
            console.log("after" + lineStartNodeID);
        }
        // We already know that a line is started, so now to find the endpoint.
        else if (lineStartNodeID) {
            let startNode = findNode(lineStartNodeID);
            let closestNodeID = findClosestNode(coords[0], coords[1]);
            let endNode = findNode(closestNodeID);
            let newLine = {
                startNodeID: startNode.nodeID,
                endNodeID: endNode.nodeID,
                stroke: 5,
                color: "orange"
            };
            console.log(newLine);
            console.log(startNode);
            svg.append("line")
                .attr("x1", startNode.x)
                .attr("y1", startNode.y)
                .attr("x2", endNode.x)
                .attr("y2", endNode.y)
                .attr("stroke-width", newLine.stroke)
                .attr("stroke", newLine.color);
            lineStartNodeID = null;
            features.lines.push(newLine);
        }
    }

    //Make a new node
    else {
        let newNode = {
            nodeID: ++nodeCounter,
            nodeType: 0,
            r: 10,
            x: coords[0],
            y: coords[1]
        };
        features.nodes.push(newNode);

        let circle = svg.append("circle")
            .attr("cx", newNode.x)
            .attr("cy", newNode.y)
            .attr("r", newNode.r)
            .style("fill", function (d) {
                return nodeTypes[newNode.nodeType].color;
            })
    }
});

//This function returns a nodeID if a click is within an existing node
function findNodeCollision(x, y) {
    for (let node of features.nodes) {
        let dist = Math.hypot(x - node.x, y - node.y);
        if (dist < node.r) {
            return node.nodeID;
        }
    }
    return null;
}

//This function returns the nodeID closest to x, y
//It should only be called if 1+ nodes exist
function findClosestNode(x, y) {
    let closestNodeID;
    let closestDist = Number.MAX_VALUE;
    for (let node of features.nodes) {
        let dist = Math.hypot(x - node.x, y - node.y);
        if (dist < closestDist) {
            closestDist = dist;
            closestNodeID = node.nodeID;
        }
    }
    return closestNodeID;
}

//Finds a node in features.nodes from a nodeID
function findNode(nodeID) {
    for (let node of features.nodes) {
        if (node.nodeID === nodeID) return node;
    }
}

// svg.on("mousedown", function () {
//     let orgCoords = d3.mouse(this);
//     d3.select(this).classed("active", true);
//     let w = d3.select(window)
//         .on("mousemove", mousemove)
//         .on("mouseup", mouseup);
//
//     function mousemove() {
//         let newCoords = d3.mouse(this);
//         console.log(d3.mouse(svg.node()));
//         let line = svg.append("line")
//             .attr("x1", orgCoords[0])
//             .attr("y1", orgCoords[1])
//             .attr("x2", newCoords[0])
//             .attr("y2", newCoords[1])
//             .attr("stroke-width", 2)
//             .attr("stroke", "black");
//     }
//
//     function mouseup() {
//         div.classed("active", false);
//         w.on("mousemove", null).on("mouseup", null)
//     }
// })

function downloadData() {
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(features));
    let downloadAnchor = document.getElementById("downloadAnchor");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "features.json");
    downloadAnchor.click();
}
